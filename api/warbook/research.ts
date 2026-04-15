/**
 * ATOM WarBook — Deep Company Research via Perplexity Sonar + Apollo + PDL
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const PDL_API_KEY = process.env.PDL_API_KEY;

async function sonarResearch(query: string, ctx: "low" | "medium" | "high" = "medium") {
  if (!PERPLEXITY_API_KEY) return { content: "", citations: [] as string[] };
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [{ role: "user", content: query }],
        stream: false,
        web_search_options: { search_context_size: ctx },
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) { console.error(`Sonar ${res.status}`); return { content: "", citations: [] as string[] }; }
    const d = await res.json();
    return { content: d.choices?.[0]?.message?.content || "", citations: (d.citations || []) as string[] };
  } catch (e: any) { console.error(`Sonar: ${e.message}`); return { content: "", citations: [] as string[] }; }
}

async function findDecisionMakers(company: string, domain?: string) {
  if (!APOLLO_API_KEY) return [];
  try {
    const body: any = { per_page: 10, person_titles: ["CEO","CTO","CIO","CFO","COO","VP Engineering","VP Sales","VP Marketing","Head of IT","Director of Technology","CISO"] };
    if (domain) body.q_organization_domains = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    else body.q_organization_name = company;
    const res = await fetch("https://api.apollo.io/v1/mixed_people/api_search", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": APOLLO_API_KEY },
      body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.people || []).map((p: any) => ({
      name: p.name || `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      title: p.title || "", email: p.email || null,
      phone: p.phone_numbers?.[0]?.sanitized_number || null,
      linkedin: p.linkedin_url || null,
      city: p.city || null, state: p.state || null,
    }));
  } catch { return []; }
}

async function pdlEnrich(company: string, domain?: string) {
  if (!PDL_API_KEY) return null;
  try {
    const params = new URLSearchParams({ api_key: PDL_API_KEY, pretty: "true" });
    if (domain) params.set("website", domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
    else params.set("name", company);
    const res = await fetch(`https://api.peopledatalabs.com/v5/company/enrich?${params}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { company, website } = req.body || {};
  if (!company) return res.status(400).json({ error: "Missing: company" });
  const domain = website || null;

  try {
    const [overviewRes, competitiveRes, newsRes, painRes, battleCardRes, contacts, pdlData] = await Promise.all([
      sonarResearch(`Comprehensive business overview of ${company}${domain ? ` (${domain})` : ""}. Include: what they do, products/services, revenue, employee count, HQ, founding year, key executives, market position. Be specific.`, "high"),
      sonarResearch(`Who are ${company}'s main competitors? Competitive advantages/disadvantages? Market share? Customer sentiment vs alternatives? Name specific competitors.`, "medium"),
      sonarResearch(`Latest news and developments from ${company} in the last 6 months. Product launches, partnerships, funding, leadership changes, earnings, strategic moves. Include dates.`, "medium"),
      sonarResearch(`Common pain points and challenges that ${company} faces or their customers report. Technology gaps, operational challenges. Job postings suggesting they need new solutions. Areas where AI or automation could help.`, "medium"),
      // Battle Card: deep competitive comparison for sales reps
      sonarResearch(`Create a competitive battle card for selling against ${company}. Include: their pricing model and typical contract terms, known weaknesses customers complain about, recent customer churn or negative reviews, features they lack compared to modern alternatives, their sales process weaknesses, and specific talking points a competitor's sales rep should use. Be brutally honest and specific.`, "high"),
      findDecisionMakers(company, domain),
      pdlEnrich(company, domain),
    ]);

    const profile = pdlData ? {
      employeeCount: pdlData.employee_count || pdlData.size || null,
      revenue: pdlData.annual_revenue ? `$${(pdlData.annual_revenue / 1_000_000).toFixed(0)}M` : null,
      industry: pdlData.industry || null, founded: pdlData.founded || null,
      location: [pdlData.location?.locality, pdlData.location?.region, pdlData.location?.country].filter(Boolean).join(", "),
      techStack: pdlData.technology_names?.slice(0, 20) || [],
      tags: pdlData.tags?.slice(0, 10) || [],
      website: pdlData.website || domain, linkedin: pdlData.linkedin_url || null,
    } : null;

    const synthesis = `Build an ATOM WarBook for ${company}. Return ONLY valid JSON.

RESEARCH: ${overviewRes.content}
COMPETITION: ${competitiveRes.content}
NEWS: ${newsRes.content}
PAIN POINTS: ${painRes.content}
BATTLE CARD INTEL: ${battleCardRes.content}
COMPANY DATA: ${profile ? JSON.stringify(profile) : "N/A"}
CONTACTS: ${contacts.length > 0 ? contacts.map((c: any) => `${c.name} - ${c.title}`).join("; ") : "None"}

Return JSON: {"overview":{"description":"2-3 sentences","industry":"","founded":"","headquarters":"","employeeCount":"","revenue":"","website":"","stockTicker":null},"executiveSummary":"3-4 sentence brief for a salesperson","techStack":["tech1","tech2"],"competitors":[{"name":"","threat":"high/medium/low","differentiator":""}],"painPoints":[{"pain":"","severity":"critical/high/medium","opportunity":""}],"buyingSignals":[{"signal":"","strength":"strong/moderate/weak","source":""}],"recentNews":[{"headline":"","date":"","relevance":""}],"objectionPredictions":[{"objection":"","probability":"high/medium/low","counterStrategy":""}],"pitchAngles":[{"angle":"","targetPersona":"","openingLine":""}],"callStrategy":{"bestTimeToCall":"","gatekeeperTips":"","toneRecommendation":"","keyQuestions":["q1","q2","q3"]},"battleCard":{"pricingModel":"their pricing structure","contractTerms":"typical contract details","knownWeaknesses":["weakness 1","weakness 2"],"customerComplaints":["complaint 1","complaint 2"],"featureGaps":["missing feature 1","missing feature 2"],"salesProcessWeaknesses":["weakness 1"],"talkingPoints":["point 1","point 2","point 3"],"winRate":"estimated win rate against them","switchingCost":"what it takes to switch away from them"},"sentimentScore":75,"buyerIntentScore":60,"priorityLevel":"high/medium/low"}`;

    const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: synthesis }], response_format: { type: "json_object" }, temperature: 0.3 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!gptRes.ok) throw new Error(`GPT ${gptRes.status}`);
    const gptData = await gptRes.json();
    const warbook = JSON.parse(gptData.choices[0].message.content);

    return res.json({
      company, warbook, contacts, companyProfile: profile,
      citations: [...overviewRes.citations, ...competitiveRes.citations, ...newsRes.citations, ...painRes.citations, ...battleCardRes.citations],
      sources: { perplexity: !!overviewRes.content, apollo: contacts.length > 0, pdl: !!profile },
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error(`[WarBook] ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
}
