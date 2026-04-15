/**
 * ATOM Lead Gen — Voice Bridge Call Initiation
 * Routes through the Linode voice bridge for pre-warm greeting + mulaw transcoding
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const BRIDGE_URL = "https://45-79-202-76.sslip.io";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { phoneNumber, contactName, companyName, productSlug, firstName, product, to } = req.body;
    const phone = phoneNumber || to;
    if (!phone) return res.status(400).json({ error: "phoneNumber is required" });

    let cleanNumber = phone.replace(/[^\d+]/g, "");
    if (!cleanNumber.startsWith("+")) cleanNumber = "+1" + cleanNumber;

    const bridgeRes = await fetch(`${BRIDGE_URL}/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: cleanNumber,
        firstName: (contactName || firstName || "there").split(" ")[0],
        companyName: companyName || "your company",
        product: productSlug || product || "antimatter-ai",
      }),
    });

    const call = await bridgeRes.json();
    if (!bridgeRes.ok) return res.status(bridgeRes.status).json(call);

    res.json({
      success: true,
      callSid: call.callSid,
      status: "queued",
      to: cleanNumber,
      from: TWILIO_PHONE_NUMBER,
      architecture: "bridge-v7",
      message: `ADAM calling ${contactName || firstName || cleanNumber} — Bridge + Hume EVI`,
    });
  } catch (err: any) {
    console.error("Call error:", err);
    res.status(500).json({ error: err.message || "Failed to initiate call", code: err.code });
  }
}
