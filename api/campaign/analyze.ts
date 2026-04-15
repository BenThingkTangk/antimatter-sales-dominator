/**
 * ATOM Campaign — AI Brief Analyzer via Perplexity Agent API
 * 
 * Takes a free-text campaign brief and uses the Agent API to:
 * 1. Research the market/competitor mentioned in the brief
 * 2. Extract targeting parameters (industry, geography, company size, personas)
 * 3. Generate the campaign pitch and objection playbook
 * 4. Return structured filters for the Prospect Engine
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ─── Perplexity Agent API: research + reasoning in one call ──────────────────
async function agentResearch(brief: string): Promise<{ content: string; citations: string[] }> {
  if (!PERPLEXITY_API_KEY) return { content: "", citations: [] };

  try {
    // Use Agent API with web_search tool for real-time competitive research
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content: `You are an elite sales campaign strategist. Analyze the campaign brief and provide deep competitive intelligence. Research the companies/products mentioned, identify the target market, and build a targeting strategy. Be specific with company names, market data, and actionable insights.`
          },
          {
            role: "user",
            content: `Analyze this campaign brief and research the market:\n\n"${brief}"\n\nProvide:\n1. Competitive analysis of the companies/products mentioned\n2. Target customer profile (industry, company size, geography, job titles)\n3. Key pain points of the competitor's customers\n4. Strongest selling angles\n5. Likely objections and how to handle them`
          }
        ],
        stream: false,
        web_search_options: { search_context_size: "high" },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error(`Agent API ${res.status}: ${await res.text().catch(() => "")}`);
      return { content: "", citations: [] };
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      citations: (data.citations || []) as string[],
    };
  } catch (e: any) {
    console.error(`Agent research error: ${e.message}`);
    return { content: "", citations: [] };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { brief } = req.body || {};
  if (!brief) return res.status(400).json({ error: "Missing: brief" });

  try {
    // Step 1: Use Perplexity Agent to research the brief
    const research = await agentResearch(brief);

    // Step 2: Use GPT to extract structured targeting filters + campaign assets
    const extractPrompt = `You are building an ATOM AI sales campaign. Based on this campaign brief and research, extract structured targeting data. Return ONLY valid JSON.

CAMPAIGN BRIEF: "${brief}"

MARKET RESEARCH:
${research.content || "No research available — infer from the brief."}

Return this exact JSON:
{
  "campaignName": "short campaign name",
  "targetProduct": "the product being sold",
  "competitor": "the competitor being targeted (if any)",
  "industry": "target industry (e.g., Technology, Financial Services, Healthcare)",
  "geography": "target geography (e.g., US, California, Northeast US, Global)",
  "companySize": "target company size tier (e.g., 51-200, 201-500, 501-1000, 1001-5000)",
  "jobTitles": ["list", "of", "target", "job", "titles"],
  "techStack": "technology filter if relevant (e.g., Cloudflare, AWS)",
  "keywords": "search keywords for company description matching",
  "pitch": {
    "opener": "2-sentence cold call opener",
    "valueProposition": "core value proposition in one sentence",
    "differentiators": ["key differentiator 1", "key differentiator 2", "key differentiator 3"],
    "closingQuestion": "question to book the meeting"
  },
  "objections": [
    {"objection": "likely objection", "response": "recommended response"}
  ],
  "competitiveIntel": {
    "competitorWeaknesses": ["weakness 1", "weakness 2"],
    "ourAdvantages": ["advantage 1", "advantage 2"],
    "switchingIncentive": "what makes switching compelling"
  },
  "estimatedTargetCount": "estimated number of companies matching these filters"
}`;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: extractPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!gptRes.ok) throw new Error(`GPT ${gptRes.status}`);
    const gptData = await gptRes.json();
    const campaign = JSON.parse(gptData.choices[0].message.content);

    return res.json({
      ...campaign,
      research: research.content,
      citations: research.citations,
      sources: { perplexity: !!research.content, openai: true },
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error(`[Campaign Analyze] ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
}
