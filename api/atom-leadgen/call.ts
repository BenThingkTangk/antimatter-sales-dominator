/**
 * ATOM Lead Gen — Direct Twilio → Hume EVI outbound call.
 *
 * GOLD-STANDARD ARCHITECTURE:
 *
 *   Caller  ◄──►  Twilio SIP  ◄─── TwiML from ───┐
 *                      │                          │
 *                      │                    Hume EVI /v0/evi/twilio
 *                      │                     (config_id pre-warmed)
 *                      │                          │
 *                      └────── WebSocket ────────►│
 *                                                 │
 *                                         ┌───────┴─────────┐
 *                                         │  Anthropic      │
 *                                         │  Claude Sonnet  │  ← system prompt
 *                                         │  (~150ms FTL)   │     with {{variables}}
 *                                         └───────┬─────────┘
 *                                                 │
 *                                         ┌───────▼─────────┐
 *                                         │  Octave TTS     │  ← Jobs Tenor voice
 *                                         │  (Jobs Tenor)   │     (emotionally modulated)
 *                                         └─────────────────┘
 *
 * BEFORE the call is placed, this endpoint:
 *   1. Resolves prospect identity (first_name, company, product).
 *   2. Queries ATOM RAG (Pinecone-backed, cached Perplexity+GPT research)
 *      for a 3-chunk pitch brief + objection playbook on the product being
 *      pitched. Warm cache returns in ~700ms; cold falls back to a generic
 *      brief while ingestion kicks off in background.
 *   3. Passes everything to Hume's EVI via Twilio webhook query params.
 *      The pre-warmed EVI config has {{first_name}}, {{company_name}},
 *      {{product_name}}, {{company_brief}} template slots in its prompt.
 *   4. Twilio dials; when the prospect says hello, ADAM opens with their
 *      name and has the full research brief already in context.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ─── Env ──────────────────────────────────────────────────────────────────────
const clean = (v: string | undefined) =>
  (v || "").replace(/\\n/g, "").trim();

const TWILIO_ACCOUNT_SID    = clean(process.env.TWILIO_ACCOUNT_SID);
const TWILIO_API_KEY_SID    = clean(process.env.TWILIO_API_KEY_SID);
const TWILIO_API_KEY_SECRET = clean(process.env.TWILIO_API_KEY_SECRET);
const TWILIO_AUTH_TOKEN     = clean(process.env.TWILIO_AUTH_TOKEN);
const TWILIO_PHONE_NUMBER   = clean(process.env.TWILIO_PHONE_NUMBER);

const HUME_API_KEY          = clean(process.env.HUME_API_KEY);

// ATOM RAG microservice (Pinecone-backed, always-warm cache)
const RAG_URL = clean(process.env.RAG_URL) || "https://atom-rag.45-79-202-76.sslip.io";

// ─── Pre-warmed Hume assets (production, reused across all calls) ─────────────
const HUME_CONFIG_ID = "3c6f8a5b-e6f3-4732-9570-36a22f38e147"; // v11 Stanford + RAG + pickup
const HUME_VOICE_ID  = "e891bda0-d013-4a46-9cbe-360d618b0e58"; // ATOM Jobs Tenor

// ─── ATOM RAG — vector-search-backed pitch/objection brief ────────────────────
async function fetchRagBrief(
  productName: string,
  prospectCompany: string,
  contactName: string,
): Promise<string> {
  // We care about the PRODUCT being pitched — that's the library of pitches
  // and objections ADAM has been trained on. We query the RAG service's
  // `pitch` module (chunks covering opener, value, objections, proof).
  const query = `${prospectCompany} ${contactName} outbound call objections pitch value`;

  try {
    const res = await fetch(`${RAG_URL}/company/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_name: productName,
        module: "pitch",
        query,
      }),
      signal: AbortSignal.timeout(2500), // warm hit usually < 900ms
    });
    if (!res.ok) return "";
    const data: any = await res.json();
    const ctx: string = data?.context || "";
    if (ctx.length > 40) {
      // Also pull objection chunks for robustness
      try {
        const oRes = await fetch(`${RAG_URL}/company/context`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: productName,
            module: "objection",
            query: "common objections and rebuttals",
          }),
          signal: AbortSignal.timeout(1500),
        });
        if (oRes.ok) {
          const od: any = await oRes.json();
          const ob: string = od?.context || "";
          if (ob.length > 40) {
            return `${ctx}\n\n---OBJECTION PLAYBOOK---\n${ob}`.slice(0, 4000);
          }
        }
      } catch {}
      return ctx.slice(0, 4000);
    }
  } catch {}
  return "";
}

// Background-ingest a product we don't have indexed yet — fire-and-forget.
// Next call for this product will be warm (~700ms).
function backgroundIngest(productName: string): void {
  fetch(`${RAG_URL}/company/load`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_name: productName }),
    signal: AbortSignal.timeout(3000),
  }).catch(() => { /* best-effort */ });
}

// ─── Twilio helpers ───────────────────────────────────────────────────────────
function twilioAuthHeader() {
  if (TWILIO_API_KEY_SID && TWILIO_API_KEY_SECRET &&
      TWILIO_API_KEY_SECRET !== "placeholder") {
    return "Basic " + Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString("base64");
  }
  return "Basic " + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
}

async function twilioCreateCall(to: string, from: string, opts: { twiml?: string; url?: string }) {
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

  const rawName   = (contactName || firstName || "").toString().trim();
  const first     = rawName ? rawName.split(/\s+/)[0] : "there";
  const company   = ((companyName || "").toString().trim()) || "their company";
  const productLabel = ((productName || product || productSlug || "").toString().trim())
    || "our platform";

  if (!HUME_API_KEY) return res.status(500).json({ error: "HUME_API_KEY not configured" });
  if (!TWILIO_ACCOUNT_SID || !TWILIO_PHONE_NUMBER) {
    return res.status(500).json({ error: "Twilio credentials not configured" });
  }

  try {
    // 1. Pull warm RAG brief on the product being pitched.
    const ragBrief = await fetchRagBrief(productLabel, company, first);

    let companyBrief: string;
    if (ragBrief) {
      companyBrief = ragBrief;
    } else {
      // Product not yet indexed — fire background ingest (next call will be warm)
      backgroundIngest(productLabel);
      companyBrief =
        `You are pitching ${productLabel} to ${first} at ${company}. ` +
        `Lead with curiosity about their current stack and pain. ` +
        `Listen more than you talk. Redirect every objection to a business outcome. ` +
        `Always answer like you built the product yourself and know it cold.`;
    }

    // 2. Build Hume EVI's Twilio webhook URL with per-call session variables.
    //    These populate {{first_name}}, {{company_name}}, {{product_name}},
    //    {{company_brief}} in the pre-warmed prompt template.
    const humeTwimlUrl = new URL("https://api.hume.ai/v0/evi/twilio");
    humeTwimlUrl.searchParams.set("config_id",    HUME_CONFIG_ID);
    humeTwimlUrl.searchParams.set("api_key",      HUME_API_KEY);
    humeTwimlUrl.searchParams.set("first_name",   first);
    humeTwimlUrl.searchParams.set("company_name", company);
    humeTwimlUrl.searchParams.set("product_name", productLabel);
    humeTwimlUrl.searchParams.set("company_brief", companyBrief.slice(0, 3500));

    // 3. Place the outbound call.
    const call = await twilioCreateCall(cleanNumber, TWILIO_PHONE_NUMBER, {
      url: humeTwimlUrl.toString(),
    });

    return res.status(200).json({
      success: true,
      callSid: call.sid,
      status: call.status || "queued",
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      architecture: "twilio-hume-direct-rag-cached-v10",
      humeConfigId: HUME_CONFIG_ID,
      humeVoiceId: HUME_VOICE_ID,
      firstName: first,
      briefSource: ragBrief ? "atom-rag (warm cache)" : "generic (ingest queued)",
      briefLength: companyBrief.length,
      briefPreview: companyBrief.slice(0, 260) + (companyBrief.length > 260 ? "..." : ""),
      message: `ADAM calling ${first} at ${company} about ${productLabel}`,
    });
  } catch (err: any) {
    console.error("ATOM Lead Gen direct call error:", err);
    return res.status(500).json({ error: err?.message || "Failed to initiate call" });
  }
}
