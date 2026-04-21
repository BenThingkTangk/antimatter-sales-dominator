import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Eye,
  Shield,
  Brain,
  AlertTriangle,
  Target,
  Zap,
  MessageSquare,
  Mail,
  Clock,
  TrendingUp,
  ChevronRight,
  Mic,
  History,
  Loader2,
  Linkedin,
  Copy,
  CheckCircle2,
  Trash2,
  BarChart3,
  AlertCircle,
  ArrowRight,
  Crosshair,
  Ghost,
  Flame,
  Lightbulb,
  BookOpen,
  X,
  Swords,
  Activity,
  Signal,
  Users,
  FileText,
  Radio,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "intel" | "pipeline" | "playbook" | "history" | "ghostops";
type ChannelId = "email" | "call_transcript" | "sms" | "linkedin";

interface Flag {
  type: string;
  severity: "high" | "medium" | "low";
  phrase: string;
  explanation: string;
}

interface HighlightedPhrase {
  phrase: string;
  color: "red" | "amber" | "green";
  reason: string;
}

interface DeceptionLayer {
  hedgePct: number;
  evasionPct: number;
  stallProbability: number;
  authorityDeflection: number;
  budgetFabrication: number;
  timelineVagueness: number;
  overEnthusiasm: number;
}

interface LinguisticCues {
  passiveVoice: number;
  distancingLanguage: number;
  overCertainty: number;
  nonAnswerRatio: number;
  commitmentLanguage: number;
  implementationLanguage: number;
  urgencyLanguage: number;
}

interface NegotiationPosture {
  powerScore: number;
  urgencyScore: number;
  commitmentScore: number;
  concessionPattern: string;
  leveragePosition: string;
}

interface CompetitiveRadar {
  competitorMentioned: boolean;
  competitors: string[];
  competitiveRiskLevel: string;
  competitiveTalkingPoints: string[];
}

interface IntentSignal {
  signal: string;
  type: string;
  strength: "strong" | "moderate" | "weak";
}

interface Playbook {
  move: string;
  tactic: string;
  signal: string;
  nextBestActions?: string[];
}

interface GhostResurrection {
  isGhosted: boolean;
  reEngagementMessage: string;
  reEngagementStrategy: string;
}

interface AnalysisResult {
  truthScore: number;
  // fallback for older field name
  aletheiaTruthScore?: number;
  overallRisk: string;
  dealRisk: string;
  urgency: string;
  deceptionLayer: DeceptionLayer;
  flags: Flag[];
  highlightedPhrases: HighlightedPhrase[];
  linguisticCues: LinguisticCues;
  negotiationPosture: NegotiationPosture;
  competitiveRadar: CompetitiveRadar;
  intentSignals: IntentSignal[];
  buyerIntentState: string;
  ghostProbability: number;
  suggestedReplies: string[];
  playbook: Playbook;
  ghostResurrection: GhostResurrection;
  summary: string;
  channel: string;
  analyzedAt: string;
}

interface HistoryEntry {
  id: string;
  text: string;
  channel: ChannelId;
  result: AnalysisResult;
  timestamp: number;
}

interface DealEntry {
  id: string;
  company: string;
  contact: string;
  notes: string;
  truthScore: number;
  risk: string;
  intent: string;
  lastAnalyzed: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HISTORY_KEY = "atom_warroom_history";
const DEALS_KEY = "atom_warroom_deals";

const CHANNELS: { id: ChannelId; label: string; icon: any }[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "call_transcript", label: "Call Transcript", icon: Mic },
  { id: "sms", label: "SMS/Text", icon: MessageSquare },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
];

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "intel", label: "Intel Analyzer", icon: Eye },
  { id: "pipeline", label: "Deal Pipeline", icon: BarChart3 },
  { id: "playbook", label: "Playbook Engine", icon: BookOpen },
  { id: "history", label: "War History", icon: History },
  { id: "ghostops", label: "Ghost Ops", icon: Ghost },
];

const SAMPLE_EMAIL = `Hi,\n\nThank you for the proposal. The team believes there is a strong fit. However, due to some internal reprioritization we need to pause the evaluation for now. We would love to revisit in a few months when things settle down. Definitely keeping you top of mind.\n\nBest,\nJames`;
const SAMPLE_TRANSCRIPT = `Yeah absolutely, we're very interested. The CEO is very bullish on this. It's definitely a top priority for us right now. We just need to circle back after next quarter when things settle down. Our VP of Engineering thinks it's a strong fit but we have some internal reprioritization happening. We'll definitely get back to you soon — no question about it.`;
const SAMPLE_SMS = `Hey, just wanted to check in. We are still very interested but the decision has been pushed to next quarter. Our CEO is very bullish on this and thinks it's a great fit. We will definitely circle back soon.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveHistory(h: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 50))); } catch {}
}
function loadDeals(): DealEntry[] {
  try { return JSON.parse(localStorage.getItem(DEALS_KEY) || "[]"); } catch { return []; }
}
function saveDeals(d: DealEntry[]) {
  try { localStorage.setItem(DEALS_KEY, JSON.stringify(d)); } catch {}
}

function fmtTime(ts: number): string {
  if (!ts) return "—";
  const h = (Date.now() - ts) / 3.6e6;
  if (h < 1) { const m = Math.floor((Date.now() - ts) / 60000); return m <= 1 ? "just now" : `${m}m ago`; }
  if (h < 24) return `${Math.floor(h)}h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTruthScore(r: AnalysisResult): number {
  return r.truthScore ?? r.aletheiaTruthScore ?? 0;
}

const riskColor = (r: string) => {
  const l = r?.toLowerCase();
  if (l === "high" || l === "ghost" || l === "dead" || l === "at_risk") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (l === "medium" || l === "caution") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
};
const sevColor = (s: string) => s === "high" ? "text-rose-400" : s === "medium" ? "text-amber-400" : "text-emerald-400";
const scoreColor = (n: number) => n >= 70 ? "#1dd1a1" : n >= 40 ? "#fbbf24" : "#f87171";
const intentLabel = (s: string) => (s || "unknown").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
const phraseColor = (c: string) => c === "red" ? "bg-rose-500/20 border-rose-500/30 text-rose-300" : c === "amber" ? "bg-amber-500/20 border-amber-500/30 text-amber-300" : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300";
const strengthColor = (s: string) => s === "strong" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : s === "moderate" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-white/5 text-white/40 border-white/10";

// ─── Shared UI Components ─────────────────────────────────────────────────────

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] font-mono uppercase tracking-wider text-white/25">{children}</span>;
}

function TruthGauge({ score }: { score: number }) {
  const r = 50, c = 2 * Math.PI * r, filled = (score / 100) * c;
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
          </defs>
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
          <circle
            cx="64" cy="64" r={r} fill="none"
            stroke={score >= 70 ? "#1dd1a1" : score >= 40 ? "#fbbf24" : "url(#gaugeGrad)"}
            strokeWidth="10"
            strokeDasharray={`${filled} ${c - filled}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>{score}</span>
          <span className="text-[10px] text-white/30 font-mono">/100</span>
        </div>
      </div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">Truth Score™</p>
    </div>
  );
}

function SmallScoreCircle({ score }: { score: number }) {
  const color = scoreColor(score);
  return (
    <div className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-bold shrink-0 tabular-nums"
      style={{ background: `rgba(${score >= 70 ? "29,209,161" : score >= 40 ? "251,191,36" : "220,38,38"},0.12)`, color, border: `1.5px solid ${color}40` }}>
      {score || "—"}
    </div>
  );
}

function MiniBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/40 font-mono truncate pr-2">{label}</span>
        <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

// ─── CRIMSON Button style ─────────────────────────────────────────────────────

const CRIMSON_BTN_STYLE = {
  background: "linear-gradient(93.92deg, #f87171 -13.51%, #dc2626 40.91%, #b91c1c 113.69%)",
  boxShadow: "0 0 15px rgba(220,38,38,0.4), inset 0 0 2px rgba(255,255,255,0.3)",
  color: "#fff",
};

// ─── Intel Analyzer Tab ───────────────────────────────────────────────────────

function IntelAnalyzerTab({
  initialText,
  initialChannel,
}: {
  initialText?: string;
  initialChannel?: ChannelId;
}) {
  const { toast } = useToast();
  const [text, setText] = useState(initialText || "");
  const [channel, setChannel] = useState<ChannelId>(initialChannel || "email");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [copiedReply, setCopiedReply] = useState<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  async function handleAnalyze() {
    if (!text.trim() || text.trim().length < 10) {
      toast({ title: "Text too short", description: "Paste at least a few sentences to analyze.", variant: "destructive" });
      return;
    }
    setIsAnalyzing(true);
    setResult(null);
    try {
      const res = await apiRequest("POST", "/api/aletheia/analyze-text", { text: text.trim(), channel });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
      const score = getTruthScore(data);
      const entry: HistoryEntry = { id: crypto.randomUUID(), text: text.trim(), channel, result: data, timestamp: Date.now() };
      const hist = loadHistory();
      hist.unshift(entry);
      saveHistory(hist);
      toast({ title: "Von Clausewitz Analysis Complete", description: `TRUTH Score™: ${score}/100 · Risk: ${data.overallRisk}` });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message || "Could not analyze text.", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  }

  function loadSample(sample: string, ch: ChannelId) {
    setText(sample);
    setChannel(ch);
    setResult(null);
    setTimeout(() => textRef.current?.focus(), 50);
  }

  function copyReply(reply: string, idx: number) {
    navigator.clipboard.writeText(reply);
    setCopiedReply(idx);
    setTimeout(() => setCopiedReply(null), 2000);
  }

  const score = result ? getTruthScore(result) : 0;

  return (
    <div className="space-y-5 fade-in">
      {/* Input Card */}
      <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
        {/* Channel Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <MonoLabel>Channel:</MonoLabel>
          {CHANNELS.map(ch => {
            const Icon = ch.icon;
            const active = channel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setChannel(ch.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                style={{
                  background: active ? "rgba(220,38,38,0.10)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#f87171" : "rgba(255,255,255,0.35)",
                }}
              >
                <Icon size={12} />{ch.label}
              </button>
            );
          })}
        </div>

        {/* Textarea */}
        <textarea
          ref={textRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste an email, call transcript, SMS, or LinkedIn message to deploy the Von Clausewitz Engine..."
          className="w-full h-44 rounded-lg p-4 text-[13px] text-[#f6f6fd] placeholder-white/20 outline-none resize-y leading-relaxed"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          }}
        />

        {/* Actions Row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MonoLabel>Try sample:</MonoLabel>
            <button onClick={() => loadSample(SAMPLE_EMAIL, "email")} className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-white/30 hover:text-white/60 bg-white/[0.02] transition-all">Email</button>
            <button onClick={() => loadSample(SAMPLE_TRANSCRIPT, "call_transcript")} className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-white/30 hover:text-white/60 bg-white/[0.02] transition-all">Call Transcript</button>
            <button onClick={() => loadSample(SAMPLE_SMS, "sms")} className="text-[10px] px-2 py-1 rounded border border-white/[0.08] text-white/30 hover:text-white/60 bg-white/[0.02] transition-all">SMS</button>
            {text && (
              <button onClick={() => { setText(""); setResult(null); }} className="text-[10px] px-2 py-1 rounded border border-white/[0.06] text-white/20 hover:text-white/40 bg-white/[0.01] transition-all flex items-center gap-1">
                <X size={9} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Deploy Button — full width */}
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || text.trim().length < 10}
          className="w-full py-3.5 rounded-full font-semibold text-[14px] flex items-center justify-center gap-2 transition-all hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={CRIMSON_BTN_STYLE}
        >
          {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Swords size={16} />}
          {isAnalyzing ? "Deploying Von Clausewitz Engine..." : "Deploy Von Clausewitz"}
        </button>
      </div>

      {/* Loading State */}
      {isAnalyzing && (
        <div className="rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/[0.04] to-transparent p-5 flex items-center gap-3 fade-in">
          <div className="relative w-5 h-5 shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-red-400/30" />
            <div className="absolute inset-0 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
          </div>
          <span className="text-[13px] font-mono" style={{ color: "rgba(248,113,113,0.8)" }}>
            Von Clausewitz scanning for deception patterns, behavioral signals, competitive intelligence...
          </span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4 fade-in">

          {/* Score + Badges + Summary */}
          <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-6">
            <div className="flex items-start gap-6 flex-wrap">
              <TruthGauge score={score} />
              <div className="flex-1 min-w-[260px] space-y-4">
                {/* Risk / Deal / Intent / Ghost badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] font-mono ${riskColor(result.overallRisk)}`}>Risk: {result.overallRisk}</Badge>
                  <Badge className={`text-[10px] font-mono ${riskColor(result.dealRisk)}`}>Deal: {result.dealRisk?.replace(/_/g, " ")}</Badge>
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-mono">
                    Intent: {intentLabel(result.buyerIntentState)}
                  </Badge>
                  {result.ghostProbability > 40 && (
                    <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/25 text-[10px] font-mono gap-1">
                      <Ghost size={9} />Ghost: {result.ghostProbability}%
                    </Badge>
                  )}
                  <Badge className="bg-white/[0.05] text-white/30 border-white/[0.08] text-[10px] font-mono">
                    Urgency: {result.urgency}
                  </Badge>
                </div>

                {/* Summary */}
                <p className="text-[13px] text-white/60 leading-relaxed">{result.summary}</p>
              </div>
            </div>
          </div>

          {/* Two-column grid: Deception Layer + Linguistic Cues */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deception Layer */}
            {result.deceptionLayer && (
              <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-rose-400" />
                  <MonoLabel>Deception Layer</MonoLabel>
                </div>
                <div className="space-y-2.5">
                  <MiniBar label="Hedge %" value={result.deceptionLayer.hedgePct} color="#f87171" />
                  <MiniBar label="Evasion %" value={result.deceptionLayer.evasionPct} color="#f87171" />
                  <MiniBar label="Stall Probability" value={result.deceptionLayer.stallProbability} color="#fbbf24" />
                  <MiniBar label="Authority Deflection" value={result.deceptionLayer.authorityDeflection} color="#fb923c" />
                  <MiniBar label="Budget Fabrication" value={result.deceptionLayer.budgetFabrication} color="#f87171" />
                  <MiniBar label="Timeline Vagueness" value={result.deceptionLayer.timelineVagueness} color="#fbbf24" />
                  <MiniBar label="Over-Enthusiasm" value={result.deceptionLayer.overEnthusiasm} color="#c084fc" />
                </div>
              </div>
            )}

            {/* Linguistic Cues */}
            {result.linguisticCues && (
              <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText size={13} className="text-blue-400" />
                  <MonoLabel>Linguistic Cues</MonoLabel>
                </div>
                <div className="space-y-2.5">
                  <MiniBar label="Passive Voice" value={result.linguisticCues.passiveVoice} color="#818cf8" />
                  <MiniBar label="Distancing Language" value={result.linguisticCues.distancingLanguage} color="#f87171" />
                  <MiniBar label="Over-Certainty" value={result.linguisticCues.overCertainty} color="#fbbf24" />
                  <MiniBar label="Non-Answer Ratio" value={result.linguisticCues.nonAnswerRatio} color="#f87171" />
                  <MiniBar label="Commitment Language" value={result.linguisticCues.commitmentLanguage} color="#34d399" />
                  <MiniBar label="Implementation Language" value={result.linguisticCues.implementationLanguage} color="#34d399" />
                  <MiniBar label="Urgency Language" value={result.linguisticCues.urgencyLanguage} color="#fbbf24" />
                </div>
              </div>
            )}
          </div>

          {/* Negotiation Posture */}
          {result.negotiationPosture && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Crosshair size={13} className="text-amber-400" />
                <MonoLabel>Negotiation Posture</MonoLabel>
                <div className="ml-auto flex items-center gap-2">
                  <Badge className="bg-white/[0.05] text-white/35 border-white/[0.08] text-[9px] font-mono">
                    Concession: {(result.negotiationPosture.concessionPattern || "").replace(/_/g, " ")}
                  </Badge>
                  <Badge className={`text-[9px] font-mono ${result.negotiationPosture.leveragePosition === "strong" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : result.negotiationPosture.leveragePosition === "weak" ? "bg-rose-500/15 text-rose-400 border-rose-500/25" : "bg-amber-500/15 text-amber-400 border-amber-500/25"}`}>
                    Leverage: {result.negotiationPosture.leveragePosition}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MiniBar label="Power Score" value={result.negotiationPosture.powerScore} color="#dc2626" />
                <MiniBar label="Urgency Score" value={result.negotiationPosture.urgencyScore} color="#fbbf24" />
                <MiniBar label="Commitment Score" value={result.negotiationPosture.commitmentScore} color="#34d399" />
              </div>
            </div>
          )}

          {/* Competitive Radar */}
          {result.competitiveRadar && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Radio size={13} className="text-cyan-400" />
                <MonoLabel>Competitive Radar</MonoLabel>
                <Badge className={`ml-auto text-[9px] font-mono ${result.competitiveRadar.competitiveRiskLevel === "critical" ? "bg-rose-500/15 text-rose-400 border-rose-500/25" : result.competitiveRadar.competitiveRiskLevel === "elevated" ? "bg-amber-500/15 text-amber-400 border-amber-500/25" : "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"}`}>
                  {result.competitiveRadar.competitiveRiskLevel?.toUpperCase()} RISK
                </Badge>
              </div>
              {result.competitiveRadar.competitorMentioned && result.competitiveRadar.competitors?.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MonoLabel>Competitors detected:</MonoLabel>
                    {result.competitiveRadar.competitors.map((c, i) => (
                      <Badge key={i} className="bg-rose-500/10 text-rose-300 border-rose-500/20 text-[10px]">{c}</Badge>
                    ))}
                  </div>
                  {result.competitiveRadar.competitiveTalkingPoints?.length > 0 && (
                    <div className="space-y-1.5">
                      <MonoLabel>Counter-talking points:</MonoLabel>
                      {result.competitiveRadar.competitiveTalkingPoints.map((tp, i) => (
                        <div key={i} className="flex items-start gap-2 pl-1">
                          <ChevronRight size={11} className="text-cyan-400 mt-0.5 shrink-0" />
                          <p className="text-[12px] text-white/50">{tp}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[12px] text-white/30 font-mono">No competitors detected in this communication.</p>
              )}
            </div>
          )}

          {/* Flags */}
          {result.flags?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={13} className="text-amber-400" />
                <MonoLabel>Deception Flags ({result.flags.length})</MonoLabel>
              </div>
              <div className="space-y-2">
                {result.flags.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <AlertCircle size={12} className={`mt-0.5 shrink-0 ${sevColor(f.severity)}`} />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[9px] font-mono ${riskColor(f.severity)}`}>{f.severity.toUpperCase()}</Badge>
                        <span className="text-[10px] text-white/25 font-mono">{f.type.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-[12px] text-white/60">"{f.phrase}"</p>
                      <p className="text-[11px] text-white/35">{f.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intent Signals */}
          {result.intentSignals?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Signal size={13} className="text-emerald-400" />
                <MonoLabel>Intent Signals ({result.intentSignals.length})</MonoLabel>
              </div>
              <div className="space-y-2">
                {result.intentSignals.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[9px] font-mono ${strengthColor(s.strength)}`}>{s.strength}</Badge>
                        <span className="text-[10px] text-white/25 font-mono">{s.type.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-[12px] text-white/60">"{s.signal}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Highlighted Phrases */}
          {result.highlightedPhrases?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Eye size={13} className="text-violet-400" />
                <MonoLabel>Highlighted Phrases</MonoLabel>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.highlightedPhrases.map((hp, i) => (
                  <div key={i} className={`px-3 py-1.5 rounded-lg border text-[11px] ${phraseColor(hp.color)}`} title={hp.reason}>
                    <span className="font-medium">"{hp.phrase}"</span>
                    <span className="text-white/30 ml-1.5">— {hp.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Playbook Move */}
          {result.playbook && (
            <div className="rounded-xl border border-red-500/20 bg-gradient-to-br from-red-500/[0.06] to-transparent p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Swords size={13} className="text-red-400" />
                <MonoLabel>Playbook Move</MonoLabel>
                <Badge className="ml-auto bg-red-500/15 text-red-400 border-red-500/25 text-[9px] font-mono">{result.playbook.move}</Badge>
              </div>
              <div className="space-y-2 pl-1">
                <div className="flex items-start gap-2">
                  <Target size={11} className="text-red-400/60 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-white/25 font-mono mb-0.5">TACTIC</p>
                    <p className="text-[13px] text-white/70">{result.playbook.tactic}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Activity size={11} className="text-amber-400/60 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-white/25 font-mono mb-0.5">SIGNAL READS</p>
                    <p className="text-[13px] text-white/60">{result.playbook.signal}</p>
                  </div>
                </div>
                {result.playbook.nextBestActions && result.playbook.nextBestActions.length > 0 && (
                  <div className="flex items-start gap-2">
                    <ArrowRight size={11} className="text-emerald-400/60 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-white/25 font-mono mb-1">NEXT BEST ACTIONS</p>
                      <div className="space-y-1">
                        {result.playbook.nextBestActions.map((a, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <ChevronRight size={10} className="text-emerald-400 mt-0.5 shrink-0" />
                            <p className="text-[12px] text-white/55">{a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Suggested Replies */}
          {result.suggestedReplies?.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-[#111113] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={13} className="text-blue-400" />
                <MonoLabel>Suggested Replies</MonoLabel>
              </div>
              <div className="space-y-3">
                {result.suggestedReplies.map((reply, i) => (
                  <div key={i} className="relative group rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
                    <p className="text-[13px] text-white/65 leading-relaxed pr-8">{reply}</p>
                    <button
                      onClick={() => copyReply(reply, i)}
                      className="absolute top-3 right-3 p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100"
                      style={{ background: "rgba(255,255,255,0.05)" }}
                    >
                      {copiedReply === i ? (
                        <CheckCircle2 size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} className="text-white/30" />
                      )}
                    </button>
                    <div className="mt-2 flex items-center gap-1">
                      <span className="text-[9px] font-mono text-white/20">REPLY {i + 1}</span>
                      {copiedReply === i && <span className="text-[9px] font-mono text-emerald-400">Copied!</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ghost Resurrection */}
          {result.ghostResurrection?.isGhosted && (
            <div className="rounded-xl border border-rose-500/25 bg-gradient-to-br from-rose-500/[0.07] to-transparent p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Ghost size={14} className="text-rose-400" />
                <MonoLabel>Ghost Resurrection Protocol</MonoLabel>
                <Badge className="ml-auto bg-rose-500/15 text-rose-400 border-rose-500/25 text-[9px] font-mono">
                  {result.ghostResurrection.reEngagementStrategy}
                </Badge>
              </div>
              <div className="rounded-lg border border-rose-500/15 bg-rose-500/[0.04] p-4">
                <p className="text-[10px] font-mono text-white/25 mb-2">RE-ENGAGEMENT MESSAGE</p>
                <p className="text-[13px] text-white/70 leading-relaxed italic">"{result.ghostResurrection.reEngagementMessage}"</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(result.ghostResurrection.reEngagementMessage);
                  toast({ title: "Copied!", description: "Re-engagement message copied to clipboard." });
                }}
                className="flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-all"
              >
                <Copy size={11} /> Copy Message
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Deal Pipeline Tab ────────────────────────────────────────────────────────

function DealPipelineTab() {
  const { toast } = useToast();
  const [deals, setDeals] = useState<DealEntry[]>(() => loadDeals());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ company: "", contact: "", notes: "" });

  const history = loadHistory();

  const dealsWithScores = deals.map(d => {
    const matches = history.filter(h => h.text.toLowerCase().includes(d.company.toLowerCase()) || d.company.toLowerCase().includes(h.text.toLowerCase().slice(0, 20)));
    const latest = matches[0];
    if (latest) {
      const score = getTruthScore(latest.result);
      return { ...d, truthScore: score, risk: latest.result.overallRisk, intent: latest.result.buyerIntentState, lastAnalyzed: latest.timestamp };
    }
    return { ...d, truthScore: d.truthScore || 0, risk: d.risk || "—", intent: d.intent || "—", lastAnalyzed: d.lastAnalyzed || 0 };
  });

  function addDeal() {
    if (!form.company.trim()) return;
    const entry: DealEntry = { id: crypto.randomUUID(), company: form.company.trim(), contact: form.contact.trim(), notes: form.notes.trim(), truthScore: 0, risk: "—", intent: "—", lastAnalyzed: 0 };
    const updated = [entry, ...deals];
    setDeals(updated);
    saveDeals(updated);
    setForm({ company: "", contact: "", notes: "" });
    setShowForm(false);
    toast({ title: "Deal Added", description: `${form.company} added to pipeline.` });
  }

  function removeDeal(id: string) {
    const updated = deals.filter(d => d.id !== id);
    setDeals(updated);
    saveDeals(updated);
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Header + Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-red-400" />
          <MonoLabel>Active Deals ({deals.length})</MonoLabel>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold transition-all hover:scale-[1.02]"
          style={CRIMSON_BTN_STYLE}
        >
          {showForm ? <X size={13} /> : <Users size={13} />}
          {showForm ? "Cancel" : "Track Deal"}
        </button>
      </div>

      {/* Add Deal Form */}
      {showForm && (
        <div className="rounded-xl border border-red-500/20 bg-[#111113] p-4 space-y-3 fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.company}
              onChange={e => setForm({ ...form, company: e.target.value })}
              placeholder="Company name *"
              className="px-3 py-2 rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/20 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            />
            <input
              value={form.contact}
              onChange={e => setForm({ ...form, contact: e.target.value })}
              placeholder="Contact name"
              className="px-3 py-2 rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/20 outline-none"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            />
          </div>
          <input
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes (optional)"
            className="w-full px-3 py-2 rounded-lg text-[13px] text-[#f6f6fd] placeholder-white/20 outline-none"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          />
          <button
            onClick={addDeal}
            disabled={!form.company.trim()}
            className="px-5 py-2 rounded-full text-[12px] font-semibold disabled:opacity-40 transition-all hover:scale-[1.01]"
            style={CRIMSON_BTN_STYLE}
          >
            Add to Pipeline
          </button>
        </div>
      )}

      {/* Deals List */}
      {dealsWithScores.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <BarChart3 className="w-12 h-12 text-white/10 mb-3" />
          <p className="text-sm text-white/30">No deals tracked yet</p>
          <p className="text-[12px] text-white/20 mt-1">Click "Track Deal" to add deals and monitor their TRUTH scores.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {dealsWithScores.map(d => (
            <div key={d.id} className="flex items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#111113] hover:border-red-500/15 transition-all group">
              <SmallScoreCircle score={d.truthScore} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#f6f6fd] truncate">{d.company}</p>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {d.contact && <span className="text-[11px] text-white/35">{d.contact}</span>}
                  {d.risk !== "—" && <Badge className={`text-[9px] font-mono ${riskColor(d.risk)}`}>{d.risk}</Badge>}
                  {d.intent !== "—" && <span className="text-[10px] text-white/20 font-mono">{intentLabel(d.intent)}</span>}
                  {d.notes && <span className="text-[10px] text-white/20 truncate max-w-[120px]">{d.notes}</span>}
                </div>
              </div>
              <span className="text-[10px] text-white/20 font-mono shrink-0">{fmtTime(d.lastAnalyzed)}</span>
              <button
                onClick={() => removeDeal(d.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-white/5"
              >
                <Trash2 size={13} className="text-white/20 hover:text-rose-400" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Playbook Engine Tab ──────────────────────────────────────────────────────

const PLAYBOOK_PATTERNS = [
  {
    pattern: "Timeline Vagueness",
    icon: Clock,
    accent: "text-amber-400",
    accentBg: "rgba(251,191,36,0.08)",
    accentBorder: "rgba(251,191,36,0.2)",
    signals: ['"Next quarter"', '"When things settle down"', '"Circle back in a few months"'],
    counter: 'Pin to a specific date: "Got it — if I block 15 minutes on [specific date] to revisit, does that work?" Forces commitment or surfaces the real objection.',
  },
  {
    pattern: "Authority Deflection",
    icon: Shield,
    accent: "text-rose-400",
    accentBg: "rgba(244,63,94,0.08)",
    accentBorder: "rgba(244,63,94,0.2)",
    signals: ['"Need to check with my boss"', '"CEO has to approve"', '"Not my decision"'],
    counter: 'Go multi-threaded: "Totally understand — would it help if I sent a one-pager directly to [name]? Sometimes that speeds things up."',
  },
  {
    pattern: "Over-Enthusiasm",
    icon: Flame,
    accent: "text-violet-400",
    accentBg: "rgba(139,92,246,0.08)",
    accentBorder: "rgba(139,92,246,0.2)",
    signals: ['"Absolutely love it"', '"Definitely a strong fit"', '"100% on board"'],
    counter: 'Test sincerity: "Great to hear! Should we get the contract over today so you can start next week?" Watch for backpedaling.',
  },
  {
    pattern: "Budget Fabrication",
    icon: BarChart3,
    accent: "text-cyan-400",
    accentBg: "rgba(34,211,238,0.08)",
    accentBorder: "rgba(34,211,238,0.2)",
    signals: ['"Budget is tight"', '"Need to find the budget"', '"Not in this cycle"'],
    counter: 'Isolate the objection: "If budget weren\'t a factor, would this be a priority right now?" Separates real budget issues from polite declines.',
  },
  {
    pattern: "Ghosting Signals",
    icon: Ghost,
    accent: "text-rose-400",
    accentBg: "rgba(244,63,94,0.08)",
    accentBorder: "rgba(244,63,94,0.2)",
    signals: ["Decreasing response times", "Shorter messages", "Delegating to junior contacts"],
    counter: 'Pattern interrupt: Send something unexpected — a competitor insight, a relevant article, or a direct "Is this dead?" text. Honesty resets the dynamic.',
  },
  {
    pattern: "Competitive Leverage",
    icon: Target,
    accent: "text-emerald-400",
    accentBg: "rgba(52,211,153,0.08)",
    accentBorder: "rgba(52,211,153,0.2)",
    signals: ['"Also looking at [competitor]"', '"Your pricing is higher"', '"They offered us X"'],
    counter: 'Don\'t discount immediately. Instead: "What specifically about [competitor] appeals to you?" Understand the real criteria first.',
  },
  {
    pattern: "Internal Reprioritization",
    icon: Brain,
    accent: "text-violet-400",
    accentBg: "rgba(139,92,246,0.08)",
    accentBorder: "rgba(139,92,246,0.2)",
    signals: ['"Restructuring"', '"New leadership"', '"Strategic shift happening"'],
    counter: 'Validate and reframe: "That makes sense. When orgs go through that, [specific pain] usually gets worse. Is that something you\'re seeing?"',
  },
  {
    pattern: "Fake Objection",
    icon: AlertTriangle,
    accent: "text-amber-400",
    accentBg: "rgba(251,191,36,0.08)",
    accentBorder: "rgba(251,191,36,0.2)",
    signals: ["Surface-level concerns that shift each conversation", "New objection every call", '"We just need to think about it"'],
    counter: 'Call it out gently: "I\'ve noticed the concern has shifted a few times. Help me understand — what\'s the real blocker here?" Reps respect directness.',
  },
];

function PlaybookEngineTab() {
  return (
    <div className="space-y-3 fade-in">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen size={14} className="text-red-400" />
        <MonoLabel>Deception Pattern Playbook</MonoLabel>
        <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-mono ml-auto">{PLAYBOOK_PATTERNS.length} patterns</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PLAYBOOK_PATTERNS.map((p, i) => {
          const Icon = p.icon;
          return (
            <div key={i} className="rounded-xl border bg-[#111113] p-5 space-y-3 hover:border-white/[0.12] transition-all" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {/* Header */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: p.accentBg, border: `1px solid ${p.accentBorder}` }}>
                  <Icon size={14} className={p.accent} />
                </div>
                <span className="text-[13px] font-semibold text-[#f6f6fd]">{p.pattern}</span>
              </div>
              {/* Signal phrases */}
              <div className="space-y-1">
                <MonoLabel>Signal phrases:</MonoLabel>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {p.signals.map((s, j) => (
                    <span key={j} className="text-[10px] px-2 py-1 rounded border bg-amber-500/10 border-amber-500/20 text-amber-300 font-mono">{s}</span>
                  ))}
                </div>
              </div>
              {/* Counter-strategy */}
              <div className="space-y-1">
                <MonoLabel>Counter-strategy:</MonoLabel>
                <div className="flex items-start gap-2 mt-1">
                  <Zap size={10} className="text-emerald-400/60 mt-0.5 shrink-0" />
                  <p className="text-[12px] text-white/55">{p.counter}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── War History Tab ──────────────────────────────────────────────────────────

function WarHistoryTab({ onReanalyze }: { onReanalyze: (text: string, channel: ChannelId) => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  function remove(id: string) {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
  }

  const channelColor = (ch: string) => {
    if (ch === "email") return "bg-blue-500/10 text-blue-300 border-blue-500/20";
    if (ch === "call_transcript") return "bg-violet-500/10 text-violet-300 border-violet-500/20";
    if (ch === "sms") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/20";
    return "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";
  };

  return (
    <div className="space-y-3 fade-in">
      <div className="flex items-center gap-2 mb-4">
        <History size={14} className="text-red-400" />
        <MonoLabel>War History ({history.length})</MonoLabel>
        {history.length > 0 && (
          <button
            onClick={() => { saveHistory([]); setHistory([]); }}
            className="ml-auto text-[10px] px-2.5 py-1 rounded border border-white/[0.06] text-white/20 hover:text-white/40 hover:border-white/10 transition-all flex items-center gap-1"
          >
            <Trash2 size={9} /> Clear all
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <History className="w-12 h-12 text-white/10 mb-3" />
          <p className="text-sm text-white/30">No analyses yet</p>
          <p className="text-[12px] text-white/20 mt-1">Run an Intel Analyzer sweep to build your war history.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map(h => {
            const score = getTruthScore(h.result);
            return (
              <div key={h.id} className="rounded-xl border border-white/[0.06] bg-[#111113] p-4 hover:border-red-500/10 transition-all group">
                <div className="flex items-start gap-3">
                  <SmallScoreCircle score={score} />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-[9px] font-mono ${riskColor(h.result.overallRisk)}`}>{h.result.overallRisk}</Badge>
                      <Badge className={`text-[9px] font-mono ${channelColor(h.channel)}`}>{h.channel.replace(/_/g, " ")}</Badge>
                      <span className="text-[10px] text-white/20 font-mono ml-auto">{fmtTime(h.timestamp)}</span>
                    </div>
                    <p className="text-[12px] text-white/40 line-clamp-2">{h.text.slice(0, 160)}…</p>
                    {h.result.summary && (
                      <p className="text-[11px] text-white/25 line-clamp-1">{h.result.summary.slice(0, 110)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                    <button
                      onClick={() => onReanalyze(h.text, h.channel)}
                      className="p-1.5 rounded hover:bg-white/5 transition-all"
                      title="Re-analyze"
                    >
                      <ArrowRight size={12} className="text-white/25 hover:text-red-400" />
                    </button>
                    <button
                      onClick={() => remove(h.id)}
                      className="p-1.5 rounded hover:bg-white/5 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={12} className="text-white/25 hover:text-rose-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Ghost Ops Tab ────────────────────────────────────────────────────────────

function GhostOpsTab({ onReanalyze }: { onReanalyze: (text: string, channel: ChannelId) => void }) {
  const history = loadHistory();
  const ghosts = history.filter(h => (h.result.ghostProbability || 0) > 40);

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Ghost size={14} className="text-rose-400" />
        <MonoLabel>Ghost Ops — Re-Engagement Center</MonoLabel>
        {ghosts.length > 0 && (
          <Badge className="ml-auto bg-rose-500/15 text-rose-400 border-rose-500/25 text-[10px] font-mono">
            {ghosts.length} ghost{ghosts.length !== 1 ? "s" : ""} detected
          </Badge>
        )}
      </div>

      {ghosts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Ghost className="w-14 h-14 text-white/10 mb-3" />
          <p className="text-sm text-white/30">No ghost deals detected</p>
          <p className="text-[12px] text-white/20 mt-1">Analyses with ghost probability &gt; 40% will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ghosts.map(h => {
            const score = getTruthScore(h.result);
            const gr = h.result.ghostResurrection;
            return (
              <div key={h.id} className="rounded-xl border border-rose-500/20 bg-[#111113] p-5 space-y-4">
                {/* Deal header */}
                <div className="flex items-start gap-3">
                  <SmallScoreCircle score={score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/25 text-[9px] font-mono gap-1">
                        <Ghost size={9} />Ghost: {h.result.ghostProbability}%
                      </Badge>
                      <Badge className={`text-[9px] font-mono ${riskColor(h.result.overallRisk)}`}>{h.result.overallRisk}</Badge>
                      <span className="text-[10px] text-white/20 font-mono ml-auto">{fmtTime(h.timestamp)}</span>
                    </div>
                    <p className="text-[12px] text-white/40 mt-1.5 line-clamp-2">{h.text.slice(0, 160)}…</p>
                  </div>
                </div>

                {/* Ghost Resurrection Card */}
                {gr?.isGhosted && (
                  <div className="rounded-lg border border-rose-500/15 bg-rose-500/[0.04] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap size={11} className="text-rose-400" />
                        <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider">Resurrection Protocol</p>
                      </div>
                      {gr.reEngagementStrategy && (
                        <Badge className="bg-rose-500/10 text-rose-300 border-rose-500/20 text-[9px] font-mono">{gr.reEngagementStrategy}</Badge>
                      )}
                    </div>
                    <p className="text-[13px] text-white/65 leading-relaxed italic">"{gr.reEngagementMessage}"</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(gr.reEngagementMessage);
                        }}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-rose-500/20 text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        <Copy size={10} /> Copy Message
                      </button>
                      <button
                        onClick={() => onReanalyze(h.text, h.channel)}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/35 hover:text-white/55 transition-all"
                      >
                        <ArrowRight size={10} /> Re-Analyze
                      </button>
                    </div>
                  </div>
                )}

                {/* Summary */}
                {h.result.summary && (
                  <p className="text-[12px] text-white/35 leading-relaxed pl-1">{h.result.summary}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AtomWarRoom() {
  const [activeTab, setActiveTab] = useState<TabId>("intel");
  const [restoreText, setRestoreText] = useState("");
  const [restoreChannel, setRestoreChannel] = useState<ChannelId>("email");
  const [restoreKey, setRestoreKey] = useState(0);

  function handleReanalyze(text: string, channel: ChannelId) {
    setRestoreText(text);
    setRestoreChannel(channel);
    setRestoreKey(k => k + 1);
    setActiveTab("intel");
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in { animation: fadeIn 0.4s ease-out both; }
        .tabs-scroll::-webkit-scrollbar { height: 0; }
        .tabs-scroll { scrollbar-width: none; }
      `}</style>

      <div className="space-y-5">
        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0"
            style={{
              background: "rgba(220,38,38,0.12)",
              border: "1px solid rgba(220,38,38,0.35)",
              boxShadow: "0 0 20px rgba(220,38,38,0.15)",
            }}
          >
            <Swords size={22} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#f6f6fd] leading-tight tracking-tight">ATOM War Room</h1>
            <p className="text-[12px] text-white/30 font-mono">Von Clausewitz Engine</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-mono text-red-400">LIVE</span>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 tabs-scroll">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap"
                style={{
                  background: active ? "rgba(220,38,38,0.08)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.06)"}`,
                  color: active ? "#f87171" : "rgba(255,255,255,0.35)",
                }}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div className="min-h-[400px]">
          {activeTab === "intel" && (
            <IntelAnalyzerTab
              key={restoreKey}
              initialText={restoreText}
              initialChannel={restoreChannel}
            />
          )}
          {activeTab === "pipeline" && <DealPipelineTab />}
          {activeTab === "playbook" && <PlaybookEngineTab />}
          {activeTab === "history" && <WarHistoryTab onReanalyze={handleReanalyze} />}
          {activeTab === "ghostops" && <GhostOpsTab onReanalyze={handleReanalyze} />}
        </div>
      </div>
    </div>
  );
}
