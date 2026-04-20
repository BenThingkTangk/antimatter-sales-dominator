/**
 * ATOM Aletheia — Text Deception Analysis
 * Analyzes SMS, email, chat, or notes for deception cues using GPT-4o
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

  const { text, channel = "text", threadContext = [] } = req.body || {};
  if (!text || text.trim().length < 10) return res.status(400).json({ error: "Text too short (min 10 chars)" });

  try {
    const systemPrompt = `You are ATOM Aletheia — an advanced deception intelligence engine for sales professionals. Analyze the following ${channel} message for truth signals and deception cues.

You must return ONLY valid JSON with this exact structure:
{
  "aletheiaTruthScore": <number 0-100, where 100 is fully truthful>,
  "overallRisk": "<HIGH|MEDIUM|LOW|GHOST>",
  "hedgePct": <number 0-100>,
  "evasionPct": <number 0-100>,
  "urgency": "<NONE|LOW|MEDIUM|HIGH|CRITICAL>",
  "dealRisk": "<HEALTHY|CAUTION|AT_RISK|DEAD>",
  "flags": [
    {
      "type": "<real_objection|fake_objection|stall|ghosting_pattern|authority_evasion|budget_deflection|timeline_vague|over_enthusiasm|distancing|hedging>",
      "severity": "<high|medium|low>",
      "phrase": "<exact phrase from the text that triggered this flag>",
      "explanation": "<1-2 sentence explanation of why this is suspicious>"
    }
  ],
  "highlightedPhrases": [
    {
      "phrase": "<exact text to highlight>",
      "color": "<red|amber|green>",
      "reason": "<brief reason>"
    }
  ],
  "linguisticCues": {
    "passiveVoice": <number 0-100>,
    "distancingLanguage": <number 0-100>,
    "overCertainty": <number 0-100>,
    "nonAnswerRatio": <number 0-100>,
    "fillerWords": <number 0-100>
  },
  "buyerIntentState": "<exploring|serious|stalling|using_as_leverage|ghosting|genuine_blocker>",
  "ghostProbability": <number 0-100>,
  "suggestedReplies": [
    "<strategic reply option 1>",
    "<strategic reply option 2>",
    "<strategic reply option 3>"
  ],
  "playbook": {
    "move": "<strategic move name>",
    "tactic": "<detailed tactic description>",
    "signal": "<what this move reveals about the prospect>"
  },
  "summary": "<2-3 sentence executive summary of the deception analysis>"
}

Be brutally honest. Real sales professionals need truth, not comfort. If the message shows clear deception patterns, say so. If it's genuine, say so. Base your analysis on:
- Hedging language (maybe, might, could, potentially, I think, possibly)
- Evasion patterns (non-answers, topic shifts, vague timelines)
- Authority deflection (committee, need to check, not my decision)
- Budget fabrication (budget isn't the issue, we have budget but...)
- Distancing language (one, they, the team vs I, we, my)
- Over-enthusiasm without specifics (definitely, absolutely, love it but...)
- Ghosting signals (I'll get back to you, let me circle back, few weeks)
- Timeline vagueness (Q3/Q4 maybe, next year sometime, down the road)`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add thread context if provided
    if (threadContext.length > 0) {
      messages.push({
        role: "user",
        content: `Previous messages in this thread for context:\n${threadContext.map((m: string, i: number) => `[${i + 1}] ${m}`).join("\n")}\n\nNow analyze this latest message:`,
      });
    }

    messages.push({ role: "user", content: text });

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!gptRes.ok) throw new Error(`GPT ${gptRes.status}`);
    const gptData = await gptRes.json();
    const analysis = JSON.parse(gptData.choices[0].message.content);

    return res.json({
      ...analysis,
      channel,
      analyzedAt: new Date().toISOString(),
      textLength: text.length,
      engine: "aletheia-v1",
    });
  } catch (e: any) {
    console.error(`[Aletheia] ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
}
