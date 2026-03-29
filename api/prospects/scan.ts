import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

interface HunterContact {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  seniority: string;
  department: string;
  linkedin: string | null;
  phone: string | null;
  confidence: number;
  verification: string;
}

async function enrichWithHunter(companyName: string, domain?: string): Promise<{ contacts: HunterContact[]; organization: string; domain: string }> {
  if (!HUNTER_API_KEY) return { contacts: [], organization: companyName, domain: domain || "" };

  try {
    // Use domain if available, otherwise search by company name
    const searchParam = domain ? `domain=${encodeURIComponent(domain)}` : `company=${encodeURIComponent(companyName)}`;
    const url = `https://api.hunter.io/v2/domain-search?${searchParam}&limit=5&seniority=executive,senior&type=personal&required_field=full_name&api_key=${HUNTER_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Hunter API error for ${companyName}: ${response.status}`);
      return { contacts: [], organization: companyName, domain: domain || "" };
    }

    const data = await response.json();
    const hunterData = data.data;

    const contacts: HunterContact[] = (hunterData?.emails || []).map((e: any) => ({
      email: e.value || "",
      firstName: e.first_name || "",
      lastName: e.last_name || "",
      position: e.position || "",
      seniority: e.seniority || "",
      department: e.department || "",
      linkedin: e.linkedin || null,
      phone: e.phone_number || null,
      confidence: e.confidence || 0,
      verification: e.verification?.status || "unknown",
    }));

    return {
      contacts,
      organization: hunterData?.organization || companyName,
      domain: hunterData?.domain || domain || "",
    };
  } catch (err) {
    console.error(`Hunter enrichment failed for ${companyName}:`, err);
    return { contacts: [], organization: companyName, domain: domain || "" };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { industry, productFocus } = req.body;

    // Step 1: AI generates prospect companies WITH their domain names
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      system: "You are a B2B prospect research AI. Return ONLY a valid JSON array. No markdown, no code blocks. Raw JSON only.",
      messages: [{ role: "user", content: `Generate 5 real prospect companies${industry && industry !== "All Industries" ? ` in ${industry}` : ""}${productFocus && productFocus !== "all" ? ` for ${productFocus}` : " for Antimatter AI ecosystem (AI dev, enterprise AI deployment, real estate video, healthcare billing, clinical documentation, quantum security)"}. JSON array: [{"companyName":"string","domain":"company-website.com","industry":"string","score":0-100,"reason":"1 sentence why they need us","matchedProducts":["slug"],"signals":["signal"],"companySize":"enterprise|mid-market|smb","urgency":"critical|high|medium|low"}]. Use slugs: antimatter-ai, atom-enterprise, vidzee, clinix-agent, clinix-ai, red-team-atom. IMPORTANT: Include the company's real website domain (e.g. "unitedhealth.com", "jpmorgan.com"). Return ONLY JSON.` }]
    });

    const content = message.content[0].type === "text" ? message.content[0].text : "";
    let prospectsList: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      prospectsList = JSON.parse(cleaned);
    } catch {
      const match = content.match(/\[[\s\S]*\]/);
      if (match) prospectsList = JSON.parse(match[0]);
    }

    // Step 2: Enrich each prospect with Hunter.io decision maker data (parallel)
    const enrichmentPromises = prospectsList.map((p: any) =>
      enrichWithHunter(p.companyName || "Unknown", p.domain)
    );
    const enrichments = await Promise.all(enrichmentPromises);

    // Step 3: Merge AI prospects with Hunter.io contacts
    const results = prospectsList.map((p: any, i: number) => {
      const hunter = enrichments[i];
      return {
        id: Date.now() + i,
        companyName: hunter.organization || p.companyName || "Unknown",
        domain: hunter.domain || p.domain || "",
        industry: p.industry || "Technology",
        score: Number(p.score) || 50,
        reason: p.reason || "",
        matchedProducts: JSON.stringify(p.matchedProducts || []),
        signals: JSON.stringify(p.signals || []),
        companySize: p.companySize || "mid-market",
        urgency: p.urgency || "medium",
        lastUpdated: new Date().toISOString(),
        status: "new",
        contacts: JSON.stringify(hunter.contacts),
      };
    });

    res.json(results);
  } catch (err: any) {
    console.error("Prospect error:", err);
    res.status(500).json({ error: err.message || "Failed" });
  }
}
