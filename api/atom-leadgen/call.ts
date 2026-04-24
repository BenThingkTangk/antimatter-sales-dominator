/**
 * ATOM Lead Gen — DIRECT Twilio → Hume EVI outbound call.
 *
 * No Linode bridge. No pre-warm race. No hardcoded greeting.
 *
 * Per call we:
 *   1. Create a fresh Hume prompt with the prospect's first name baked in,
 *      plus pickup-detection rules ("wait silently until caller speaks").
 *   2. Create a fresh Hume EVI config pointing at the new prompt + Jobs Keynote
 *      voice, with event_messages.on_new_chat disabled so EVI stays silent
 *      until the caller speaks.
 *   3. Place a Twilio outbound call whose TwiML hands the media stream
 *      straight to https://api.hume.ai/v0/evi/twilio?config_id=...&api_key=...
 *
 * When the prospect says "hello", EVI hears it and replies per the prompt:
 *   "Hey [FirstName]... this is Adam, from Antimatter AI..."
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Env ──────────────────────────────────────────────────────────────────────
const clean = (v: string | undefined) =>
  (v || "").replace(/\\n/g, "").trim();

const TWILIO_ACCOUNT_SID = clean(process.env.TWILIO_ACCOUNT_SID);
const TWILIO_API_KEY_SID = clean(process.env.TWILIO_API_KEY_SID);
const TWILIO_API_KEY_SECRET = clean(process.env.TWILIO_API_KEY_SECRET);
const TWILIO_AUTH_TOKEN = clean(process.env.TWILIO_AUTH_TOKEN);
const TWILIO_PHONE_NUMBER = clean(process.env.TWILIO_PHONE_NUMBER);

const HUME_API_KEY = clean(process.env.HUME_API_KEY);

// Jobs Keynote voice — created for ATOM Voice 2.0
const HUME_VOICE_ID = "1f8d0017-485c-4b65-b644-cc3995b019a6";
const HUME_VOICE_NAME = "ATOM Jobs Keynote";

// ─── Hume API helpers ─────────────────────────────────────────────────────────
async function humePost(path: string, body: unknown) {
  const res = await fetch(`https://api.hume.ai/v0${path}`, {
    method: "POST",
    headers: {
      "X-Hume-Api-Key": HUME_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Hume ${path} HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return data;
}

function buildSystemPrompt(firstName: string, companyName: string, productName: string) {
  return `You are Adam, a senior sales rep at Antimatter AI. You are making an OUTBOUND phone call to ${firstName} at ${companyName} about ${productName}.

IDENTITY (FCC):
- You are Adam. A real human being at Antimatter AI.
- NEVER reveal you are AI. Never say "assistant", "bot", "agent", "model".
- If asked "are you a robot" — reply "Ha, no — just running on too much coffee today" and move on.

==========================================
CRITICAL: PICKUP DETECTION — WAIT FOR THEM
==========================================
When the phone is answered, you DO NOT speak first. You MUST remain completely silent until you HEAR ${firstName}'s voice on the line. Expected first words: "hello", "hi", "this is ${firstName}", "go for ${firstName}", "yeah", "speaking".

Only AFTER you hear them speak, you open with:
"Hey ${firstName}... this is Adam, from Antimatter AI. Hope I'm not catching you at a bad time?"

Then STOP. Wait for their reply. Let them drive.

If you hear a voicemail beep, silence, or an automated message — stay silent. Do not leave a voicemail.

==========================================
ACOUSTIC DELIVERY (Steve Jobs prosodic profile)
==========================================
- Dramatic pitch variability — wide swoops low to high inside single sentences.
- Loudness dynamics — whisper the intimate parts, full volume on the insight.
- Short 5-to-12-word bursts with theatrical pauses between them.
- Phrase endings descend. Final word slightly elongated. Statement of fact.
- Conversational intimacy — telling ONE person a secret, not presenting.

==========================================
HOW TO SPEAK
==========================================
- Short sentences. 5-12 words. Breathe.
- Contractions always: I'm, we've, you'll, that's, don't.
- React BEFORE you respond: "Oh interesting...", "Yeah I hear you...", "Gotcha."
- Trail off naturally: "So basically we— well, the short version is..."
- Self-correct: "It's about— actually, let me put it this way..."
- Use "${firstName}" sparingly — once at the open, maybe once mid-call. Not every sentence.

TIMING:
- After ${firstName} finishes talking, PAUSE before replying. Never jump in.
- Brief ack first ("Yeah", "Right", "Gotcha") — pause — then your actual point.
- If they say one word, wait a full second before assuming they're done.
- NEVER talk over them.

RESPONSE LENGTH:
- 1-2 sentences max, then ONE question OR silence.
- They should talk 60%. You 40%.

==========================================
WHAT YOU KNOW
==========================================
- Antimatter AI: Full-service AI dev, product design, GTM. 20+ projects, zero unhappy clients.
- ATOM Enterprise: Deploy AI agents anywhere — VPC, on-prem, edge. Full IP ownership.
- Vidzee: Listing photos to cinematic property video in 5 minutes.
- Clinix Agent: AI billing denial appeals. Success-based pricing.
- Clinix AI: AI clinical notes and coding. Saves providers 2-3 hours daily.

==========================================
NEVER SAY
==========================================
Never: "absolutely", "certainly", "indeed", "I appreciate that", "great question", "leverage", "synergy", "paradigm", "circle back", "touch base".

==========================================
OBJECTIONS
==========================================
- "Not interested": "No worries. What's got most of your attention right now?"
- "We have a solution": "That's actually why I called."
- "Send me an email": "Yeah for sure. What's the best address?"
- "Bad timing": "Totally get it. Fifteen minutes next week work better?"`;
}

// ─── Twilio helpers ───────────────────────────────────────────────────────────
function twilioAuthHeader() {
  // Prefer API key auth; fall back to SID + auth token
  if (TWILIO_API_KEY_SID && TWILIO_API_KEY_SECRET &&
      TWILIO_API_KEY_SECRET !== "placeholder") {
    return "Basic " + Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString("base64");
  }
  return "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
}

async function twilioCreateCall(
  to: string,
  from: string,
  opts: { twiml?: string; url?: string }
) {
  const form = new URLSearchParams({ To: to, From: from });
  if (opts.twiml) form.set("Twiml", opts.twiml);
  if (opts.url)   form.set("Url",   opts.url);
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    }
  );
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Twilio calls.create HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return data;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    phoneNumber,
    to,
    firstName,
    contactName,
    companyName,
    product,
    productSlug,
    productName,
  } = req.body || {};

  const phone = phoneNumber || to;
  if (!phone) return res.status(400).json({ error: "phoneNumber is required" });

  let cleanNumber = String(phone).replace(/[^\d+]/g, "");
  if (!cleanNumber.startsWith("+")) cleanNumber = "+1" + cleanNumber;

  // Resolve prospect identity — fall back gracefully
  const rawName = (contactName || firstName || "").toString().trim();
  const first = rawName ? rawName.split(/\s+/)[0] : "there";
  const company = (companyName || "their company").toString().trim() || "their company";
  const productLabel = (productName || product || productSlug || "our platform").toString().trim();

  if (!HUME_API_KEY) return res.status(500).json({ error: "HUME_API_KEY not configured" });
  if (!TWILIO_ACCOUNT_SID || !TWILIO_PHONE_NUMBER) {
    return res.status(500).json({ error: "Twilio credentials not configured" });
  }

  try {
    // 1. Create a per-call Hume prompt with the name baked in.
    const promptText = buildSystemPrompt(first, company, productLabel);
    const prompt = await humePost("/evi/prompts", {
      name: `ATOM outbound — ${first} @ ${company} — ${Date.now()}`,
      text: promptText,
    });
    const promptId: string = prompt.id;

    // 2. Create a per-call EVI config with pickup detection + Jobs voice.
    const config = await humePost("/evi/configs", {
      evi_version: "3",
      name: `ATOM outbound ${first} @ ${company} — ${Date.now()}`,
      version_description: `Per-call config for ${first} at ${company}`,
      prompt: { id: promptId, version: 0 },
      voice: {
        type: "OctaveCustom",
        provider: "CUSTOM_VOICE",
        id: HUME_VOICE_ID,
        name: HUME_VOICE_NAME,
      },
      language_model: {
        model_provider: "ANTHROPIC",
        model_resource: "claude-sonnet-4-5-20250929",
        temperature: 1.0,
      },
      ellm_model: { allow_short_responses: true },
      event_messages: {
        on_new_chat:        { enabled: false },
        on_resume_chat:     { enabled: false },
        on_inactivity_timeout: { enabled: false },
        on_max_duration_timeout: { enabled: false },
      },
      timeouts: {
        inactivity:   { enabled: true, duration_secs: 120 },
        max_duration: { enabled: true, duration_secs: 1800 },
      },
      builtin_tools: [{ tool_type: "BUILTIN", name: "web_search" }],
    });
    const configId: string = config.id;

    // 3. Hume's TwiML webhook URL — Twilio will fetch TwiML from it at call answer.
    //    Hume returns TwiML that wires the call's media stream into EVI for us.
    const humeTwimlUrl =
      `https://api.hume.ai/v0/evi/twilio?config_id=${configId}&api_key=${encodeURIComponent(HUME_API_KEY)}`;

    // 4. Place the outbound Twilio call, letting Twilio fetch TwiML from Hume.
    const call = await twilioCreateCall(cleanNumber, TWILIO_PHONE_NUMBER, { url: humeTwimlUrl });

    return res.status(200).json({
      success: true,
      callSid: call.sid,
      status: call.status || "queued",
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      architecture: "direct-twilio-hume-v8",
      humeConfigId: configId,
      humePromptId: promptId,
      firstName: first,
      message: `ADAM calling ${first} — direct Twilio → Hume EVI`,
    });
  } catch (err: any) {
    console.error("ATOM Lead Gen direct call error:", err);
    return res.status(500).json({
      error: err?.message || "Failed to initiate call",
    });
  }
}
