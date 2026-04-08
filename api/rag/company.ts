/**
 * RAG Company Intelligence Proxy
 * Forwards requests to the ATOM RAG microservice on Linode
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const RAG_URL = process.env.RAG_URL || "https://atom-rag.45-79-202-76.sslip.io";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  const { action } = req.query;

  try {
    let ragUrl: string;
    let ragMethod = req.method || "GET";
    let ragBody: string | undefined;

    switch (action) {
      case "load":
        ragUrl = `${RAG_URL}/company/load`;
        ragBody = JSON.stringify(req.body);
        break;
      case "status": {
        const company = req.query.company as string;
        ragUrl = `${RAG_URL}/company/${encodeURIComponent(company)}/status`;
        ragMethod = "GET";
        break;
      }
      case "context":
        ragUrl = `${RAG_URL}/company/context`;
        ragBody = JSON.stringify(req.body);
        break;
      case "pitch":
        ragUrl = `${RAG_URL}/pitch/generate`;
        ragBody = JSON.stringify(req.body);
        break;
      case "objection":
        ragUrl = `${RAG_URL}/objections/handle`;
        ragBody = JSON.stringify(req.body);
        break;
      case "companies":
        ragUrl = `${RAG_URL}/companies`;
        ragMethod = "GET";
        break;
      default:
        return res.status(400).json({ error: "Unknown action" });
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };

    const response = await fetch(ragUrl, {
      method: ragMethod,
      headers,
      body: ragBody,
      signal: AbortSignal.timeout(120000),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "RAG service unavailable" });
  }
}
