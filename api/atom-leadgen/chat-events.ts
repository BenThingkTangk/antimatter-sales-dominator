/**
 * ATOM Lead Gen — live chat events poller.
 *
 * The frontend polls this endpoint every ~2s during an active call.
 * We look up the Hume chat by its custom_session_id (= Twilio callSid)
 * and return:
 *   - transcript (USER_MESSAGE + AGENT_MESSAGE)
 *   - per-message emotion_features (48-dim)
 *   - derived sentiment score (-100..100)
 *   - derived buyer-intent score (0..100)
 *   - derived 6-emotion rollup for the UI bars
 *   - call stage (discovery / evaluation / negotiation / close)
 *
 * Zero state stored server-side — Hume is the source of truth.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const clean = (v: string | undefined) =>
  (v || "").replace(/\\n/g, "").trim();

const HUME_API_KEY = clean(process.env.HUME_API_KEY);

// Emotion groupings — map Hume's 48 expressions to the 6 UI bars.
const EMOTION_GROUPS: Record<string, string[]> = {
  confidence:  ["Confidence", "Determination", "Pride", "Triumph"],
  interest:    ["Interest", "Concentration", "Contemplation", "Realization"],
  skepticism:  ["Doubt", "Confusion", "Disappointment", "Contempt"],
  excitement:  ["Excitement", "Enthusiasm", "Joy", "Amusement", "Surprise (positive)"],
  frustration: ["Anger", "Annoyance", "Disgust", "Awkwardness", "Distress", "Tiredness"],
  neutrality:  ["Calmness", "Relief", "Satisfaction"],
};

// Positive emotions that push sentiment UP
const POS_EMOTIONS = new Set([
  "Joy", "Amusement", "Excitement", "Contentment", "Satisfaction", "Pride",
  "Triumph", "Admiration", "Interest", "Enthusiasm", "Calmness", "Relief",
  "Gratitude", "Love", "Desire", "Realization",
]);

// Negative emotions that push sentiment DOWN
const NEG_EMOTIONS = new Set([
  "Anger", "Annoyance", "Contempt", "Disgust", "Disappointment", "Distress",
  "Doubt", "Embarrassment", "Fear", "Guilt", "Sadness", "Shame", "Tiredness",
  "Awkwardness", "Anxiety", "Horror", "Pain",
]);

// Intent signals — emotions that indicate buying readiness
const HIGH_INTENT = new Set([
  "Interest", "Concentration", "Contemplation", "Realization", "Desire",
  "Excitement", "Enthusiasm", "Determination", "Admiration",
]);

interface HumeEvent {
  id: string;
  type: string;
  role?: string;
  message_text?: string;
  timestamp: number;
  emotion_features?: string; // JSON-encoded
  end_reason?: string;
}

async function findChatBySessionId(sessionId: string): Promise<string | null> {
  // Query Hume list chats and filter by custom_session_id.
  // We scan the 30 most recent chats (plenty for live calls).
  const url = `https://api.hume.ai/v0/evi/chats?page_number=0&page_size=30&ascending_order=false`;
  try {
    const r = await fetch(url, { headers: { "X-Hume-Api-Key": HUME_API_KEY } });
    if (!r.ok) return null;
    const data: any = await r.json();
    const chats: any[] = data.chats_page || [];
    for (const c of chats) {
      if (c.custom_session_id === sessionId) return c.id;
      if (c.metadata && typeof c.metadata === "string") {
        try {
          const md = JSON.parse(c.metadata);
          if (md.custom_session_id === sessionId) return c.id;
        } catch {}
      }
    }
  } catch {}
  return null;
}

async function fetchChatEvents(chatId: string): Promise<HumeEvent[]> {
  const url = `https://api.hume.ai/v0/evi/chats/${encodeURIComponent(chatId)}?page_number=0&page_size=100&ascending_order=true`;
  const r = await fetch(url, { headers: { "X-Hume-Api-Key": HUME_API_KEY } });
  if (!r.ok) return [];
  const data: any = await r.json();
  return (data.events_page as HumeEvent[]) || [];
}

function computeSentiment(emotions: Record<string, number>): number {
  let pos = 0, neg = 0;
  for (const [k, v] of Object.entries(emotions)) {
    if (POS_EMOTIONS.has(k)) pos += v;
    if (NEG_EMOTIONS.has(k)) neg += v;
  }
  // Range -100..100
  if (pos + neg < 0.001) return 0;
  return Math.round(((pos - neg) / (pos + neg)) * 100);
}

function computeIntent(emotions: Record<string, number>): number {
  let intent = 0;
  for (const [k, v] of Object.entries(emotions)) {
    if (HIGH_INTENT.has(k)) intent += v;
  }
  // Normalize: max realistic intent ~2.0 total
  return Math.min(100, Math.round((intent / 2.0) * 100));
}

function rollupEmotions(emotions: Record<string, number>): Record<string, number> {
  const rolled: Record<string, number> = {};
  for (const [group, members] of Object.entries(EMOTION_GROUPS)) {
    let sum = 0;
    for (const m of members) sum += emotions[m] || 0;
    rolled[group] = Math.min(1, sum / members.length);
  }
  return rolled;
}

function inferStage(transcript: { role: string; text: string }[]): 1 | 2 | 3 | 4 {
  const text = transcript.map(t => t.text.toLowerCase()).join(" ");
  // Very heuristic — replace with real classifier later
  if (/close|contract|sign|send.*agreement|proposal/.test(text)) return 4;
  if (/price|cost|budget|how much|pricing|discount/.test(text))    return 3;
  if (/demo|see it|show me|case study|reference|proof/.test(text)) return 2;
  return 1;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "method" });

  // Accept either ?sessionId= (preferred) or ?callSid= (legacy)
  const sessionId = String(req.query.sessionId || req.query.callSid || "").trim();
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  if (!HUME_API_KEY) return res.status(500).json({ error: "no HUME_API_KEY" });

  try {
    const chatId = await findChatBySessionId(sessionId);
    if (!chatId) {
      return res.status(200).json({
        sessionId,
        chatId: null,
        status: "pending",
        transcript: [],
        metrics: null,
        message: "chat not started yet",
      });
    }

    const events = await fetchChatEvents(chatId);

    // Transcript: role + text
    const transcript = events
      .filter(e => e.type === "USER_MESSAGE" || e.type === "AGENT_MESSAGE")
      .map(e => ({
        role: e.role === "USER" || e.type === "USER_MESSAGE" ? "user" : "agent",
        text: e.message_text || "",
        timestamp: e.timestamp,
      }))
      .filter(t => t.text);

    // Aggregate emotions from all USER_MESSAGE events
    const userEmotions: Record<string, number> = {};
    let emotionCount = 0;
    for (const e of events) {
      if (e.type === "USER_MESSAGE" && e.emotion_features) {
        try {
          const ef = JSON.parse(e.emotion_features) as Record<string, number>;
          for (const [k, v] of Object.entries(ef)) {
            userEmotions[k] = (userEmotions[k] || 0) + v;
          }
          emotionCount++;
        } catch {}
      }
    }

    // Average across messages
    const avgEmotions: Record<string, number> = {};
    for (const [k, v] of Object.entries(userEmotions)) {
      avgEmotions[k] = v / Math.max(1, emotionCount);
    }

    // Latest-message emotions (for near-real-time reactivity)
    let latestEmotions: Record<string, number> = {};
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === "USER_MESSAGE" && e.emotion_features) {
        try {
          latestEmotions = JSON.parse(e.emotion_features);
          break;
        } catch {}
      }
    }

    // We weight 70% latest / 30% running average for reactivity but smoothness.
    const blended: Record<string, number> = {};
    const allKeys = new Set([...Object.keys(avgEmotions), ...Object.keys(latestEmotions)]);
    for (const k of allKeys) {
      blended[k] = 0.7 * (latestEmotions[k] || 0) + 0.3 * (avgEmotions[k] || 0);
    }

    // Call-ended detection
    const endEvent = events.find(e => e.type === "CHAT_END_MESSAGE");

    return res.status(200).json({
      sessionId,
      chatId,
      status: endEvent ? "ended" : "active",
      endReason: endEvent?.end_reason || null,
      transcript,
      metrics: {
        sentiment: computeSentiment(blended),   // -100..100
        buyerIntent: computeIntent(blended),    // 0..100
        emotions: rollupEmotions(blended),      // 6 group scores 0..1
        stage: inferStage(transcript),          // 1..4
        messageCount: transcript.length,
        emotionSampleCount: emotionCount,
      },
      rawEmotionsLatest: latestEmotions, // for debugging / richer viz
    });
  } catch (err: any) {
    console.error("chat-events error:", err);
    return res.status(500).json({ error: err?.message || "failed" });
  }
}
