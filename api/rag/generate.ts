/**
 * RAG-powered content generation for all ATOM modules
 * Retrieves company context from vector DB and uses it to generate better AI outputs
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RAG_URL = process.env.RAG_URL || "https://atom-rag.45-79-202-76.sslip.io";

async function getRAGContext(company: string, module: string): Promise<string> {
  if (!company || company.trim().length < 2) return "";
  try {
    const res = await fetch(`${RAG_URL}/company/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: company.trim(), module }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.context || "";
  } catch {
    return "";
  }
}

async function gpt(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.4,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { module, company, product, ...params } = req.body;

  // The "thing" being researched — could be a company (prospect target) or product (being pitched)
  const targetCompany = company || product || "";
  const ragModule = module || "general";

  try {
    // Fetch RAG context for both the company AND product if different
    const [companyCtx, productCtx] = await Promise.all([
      targetCompany ? getRAGContext(targetCompany, ragModule) : Promise.resolve(""),
      product && product !== company ? getRAGContext(product, "pitch") : Promise.resolve(""),
    ]);

    const hasContext = companyCtx.length > 50 || productCtx.length > 50;
    const contextBlock = [
      companyCtx ? `COMPANY INTELLIGENCE (${targetCompany}):\n${companyCtx}` : "",
      productCtx ? `PRODUCT INTELLIGENCE (${product}):\n${productCtx}` : "",
    ].filter(Boolean).join("\n\n");

    let result: string;

    switch (module) {
      case "pitch": {
        const { prospectTitle = "Decision Maker", dealStage = "discovery", mode } = params;
        const pitchType = mode || dealStage;
        result = await gpt(
          "You are the world's best B2B enterprise sales rep. Generate compelling, specific pitches.",
          `Generate a ${pitchType} pitch targeting a ${prospectTitle}${targetCompany ? ` at ${targetCompany}` : ""}${product ? ` for ${product}` : ""}.

${hasContext ? `Use this intelligence to make the pitch highly specific:\n${contextBlock}` : ""}

Structure:
1. OPENER (10 seconds, creates genuine curiosity)
2. VALUE PITCH (30 seconds, specific pain points and ROI)
3. CALL TO ACTION (meeting ask)

Make it conversational, specific, and reference real details from the intelligence.`
        );
        break;
      }

      case "objection": {
        const { objectionText = "", category = "" } = params;
        result = await gpt(
          "You are an elite sales trainer specializing in B2B enterprise objection handling.",
          `Handle this objection${targetCompany ? ` from someone at ${targetCompany}` : ""}${product ? ` about ${product}` : ""}:

OBJECTION: "${objectionText}"
${category ? `Category: ${category}` : ""}

${hasContext ? `Company & Product Intelligence:\n${contextBlock}` : ""}

Respond with:
**ACKNOWLEDGE** (1 sentence validating their concern)
**REFRAME** (2 sentences repositioning using specific data from the intel)
**PROVE** (specific stat, customer example, or competitive differentiation)
**CLOSE** (question that moves forward)

Be specific, not generic. Reference real details.`
        );
        break;
      }

      case "market_intent": {
        const { industry = "", topic = "" } = params;
        result = await gpt(
          "You are a market intelligence analyst specializing in B2B buying signals and market dynamics.",
          `Analyze market intent signals${targetCompany ? ` for ${targetCompany}` : ""}${industry ? ` in the ${industry} industry` : ""}${topic ? ` focused on ${topic}` : ""}.

${hasContext ? `Intelligence Data:\n${contextBlock}` : ""}

Provide:
1. INTENT SCORE (0-100) with reasoning
2. TOP 5 BUYING SIGNALS (specific, actionable)
3. TRIGGER EVENTS (what would cause immediate buying need)
4. RECOMMENDED ACTION (exactly what an SDR should do right now)
5. TIMING WINDOW (when to reach out for best conversion)

Return as structured text, be specific.`
        );
        break;
      }

      case "prospect": {
        const { industry = "", geo = "" } = params;
        result = await gpt(
          "You are a B2B sales intelligence expert specializing in identifying ideal customers.",
          `Generate a prospect profile${targetCompany ? ` for ${targetCompany}` : ""}${product ? ` selling ${product}` : ""}${industry ? ` in ${industry}` : ""}${geo ? ` in ${geo}` : ""}.

${hasContext ? `Intelligence:\n${contextBlock}` : ""}

Provide:
1. IDEAL CUSTOMER PROFILE (specific company types, sizes, characteristics)
2. DECISION MAKER PROFILES (titles, responsibilities, pain points)
3. TOP QUALIFYING QUESTIONS (5 questions to ask)
4. BUYING TRIGGERS (signals this prospect is ready to buy)
5. COMPETITIVE LANDMINE (what competitor they're likely using)`
        );
        break;
      }

      default:
        result = await gpt(
          "You are an elite B2B sales AI assistant.",
          `${hasContext ? `Using this intelligence about ${targetCompany}:\n${contextBlock}\n\n` : ""}${params.prompt || `Provide sales intelligence for ${targetCompany}`}`
        );
    }

    return res.json({ result, hasRagContext: hasContext, company: targetCompany });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Generation failed" });
  }
}
