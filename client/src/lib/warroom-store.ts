/**
 * ATOM War Room — Shared Intelligence Layer
 * Von Clausewitz Engine's nervous system.
 *
 * Every ATOM module reads from and writes to this store.
 * Events broadcast across tabs via BroadcastChannel + localStorage.
 *
 * Architecture:
 * - Deal: central unit — contains TRUTH Score, stakeholders, signals, competitive radar
 * - Stakeholder: person on a deal with role (economic_buyer, technical, champion, blocker, ghost)
 * - Signal: company intelligence event (funding, leadership, tech_change, job_posting, news)
 * - Play: recommended action fired by trigger system
 */

export type DealStage = "discovery" | "qualified" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
export type DealRisk = "healthy" | "caution" | "at_risk" | "dead";
export type StakeholderRole = "economic_buyer" | "technical" | "champion" | "blocker" | "ghost" | "unknown";
export type ThreatLevel = "low" | "elevated" | "critical";
export type SignalType = "funding" | "leadership" | "job_posting" | "tech_change" | "news" | "contract_win" | "earnings";

export interface Stakeholder {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  role: StakeholderRole;
  engagement: number;  // 0-100
  lastTouched?: number;
  notes?: string;
}

export interface CompanySignal {
  id: string;
  type: SignalType;
  headline: string;
  date: string;
  source?: string;
  impactScore: number; // 0-10
}

export interface IntelAnalysis {
  id: string;
  text: string;
  channel: string;
  truthScore: number;
  risk: string;
  dealRisk: string;
  intent: string;
  ghostProb: number;
  competitors: string[];
  stakeholderMentions: string[];
  summary: string;
  timestamp: number;
}

export interface Play {
  id: string;
  name: string;
  trigger: string;
  tactic: string;
  urgency: "low" | "medium" | "high" | "critical";
  firedAt: number;
  acknowledged: boolean;
}

export interface Deal {
  id: string;
  company: string;
  website?: string;
  industry?: string;
  source: "manual" | "prospect" | "leadgen" | "market" | "campaign" | "warbook";
  isHVT: boolean;
  hvtFlaggedAt?: number;
  stage: DealStage;
  risk: DealRisk;

  // TRUTH Score
  truthScore: number;              // 0-100 composite conviction score
  truthHistory: { score: number; at: number }[];

  // Activity timing
  createdAt: number;
  lastBuyerActivity?: number;
  lastRepActivity?: number;

  // Stakeholders + engagement
  stakeholders: Stakeholder[];

  // Intel
  analyses: IntelAnalysis[];

  // Competitive
  competitors: string[];
  threatLevel: ThreatLevel;

  // Signals
  signals: CompanySignal[];

  // Plays fired
  plays: Play[];

  // Ghost Ops
  isGhost: boolean;
  ghostScore: number;                // 0-100 probability of re-engagement
  coldCaseReason?: string;

  // Notes
  notes?: string;
}

const DEALS_KEY = "atom_warroom_deals_v2";
const CHANNEL_NAME = "atom_warroom";

// ─── Event bus (cross-module broadcast) ──────────────────────────────────────

type EventType =
  | "deal_created"
  | "deal_updated"
  | "deal_deleted"
  | "hvt_flagged"
  | "analysis_linked"
  | "play_fired"
  | "signal_detected"
  | "stakeholder_added";

interface WarRoomEvent {
  type: EventType;
  dealId?: string;
  payload?: any;
  at: number;
}

let channel: BroadcastChannel | null = null;
try { channel = new BroadcastChannel(CHANNEL_NAME); } catch { /* no-op */ }

const listeners = new Set<(e: WarRoomEvent) => void>();

export function onWarRoomEvent(fn: (e: WarRoomEvent) => void): () => void {
  listeners.add(fn);
  const ch = channel;
  const handler = (ev: MessageEvent) => fn(ev.data);
  if (ch) ch.addEventListener("message", handler);
  return () => {
    listeners.delete(fn);
    if (ch) ch.removeEventListener("message", handler);
  };
}

function broadcast(type: EventType, dealId?: string, payload?: any) {
  const e: WarRoomEvent = { type, dealId, payload, at: Date.now() };
  listeners.forEach(fn => { try { fn(e); } catch {} });
  try { channel?.postMessage(e); } catch {}
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export function loadDeals(): Deal[] {
  try {
    const raw = localStorage.getItem(DEALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveDeals(deals: Deal[]) {
  try { localStorage.setItem(DEALS_KEY, JSON.stringify(deals)); } catch {}
}

export function getDeal(id: string): Deal | undefined {
  return loadDeals().find(d => d.id === id);
}

export function findDealByCompany(company: string): Deal | undefined {
  const needle = company.toLowerCase().trim();
  return loadDeals().find(d => d.company.toLowerCase().trim() === needle);
}

export function createDeal(init: Partial<Deal> & { company: string; source: Deal["source"] }): Deal {
  const existing = findDealByCompany(init.company);
  if (existing) return existing;

  const deal: Deal = {
    id: crypto.randomUUID(),
    company: init.company,
    website: init.website,
    industry: init.industry,
    source: init.source,
    isHVT: init.isHVT || false,
    hvtFlaggedAt: init.isHVT ? Date.now() : undefined,
    stage: init.stage || "discovery",
    risk: "healthy",
    truthScore: 50,
    truthHistory: [{ score: 50, at: Date.now() }],
    createdAt: Date.now(),
    lastBuyerActivity: undefined,
    lastRepActivity: Date.now(),
    stakeholders: init.stakeholders || [],
    analyses: [],
    competitors: [],
    threatLevel: "low",
    signals: init.signals || [],
    plays: [],
    isGhost: false,
    ghostScore: 0,
    notes: init.notes,
  };
  const deals = loadDeals();
  deals.unshift(deal);
  saveDeals(deals);
  broadcast("deal_created", deal.id, { deal });
  if (deal.isHVT) broadcast("hvt_flagged", deal.id, { deal });
  return deal;
}

export function updateDeal(id: string, patch: Partial<Deal>): Deal | undefined {
  const deals = loadDeals();
  const idx = deals.findIndex(d => d.id === id);
  if (idx === -1) return undefined;
  const prev = deals[idx];
  const next = { ...prev, ...patch };

  // Track TRUTH score history
  if (patch.truthScore !== undefined && patch.truthScore !== prev.truthScore) {
    next.truthHistory = [...prev.truthHistory, { score: patch.truthScore, at: Date.now() }].slice(-50);
  }

  deals[idx] = next;
  saveDeals(deals);
  broadcast("deal_updated", id, { deal: next, patch });
  return next;
}

export function deleteDeal(id: string): void {
  const deals = loadDeals().filter(d => d.id !== id);
  saveDeals(deals);
  broadcast("deal_deleted", id);
}

export function flagAsHVT(company: string, extras: Partial<Deal> = {}): Deal {
  const existing = findDealByCompany(company);
  if (existing) {
    const updated = updateDeal(existing.id, {
      isHVT: true,
      hvtFlaggedAt: Date.now(),
      ...extras,
    });
    if (updated) broadcast("hvt_flagged", updated.id, { deal: updated });
    return updated || existing;
  }
  return createDeal({ company, source: extras.source || "manual", isHVT: true, ...extras });
}

// ─── Link Intel Analysis to Deal ─────────────────────────────────────────────

export function linkAnalysisToDeal(
  dealId: string,
  analysis: Omit<IntelAnalysis, "id" | "timestamp">
): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const a: IntelAnalysis = { ...analysis, id: crypto.randomUUID(), timestamp: Date.now() };

  // Derive updates
  const newAnalyses = [a, ...deal.analyses].slice(0, 50);
  const newTruthScore = Math.round(a.truthScore); // Latest analysis score drives current
  const newCompetitors = Array.from(new Set([...deal.competitors, ...analysis.competitors.filter(Boolean)]));
  const newRisk: DealRisk = (analysis.dealRisk?.toLowerCase() as DealRisk) || deal.risk;
  const newThreat: ThreatLevel = newCompetitors.length > 0
    ? (analysis.risk?.toLowerCase() === "high" ? "critical" : "elevated")
    : "low";
  const newIsGhost = analysis.ghostProb > 60;
  const newGhostScore = analysis.ghostProb > 40 ? 100 - analysis.ghostProb : deal.ghostScore;

  // Add stakeholders from mentions (basic)
  const existingNames = new Set(deal.stakeholders.map(s => s.name.toLowerCase()));
  const newStakeholders = [...deal.stakeholders];
  (analysis.stakeholderMentions || []).forEach(name => {
    if (name && !existingNames.has(name.toLowerCase())) {
      newStakeholders.push({
        id: crypto.randomUUID(),
        name,
        role: "unknown",
        engagement: 50,
        lastTouched: Date.now(),
      });
    }
  });

  const updated = updateDeal(dealId, {
    analyses: newAnalyses,
    truthScore: newTruthScore,
    competitors: newCompetitors,
    risk: newRisk,
    threatLevel: newThreat,
    isGhost: newIsGhost,
    ghostScore: newGhostScore,
    stakeholders: newStakeholders,
    lastBuyerActivity: Date.now(),
  });

  broadcast("analysis_linked", dealId, { analysis: a });
  return updated;
}

// ─── Stakeholders ────────────────────────────────────────────────────────────

export function addStakeholder(dealId: string, s: Omit<Stakeholder, "id">): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const stakeholder: Stakeholder = { ...s, id: crypto.randomUUID() };
  const updated = updateDeal(dealId, { stakeholders: [...deal.stakeholders, stakeholder] });
  broadcast("stakeholder_added", dealId, { stakeholder });
  return updated;
}

export function updateStakeholder(dealId: string, stakeholderId: string, patch: Partial<Stakeholder>): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  return updateDeal(dealId, {
    stakeholders: deal.stakeholders.map(s => s.id === stakeholderId ? { ...s, ...patch } : s),
  });
}

export function removeStakeholder(dealId: string, stakeholderId: string): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  return updateDeal(dealId, { stakeholders: deal.stakeholders.filter(s => s.id !== stakeholderId) });
}

// ─── Signals ─────────────────────────────────────────────────────────────────

export function addSignal(dealId: string, signal: Omit<CompanySignal, "id">): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const s: CompanySignal = { ...signal, id: crypto.randomUUID() };
  const updated = updateDeal(dealId, { signals: [s, ...deal.signals].slice(0, 30) });
  broadcast("signal_detected", dealId, { signal: s });
  return updated;
}

// ─── Plays (Trigger System) ──────────────────────────────────────────────────

export function firePlay(dealId: string, play: Omit<Play, "id" | "firedAt" | "acknowledged">): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  const p: Play = { ...play, id: crypto.randomUUID(), firedAt: Date.now(), acknowledged: false };
  const updated = updateDeal(dealId, { plays: [p, ...deal.plays].slice(0, 30) });
  broadcast("play_fired", dealId, { play: p });
  return updated;
}

export function acknowledgePlay(dealId: string, playId: string): Deal | undefined {
  const deal = getDeal(dealId);
  if (!deal) return undefined;
  return updateDeal(dealId, {
    plays: deal.plays.map(p => p.id === playId ? { ...p, acknowledged: true } : p),
  });
}

// ─── Multithreading meter ────────────────────────────────────────────────────

export function multithreadingScore(deal: Deal): { engaged: number; required: number; fragile: boolean } {
  const engaged = deal.stakeholders.filter(s => s.engagement >= 50 && s.role !== "ghost").length;
  // Required stakeholders scale with stage
  const required = deal.stage === "discovery" ? 2 : deal.stage === "qualified" ? 3 : deal.stage === "proposal" ? 4 : 5;
  return { engaged, required, fragile: engaged < required };
}

// ─── Stall detection ─────────────────────────────────────────────────────────

export function stallDays(deal: Deal): number {
  const last = deal.lastBuyerActivity || deal.createdAt;
  return Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
}

// ─── Stage lock ──────────────────────────────────────────────────────────────

export function canAdvanceStage(deal: Deal, toStage: DealStage): { allowed: boolean; reason?: string } {
  if (toStage === "qualified" && deal.stakeholders.length < 1) {
    return { allowed: false, reason: "Need at least 1 stakeholder identified" };
  }
  if (toStage === "proposal" && deal.stakeholders.length < 2) {
    return { allowed: false, reason: "Need at least 2 stakeholders (multithreading)" };
  }
  if (toStage === "proposal" && deal.analyses.length < 1) {
    return { allowed: false, reason: "Need at least 1 Intel Analyzer run on this deal" };
  }
  if (toStage === "negotiation" && deal.truthScore < 50) {
    return { allowed: false, reason: `TRUTH Score ${deal.truthScore} below threshold (50) — deal not qualified` };
  }
  return { allowed: true };
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export function dealStats() {
  const deals = loadDeals();
  const hvt = deals.filter(d => d.isHVT).length;
  const ghosts = deals.filter(d => d.isGhost).length;
  const highTruth = deals.filter(d => d.truthScore >= 70).length;
  const atRisk = deals.filter(d => d.risk === "at_risk" || d.risk === "dead").length;
  const avgTruth = deals.length > 0 ? Math.round(deals.reduce((s, d) => s + d.truthScore, 0) / deals.length) : 0;
  const openPlays = deals.flatMap(d => d.plays).filter(p => !p.acknowledged).length;
  return { total: deals.length, hvt, ghosts, highTruth, atRisk, avgTruth, openPlays };
}
