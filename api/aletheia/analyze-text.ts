/**
 * ATOM War Room — Von Clausewitz Engine
 * GPT-4o-powered deal intelligence analysis
 * Deception detection, TRUTH Score, competitive radar, negotiation posture, intent amplification
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { text, channel = "text", threadContext = [], dealContext = "" } = req.body || {};
  if (!text || text.trim().length < 10) return res.status(400).json({ error: "Text too short" });

  try {
    const prompt = `You are the ATOM War Room — Von Clausewitz Engine — the most advanced deal intelligence and deception detection system in sales technology. You combine behavioral science, linguistic analysis, and adversarial pattern recognition to decode what prospects REALLY mean.

Analyze this ${channel} communication with extreme precision. Return ONLY valid JSON:

{
  "truthScore": <0-100 TRUTH Score™ — behavioral conviction index based on language commitment depth, specificity, and action orientation>,
  "overallRisk": "<HIGH|MEDIUM|LOW|GHOST>",
  "dealRisk": "<HEALTHY|CAUTION|AT_RISK|DEAD>",
  "urgency": "<NONE|LOW|MEDIUM|HIGH|CRITICAL>",

  "deceptionLayer": {
    "hedgePct": <0-100>,
    "evasionPct": <0-100>,
    "stallProbability": <0-100>,
    "authorityDeflection": <0-100>,
    "budgetFabrication": <0-100>,
    "timelineVagueness": <0-100>,
    "overEnthusiasm": <0-100>
  },

  "flags": [{"type":"<real_objection|fake_objection|stall|ghosting_pattern|authority_evasion|budget_deflection|timeline_vague|over_enthusiasm|distancing|hedging|competitive_mention|power_play|concession_pattern>","severity":"<high|medium|low>","phrase":"<exact phrase>","explanation":"<why this is flagged>"}],

  "highlightedPhrases": [{"phrase":"<exact text>","color":"<red|amber|green>","reason":"<brief>"}],

  "linguisticCues": {
    "passiveVoice": <0-100>,
    "distancingLanguage": <0-100>,
    "overCertainty": <0-100>,
    "nonAnswerRatio": <0-100>,
    "commitmentLanguage": <0-100>,
    "implementationLanguage": <0-100>,
    "urgencyLanguage": <0-100>
  },

  "buyerIntentState": "<exploring|serious|stalling|using_as_leverage|ghosting|genuine_blocker|ready_to_buy|negotiating>",
  "ghostProbability": <0-100>,

  "negotiationPosture": {
    "powerScore": <0-100 — who holds leverage>,
    "urgencyScore": <0-100 — how time-constrained they are>,
    "commitmentScore": <0-100 — concrete vs hedge language>,
    "concessionPattern": "<value_trading|discount_seeking|collaborative|adversarial>",
    "leveragePosition": "<strong|neutral|weak>"
  },

  "competitiveRadar": {
    "competitorMentioned": <boolean>,
    "competitors": ["<names if detected>"],
    "competitiveRiskLevel": "<low|elevated|critical>",
    "competitiveTalkingPoints": ["<counter-points if competitor detected>"]
  },

  "intentSignals": [{"signal":"<exact phrase or pattern>","type":"<buying_intent|implementation_intent|internal_referral|budget_signal|timeline_signal|authority_signal>","strength":"<strong|moderate|weak>"}],

  "suggestedReplies": ["<strategic reply 1>","<strategic reply 2>","<strategic reply 3>"],

  "playbook": {
    "move": "<recommended strategic move name>",
    "tactic": "<specific tactic to execute>",
    "signal": "<what this reveals about the deal>",
    "nextBestActions": ["<action 1>","<action 2>","<action 3>"]
  },

  "ghostResurrection": {
    "isGhosted": <boolean>,
    "reEngagementMessage": "<hyper-personalized re-engagement if ghost detected>",
    "reEngagementStrategy": "<strategy name>"
  },

  "summary": "<3-4 sentence brutally honest executive summary of what's really happening in this deal>"
}

Be ruthless in your analysis. Detect every hedge, evasion, authority deflection, budget fabrication, timeline vagueness, and over-enthusiasm signal. Score everything. The rep's quota depends on your accuracy.`;

    const messages: any[] = [{ role: "system", content: prompt }];
    if (dealContext) messages.push({ role: "user", content: `Deal context: ${dealContext}` });
    if (threadContext.length > 0) {
      messages.push({ role: "user", content: `Thread context:\n${threadContext.map((m: string, i: number) => `[${i+1}] ${m}`).join("\n")}\n\nAnalyze this latest message:` });
    }
    messages.push({ role: "user", content: text });

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages, response_format: { type: "json_object" }, temperature: 0.3, max_tokens: 4000 }),
      signal: AbortSignal.timeout(20000),
    });
    if (!gptRes.ok) throw new Error(`GPT ${gptRes.status}`);
    const data = await gptRes.json();
    const analysis = JSON.parse(data.choices[0].message.content);
    return res.json({ ...analysis, channel, analyzedAt: new Date().toISOString(), engine: "von-clausewitz-v1" });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
