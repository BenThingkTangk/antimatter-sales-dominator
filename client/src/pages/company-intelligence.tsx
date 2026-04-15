import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  Search,
  Loader2,
  Copy,
  CheckCircle2,
  Circle,
  Sparkles,
  Shield,
  TrendingUp,
  Users,
  BookOpen,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  Building2,
  Zap,
  Database,
  Clock,
  BarChart3,
  Phone,
  Mail,
  Linkedin,
  RefreshCw,
  Target,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadStatus = "idle" | "loading" | "ready" | "error" | "timeout";

interface LoadedCompany {
  company: string;
  status: string;
  chunk_count?: number;
  loaded_at?: string;
}

// ─── Loading Steps ─────────────────────────────────────────────────────────────

const LOADING_STEPS = [
  { label: "Gathering firmographics & company profile", icon: Building2 },
  { label: "Building objection playbook", icon: Shield },
  { label: "Analyzing market intent signals", icon: TrendingUp },
  { label: "Generating call scripts & playbooks", icon: Phone },
  { label: "Indexing into vector database", icon: Database },
];

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "pitch", label: "ATOM Pitch", icon: Sparkles },
  { id: "objection", label: "Objection Handler", icon: Shield },
  { id: "intent", label: "Market Intent", icon: TrendingUp },
  { id: "prospects", label: "Find Contacts", icon: Users },
  { id: "playbook", label: "Call Playbook", icon: BookOpen },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function apiGet(path: string) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
        copied
          ? "border-green-500/40 bg-green-500/10 text-green-400"
          : "border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/15"
      } ${className}`}
    >
      {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// ─── Result Card ──────────────────────────────────────────────────────────────

function ResultCard({
  title,
  content,
  meta,
  children,
}: {
  title?: string;
  content?: string;
  meta?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 space-y-3">
      {title && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">{title}</p>
          {content && <CopyButton text={content} />}
        </div>
      )}
      {content && (
        <div className="text-sm leading-relaxed text-white/85 whitespace-pre-wrap">{content}</div>
      )}
      {meta && <p className="text-xs text-white/30">{meta}</p>}
      {children}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-white/25 space-y-3">
      <Icon className="w-10 h-10 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Tab: ATOM Pitch ──────────────────────────────────────────────────────────

function PitchTab({ activeCompany }: { activeCompany: string }) {
  const { toast } = useToast();
  const [prospectTitle, setProspectTitle] = useState("");
  const [productToPitch, setProductToPitch] = useState("");
  const [dealStage, setDealStage] = useState("Discovery");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ pitch?: string; chunk_count?: number; confidence?: number } | null>(null);

  const generate = async () => {
    if (!prospectTitle.trim()) {
      toast({ title: "Enter a prospect title", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      // Try standard pitch API first, fall back to RAG
      let data: any;
      try {
        data = await apiPost("/api/pitch/generate", {
          product: productToPitch || activeCompany,
          pitchType: dealStage === "Discovery" ? "Cold Call Opening" : dealStage === "Close" ? "Demo Setup" : "Follow-Up",
          persona: prospectTitle,
          company: activeCompany,
          tone: "Professional",
          customContext: `Company: ${activeCompany}. Deal stage: ${dealStage}.`,
        });
        // Normalize pitch API response
        setResult({ pitch: data.mainPitch || data.content || JSON.stringify(data), chunk_count: undefined, confidence: data.confidenceScore });
      } catch {
        // Fall back to RAG query
        data = await apiPost("/api/rag", {
          action: "query",
          company_name: activeCompany,
          question: `Generate a ${dealStage} stage pitch for ${prospectTitle} at ${activeCompany}${productToPitch ? ` for ${productToPitch}` : ""}`,
          module: "pitch",
        });
        setResult({ pitch: data.answer || data.pitch || data.content || JSON.stringify(data), chunk_count: data.chunk_count, confidence: data.confidence });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to generate pitch", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-white/40">
            Prospect Title
          </label>
          <Input
            placeholder="e.g. VP of Infrastructure"
            value={prospectTitle}
            onChange={(e) => setProspectTitle(e.target.value)}
            className="bg-white/[0.03] border-white/[0.08] text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-white/40">
            Product to Pitch <span className="text-white/20 normal-case">(optional)</span>
          </label>
          <Input
            placeholder="e.g. ATOM Enterprise AI"
            value={productToPitch}
            onChange={(e) => setProductToPitch(e.target.value)}
            className="bg-white/[0.03] border-white/[0.08] text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-white/40">
            Deal Stage
          </label>
          <Select value={dealStage} onValueChange={setDealStage}>
            <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Discovery">Discovery</SelectItem>
              <SelectItem value="Evaluation">Evaluation</SelectItem>
              <SelectItem value="Close">Close</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={generate}
        disabled={loading || !prospectTitle.trim()}
        className="bg-teal-600 hover:bg-teal-500 text-white gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        {loading ? "Generating..." : `Generate Pitch for ${activeCompany}`}
      </Button>

      {loading && (
        <div className="flex items-center gap-3 py-8 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
          <p className="text-sm">Retrieving intelligence and crafting your pitch...</p>
        </div>
      )}

      {result && !loading && (
        <ResultCard
          title={`ATOM Pitch — ${prospectTitle} at ${activeCompany}`}
          content={result.pitch}
          meta={
            result.chunk_count !== undefined
              ? `Based on ${result.chunk_count} intelligence chunks${result.confidence !== undefined ? ` · Confidence ${typeof result.confidence === 'number' && result.confidence <= 1 ? Math.round(result.confidence * 100) : result.confidence}%` : ""}`
              : result.confidence !== undefined ? `Confidence: ${result.confidence}%` : undefined
          }
        />
      )}

      {!result && !loading && (
        <EmptyState icon={Sparkles} message="Fill in the prospect title and click Generate Pitch" />
      )}
    </div>
  );
}

// ─── Tab: Objection Handler ───────────────────────────────────────────────────

function ObjectionTab({ activeCompany }: { activeCompany: string }) {
  const { toast } = useToast();
  const [objectionText, setObjectionText] = useState("");
  const [productToPitch, setProductToPitch] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    acknowledge?: string;
    reframe?: string;
    prove?: string;
    full_response?: string;
    primaryResponse?: string;
    strategies?: Array<{ type: string; headline: string; response: string }>;
  } | null>(null);

  const handle = async () => {
    if (!objectionText.trim()) {
      toast({ title: "Enter the objection text", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      // Try standard objection API first
      let data: any;
      try {
        data = await apiPost("/api/objection/handle", {
          objection: objectionText,
          objectionText,
          selectedProduct: productToPitch || activeCompany,
          context: `Company being researched: ${activeCompany}`,
        });
        setResult({
          primaryResponse: data.primaryResponse || data.response,
          strategies: data.strategies,
          full_response: data.primaryResponse || data.response,
        });
      } catch {
        // Fall back to RAG query
        data = await apiPost("/api/rag", {
          action: "query",
          company_name: activeCompany,
          question: `How do I handle this objection: "${objectionText}"${productToPitch ? ` for ${productToPitch}` : ""}`,
          module: "objection",
        });
        setResult({ full_response: data.answer || data.content || JSON.stringify(data) });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to handle objection", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const hasStructured = result && (result.acknowledge || result.reframe || result.prove || result.strategies);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-medium uppercase tracking-wider text-white/40">
            The Objection
          </label>
          <Textarea
            placeholder={`Enter the exact objection the ${activeCompany} prospect just said...`}
            value={objectionText}
            onChange={(e) => setObjectionText(e.target.value)}
            rows={3}
            className="bg-white/[0.03] border-white/[0.08] text-sm resize-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wider text-white/40">
            Product <span className="text-white/20 normal-case">(optional)</span>
          </label>
          <Input
            placeholder="e.g. ATOM Enterprise AI"
            value={productToPitch}
            onChange={(e) => setProductToPitch(e.target.value)}
            className="bg-white/[0.03] border-white/[0.08] text-sm"
          />
        </div>
      </div>

      <Button
        onClick={handle}
        disabled={loading || !objectionText.trim()}
        className="bg-amber-500/80 hover:bg-amber-500 text-white gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
        {loading ? "Handling..." : "Predict & Handle Objection"}
      </Button>

      {loading && (
        <div className="flex items-center gap-3 py-8 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
          <p className="text-sm">Building your counter-argument from {activeCompany} intel...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          {result.strategies && result.strategies.length > 0 ? (
            <>
              {result.primaryResponse && (
                <ResultCard title="Primary Response" content={result.primaryResponse} />
              )}
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-white/40">Response Strategies</p>
                {result.strategies.map((s, i) => (
                  <div key={i} className="border border-white/[0.05] rounded-lg p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-teal-300 mb-1">{s.type}</p>
                    <p className="text-xs font-medium text-white/70 mb-1">{s.headline}</p>
                    <p className="text-sm text-white/60 leading-relaxed">{s.response}</p>
                  </div>
                ))}
              </div>
            </>
          ) : result.acknowledge ? (
            <>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Acknowledge</p>
                  <CopyButton text={result.acknowledge} />
                </div>
                <p className="text-sm leading-relaxed text-white/85">{result.acknowledge}</p>
              </div>
              {result.reframe && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-teal-300">Reframe</p>
                    <CopyButton text={result.reframe} />
                  </div>
                  <p className="text-sm leading-relaxed text-white/85">{result.reframe}</p>
                </div>
              )}
              {result.prove && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-green-400">Prove</p>
                    <CopyButton text={result.prove} />
                  </div>
                  <p className="text-sm leading-relaxed text-white/85">{result.prove}</p>
                </div>
              )}
            </>
          ) : (
            <ResultCard title="Counter-Argument" content={result.full_response || result.primaryResponse} />
          )}
        </div>
      )}

      {!result && !loading && (
        <EmptyState icon={Shield} message="Enter the objection and click Handle Objection" />
      )}
    </div>
  );
}

// ─── Tab: Market Intent ───────────────────────────────────────────────────────

function IntentGauge({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const color = pct >= 70 ? "#4ade80" : pct >= 40 ? "#5eead4" : "#f87171";
  const label = pct >= 70 ? "High Intent" : pct >= 40 ? "Moderate Intent" : "Low Intent";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${(pct / 100) * 251.2} 251.2`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{pct}</span>
          <span className="text-[10px] text-white/40">/ 100</span>
        </div>
      </div>
      <Badge
        className="text-xs font-medium"
        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
      >
        {label}
      </Badge>
    </div>
  );
}

function IntentTab({ activeCompany }: { activeCompany: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    intent_score?: number;
    signals?: string[];
    recommended_action?: string;
    context?: string;
  } | null>(null);

  const analyze = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await apiPost("/api/rag", {
        action: "query",
        company_name: activeCompany,
        question: `What are the buying intent signals for ${activeCompany}? What is their likelihood to purchase?`,
        module: "market_intent",
      });
      setResult({
        intent_score: data.intent_score ?? data.score ?? 60,
        signals: data.signals || [],
        recommended_action: data.recommended_action || data.action,
        context: data.answer || data.context,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to analyze intent", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <Button
        onClick={analyze}
        disabled={loading}
        className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
        {loading ? "Analyzing..." : `Analyze ${activeCompany} Intent Signals`}
      </Button>

      {loading && (
        <div className="flex items-center gap-3 py-8 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <p className="text-sm">Scanning for buying signals from vectorized intel...</p>
        </div>
      )}

      {result && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40 mb-4">
              Intent Score
            </p>
            <IntentGauge score={result.intent_score ?? 0} />
          </div>

          <div className="md:col-span-2 space-y-3">
            {result.signals && result.signals.length > 0 && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-white/40 mb-3">
                  Buying Signals
                </p>
                <ul className="space-y-2">
                  {result.signals.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                      <ChevronRight className="w-4 h-4 text-teal-300 shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommended_action && (
              <div className="rounded-xl border border-teal-500/30 bg-teal-500/5 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-teal-300 mb-2">
                  Recommended Action
                </p>
                <p className="text-sm text-white/85">{result.recommended_action}</p>
              </div>
            )}

            {result.context && !result.signals?.length && (
              <ResultCard title="Market Intelligence" content={result.context} />
            )}
          </div>
        </div>
      )}

      {!result && !loading && (
        <EmptyState icon={TrendingUp} message="Click Analyze Intent Signals to scan the intelligence" />
      )}
    </div>
  );
}

// ─── Tab: Find Contacts (Prospects) ──────────────────────────────────────────

function ProspectsTab({ activeCompany }: { activeCompany: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    company_size?: string;
    industry?: string;
    tech_stack?: string[];
    decision_makers?: Array<{ name?: string; title?: string; signal?: string }>;
    context?: string;
    prospects?: any[];
  } | null>(null);

  const load = async () => {
    setLoading(true);
    setResult(null);
    try {
      // Try Apollo scan first for real contacts
      let data: any;
      try {
        const scanData = await fetch("/api/prospects/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: activeCompany, limit: 10 }),
        });
        if (scanData.ok) {
          const prospects = await scanData.json();
          data = { prospects, company_size: "See contacts below" };
        } else throw new Error("scan failed");
      } catch {
        // Fall back to RAG query
        data = await apiPost("/api/rag", {
          action: "query",
          company_name: activeCompany,
          question: `Who are the key decision makers at ${activeCompany}? What are their names, titles, and contact signals?`,
          module: "prospects",
        });
      }
      setResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to load prospects", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany]);

  return (
    <div className="space-y-5">
      <Button onClick={load} disabled={loading} variant="outline" className="gap-2 border-white/10 hover:border-teal-500/30">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        {loading ? "Loading..." : "Refresh Contacts"}
      </Button>

      {loading && (
        <div className="flex items-center gap-3 py-8 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
          <p className="text-sm">Loading firmographic & prospect intelligence...</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4">
          {/* Apollo prospects */}
          {result.prospects && result.prospects.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40 mb-3">
                Apollo Contacts — {activeCompany}
              </p>
              <div className="space-y-2.5">
                {result.prospects.slice(0, 10).map((p: any, i: number) => {
                  let contacts: any[] = [];
                  try { contacts = typeof p.contacts === "string" ? JSON.parse(p.contacts) : (p.contacts || []); } catch {}
                  const contact = contacts[0] || {};
                  const name = contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : contact.firstName || "";
                  return (
                    <div key={i} className="flex items-start gap-3 py-2 border-b border-white/[0.05] last:border-0">
                      <div className="w-8 h-8 rounded-full bg-teal-500/15 border border-teal-500/20 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-teal-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {name && <p className="text-sm font-medium text-white/85">{name}</p>}
                        {contact.position && <p className="text-xs text-white/50">{contact.position}</p>}
                        {contact.email && (
                          <p className="text-xs text-teal-300 mt-0.5 flex items-center gap-1">
                            <Mail className="w-3 h-3" />{contact.email}
                          </p>
                        )}
                        {contact.phone && (
                          <p className="text-xs text-white/40 mt-0.5 flex items-center gap-1">
                            <Phone className="w-3 h-3" />{contact.phone}
                          </p>
                        )}
                        {contact.linkedin && (
                          <a href={contact.linkedin} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-400 mt-0.5 flex items-center gap-1 hover:text-blue-300">
                            <Linkedin className="w-3 h-3" />LinkedIn ↗
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(result.company_size || result.industry) && !result.prospects?.length && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {result.company_size && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Company Size</p>
                  <p className="text-sm font-medium text-white/85">{result.company_size}</p>
                </div>
              )}
              {result.industry && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Industry</p>
                  <p className="text-sm font-medium text-white/85">{result.industry}</p>
                </div>
              )}
            </div>
          )}

          {result.tech_stack && result.tech_stack.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40 mb-3">Tech Stack</p>
              <div className="flex flex-wrap gap-1.5">
                {result.tech_stack.map((tech, i) => (
                  <Badge key={i} variant="outline" className="text-xs border-white/10 text-white/60">{tech}</Badge>
                ))}
              </div>
            </div>
          )}

          {result.decision_makers && result.decision_makers.length > 0 && (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-white/40 mb-3">Key Decision Makers</p>
              <div className="space-y-2.5">
                {result.decision_makers.map((dm, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-white/[0.05] last:border-0">
                    <div className="w-8 h-8 rounded-full bg-teal-500/15 border border-teal-500/20 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-teal-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {dm.name && <p className="text-sm font-medium text-white/85">{dm.name}</p>}
                      {dm.title && <p className="text-xs text-white/50">{dm.title}</p>}
                      {dm.signal && <p className="text-xs text-teal-300 mt-1">{dm.signal}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.context && !result.decision_makers && !result.prospects?.length && (
            <ResultCard title="Firmographic Intelligence" content={result.context} />
          )}
        </div>
      )}

      {!result && !loading && (
        <EmptyState icon={Users} message="Firmographic intelligence will appear here" />
      )}

      <div className="pt-2">
        <Link href="/prospects">
          <Button className="gap-2 bg-teal-600 hover:bg-teal-500 text-white">
            <ExternalLink className="w-4 h-4" />
            Full Prospect Search in ATOM Prospect
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Tab: Call Playbook ───────────────────────────────────────────────────────

interface PlaybookSection {
  key: string;
  label: string;
  icon: React.ElementType;
  content: string;
}

function PlaybookTab({ activeCompany }: { activeCompany: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    opener?: string;
    pitch_30sec?: string;
    discovery_questions?: string;
    meeting_close?: string;
    voicemail?: string;
    followup_email?: string;
    linkedin_message?: string;
    full_playbook?: string;
    answer?: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await apiPost("/api/rag", {
        action: "query",
        company_name: activeCompany,
        question: `Generate a comprehensive call playbook for selling to ${activeCompany}. Include: opener, 30-second pitch, discovery questions, meeting close, voicemail script, follow-up email, and LinkedIn message.`,
        module: "call_playbook",
      });
      setResult(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to load playbook", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const sections: PlaybookSection[] = result
    ? [
        { key: "opener", label: "Opener", icon: Phone, content: result.opener || "" },
        { key: "pitch_30sec", label: "30-Second Pitch", icon: Zap, content: result.pitch_30sec || "" },
        { key: "discovery_questions", label: "Discovery Questions", icon: Search, content: result.discovery_questions || "" },
        { key: "meeting_close", label: "Meeting Close", icon: CheckCircle2, content: result.meeting_close || "" },
        { key: "voicemail", label: "Voicemail Script", icon: Phone, content: result.voicemail || "" },
        { key: "followup_email", label: "Follow-Up Email", icon: Mail, content: result.followup_email || "" },
        { key: "linkedin_message", label: "LinkedIn Message", icon: Linkedin, content: result.linkedin_message || "" },
      ].filter((s) => s.content)
    : [];

  return (
    <div className="space-y-5">
      <Button onClick={load} disabled={loading} className="bg-teal-600 hover:bg-teal-500 text-white gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
        {loading ? "Loading..." : `Generate ${activeCompany} Playbook`}
      </Button>

      {loading && (
        <div className="flex items-center gap-3 py-8 text-white/40">
          <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
          <p className="text-sm">Retrieving complete call playbook from intelligence...</p>
        </div>
      )}

      {result && !loading && (
        <>
          {sections.length > 0 ? (
            <div className="space-y-3">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.key} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-teal-300" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{section.label}</p>
                      </div>
                      <CopyButton text={section.content} />
                    </div>
                    <p className="text-sm leading-relaxed text-white/80 whitespace-pre-wrap">{section.content}</p>
                  </div>
                );
              })}
            </div>
          ) : result.full_playbook || result.answer ? (
            <ResultCard title="Full Call Playbook" content={result.full_playbook || result.answer} />
          ) : (
            <EmptyState icon={BookOpen} message="No playbook sections returned" />
          )}

          <div className="pt-2">
            <Link href="/atom-campaign">
              <Button className="gap-2 bg-teal-600 hover:bg-teal-500 text-white">
                <Zap className="w-4 h-4" />
                Launch Campaign Targeting {activeCompany}
              </Button>
            </Link>
          </div>
        </>
      )}

      {!result && !loading && (
        <EmptyState icon={BookOpen} message="Click Generate Playbook to retrieve the full script" />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompanyIntelligence() {
  const { toast } = useToast();

  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [loadingStep, setLoadingStep] = useState(0);
  const [activeCompany, setActiveCompany] = useState("");
  const [activeTab, setActiveTab] = useState("pitch");
  const [loadedCompanies, setLoadedCompanies] = useState<LoadedCompany[]>([]);
  const [loadStartTime, setLoadStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const TIMEOUT_MS = 30000; // 30-second timeout for loading

  // ── Fetch loaded companies ─────────────────────────────────────────────────

  const fetchCompanies = useCallback(async () => {
    try {
      const data = await apiGet("/api/rag?action=companies");
      if (Array.isArray(data)) setLoadedCompanies(data);
      else if (data.companies) setLoadedCompanies(data.companies);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  // ── Elapsed timer for loading UI ──────────────────────────────────────────

  useEffect(() => {
    if (loadStatus === "loading") {
      timerRef.current = setInterval(() => {
        if (loadStartTime) {
          setElapsedSeconds(Math.floor((Date.now() - loadStartTime) / 1000));
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loadStatus, loadStartTime]);

  // ── Poll status with timeout ───────────────────────────────────────────────

  const startPolling = useCallback(
    (company: string, startTime: number) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        // Check timeout
        if (Date.now() - startTime > TIMEOUT_MS) {
          clearInterval(pollRef.current!);
          if (stepRef.current) clearInterval(stepRef.current);
          setLoadStatus("timeout");
          toast({
            title: "Loading timed out",
            description: "The vector indexing is taking longer than expected. You can retry or proceed if data is partial.",
            variant: "destructive",
          });
          return;
        }

        try {
          const data = await apiGet(`/api/rag?action=status&company=${encodeURIComponent(company)}`);
          if (data.status === "ready") {
            clearInterval(pollRef.current!);
            if (stepRef.current) clearInterval(stepRef.current);
            setLoadStatus("ready");
            setActiveCompany(company);
            fetchCompanies();
            toast({
              title: "ATOM WarBook loaded",
              description: `${company} intelligence is ready — 24h cache active`,
            });
          } else if (data.status === "error") {
            clearInterval(pollRef.current!);
            if (stepRef.current) clearInterval(stepRef.current);
            setLoadStatus("error");
            toast({ title: "Load failed", description: data.message || "Unknown error", variant: "destructive" });
          }
        } catch {
          // keep polling — transient network errors shouldn't stop us
        }
      }, 3000);
    },
    [fetchCompanies, toast]
  );

  const stopIntervals = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (stepRef.current) clearInterval(stepRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => () => stopIntervals(), [stopIntervals]);

  // ── Load company ───────────────────────────────────────────────────────────

  const loadIntelligence = async () => {
    const name = companyName.trim();
    if (!name) {
      toast({ title: "Enter a company name", variant: "destructive" });
      return;
    }

    stopIntervals();
    const startTime = Date.now();
    setLoadStartTime(startTime);
    setLoadStatus("loading");
    setLoadingStep(0);
    setElapsedSeconds(0);

    // Animate through steps
    let step = 0;
    stepRef.current = setInterval(() => {
      step++;
      if (step < LOADING_STEPS.length) {
        setLoadingStep(step);
      } else {
        clearInterval(stepRef.current!);
      }
    }, 5500);

    try {
      await apiPost("/api/rag", {
        action: "load",
        company_name: name,
        website: websiteUrl.trim() || undefined,
      });
      // POST responds when queued; now poll for status
      startPolling(name, startTime);
    } catch (e: unknown) {
      stopIntervals();
      setLoadStatus("error");
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Failed to start load", description: msg, variant: "destructive" });
    }
  };

  // Retry with same company
  const retryLoad = () => {
    if (companyName.trim()) {
      loadIntelligence();
    }
  };

  // Force proceed even if stuck (partial data may be available)
  const proceedAnyway = () => {
    stopIntervals();
    setLoadStatus("ready");
    setActiveCompany(companyName.trim());
    toast({ title: "Proceeding with partial data", description: "Some sections may have limited intelligence." });
  };

  const selectCompany = (company: LoadedCompany) => {
    if (company.status === "ready") {
      setActiveCompany(company.company);
      setLoadStatus("ready");
      setCompanyName(company.company);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 md:gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-teal-500/10 border border-teal-500/20">
          <Brain className="w-6 h-6 text-teal-300" />
        </div>
        <div>
          <h1 className="text-lg md:text-2xl font-semibold tracking-tight text-white/95">
            ATOM WarBook
          </h1>
          <p className="text-sm text-white/40 mt-0.5">
            Deep company intelligence — pitch, objections, intent, contacts, and playbook in one view
          </p>
        </div>
      </div>

      {/* ── Search / Load ────────────────────────────────────────────────────── */}
      <Card className="border-0" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px" }}>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
              <input
                type="text"
                placeholder="Enter any company name (e.g. Five9, TierPoint, Salesforce...)"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadStatus !== "loading" && loadIntelligence()}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all placeholder:text-white/20 text-white/90"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
              />
            </div>
            <div className="relative sm:w-52">
              <input
                type="text"
                placeholder="Website URL (optional)"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all placeholder:text-white/20 text-white/90"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
              />
            </div>
            <button
              onClick={loadIntelligence}
              disabled={loadStatus === "loading" || !companyName.trim()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap bg-teal-600 hover:bg-teal-500"
            >
              {loadStatus === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              {loadStatus === "loading" ? "Loading..." : "Build WarBook"}
            </button>
          </div>

          {/* Loading Progress */}
          {loadStatus === "loading" && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/30 uppercase tracking-wider">Building intelligence...</p>
                <p className="text-xs text-white/25">{elapsedSeconds}s / 30s max</p>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all duration-1000"
                  style={{ width: `${Math.min((elapsedSeconds / 30) * 100, 95)}%` }}
                />
              </div>

              {LOADING_STEPS.map((step, idx) => {
                const done = idx < loadingStep;
                const active = idx === loadingStep;
                const Icon = step.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 transition-all"
                    style={{ opacity: done ? 0.5 : active ? 1 : 0.25 }}
                  >
                    <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : active ? (
                        <div className="w-2 h-2 rounded-full bg-teal-300 animate-pulse" />
                      ) : (
                        <Circle className="w-4 h-4 text-white/20" />
                      )}
                    </div>
                    <Icon className={`w-4 h-4 shrink-0 ${done ? "text-green-400" : active ? "text-teal-300" : "text-white/20"}`} />
                    <p className={`text-sm ${done ? "text-green-400 line-through" : active ? "text-white/90 font-medium" : "text-white/30"}`}>
                      {step.label}
                    </p>
                    {active && (
                      <div className="flex gap-1 ml-auto">
                        {[0, 1, 2].map((d) => (
                          <div
                            key={d}
                            className="w-1 h-1 rounded-full bg-teal-300"
                            style={{ animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${d * 0.2}s` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Timeout State */}
          {loadStatus === "timeout" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-400">Indexing is taking longer than expected</p>
                  <p className="text-xs text-white/40 mt-1">
                    The vector database indexing exceeded 30 seconds. This can happen with large company profiles.
                    You can retry, or proceed with partial data — most intelligence sections will still work.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button onClick={retryLoad} variant="outline" className="gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </Button>
                <Button onClick={proceedAnyway} className="gap-2 bg-teal-600 hover:bg-teal-500 text-white">
                  <ChevronRight className="w-4 h-4" />
                  Proceed Anyway
                </Button>
              </div>
            </div>
          )}

          {/* Success State */}
          {loadStatus === "ready" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.2)" }}>
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <p className="text-sm text-green-400 font-medium">
                ✓ ATOM WarBook loaded — 24h cache active
              </p>
              <Badge className="ml-auto text-xs" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)" }}>
                {activeCompany}
              </Badge>
            </div>
          )}

          {/* Error State */}
          {loadStatus === "error" && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-400">Failed to load intelligence</p>
                  <p className="text-xs text-white/40 mt-1">Check your company name and try again, or use a website URL to help locate the company.</p>
                </div>
              </div>
              <Button onClick={retryLoad} variant="outline" className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10">
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            </div>
          )}

          {/* Previously Loaded Chips */}
          {loadedCompanies.length > 0 && loadStatus !== "loading" && (
            <div className="flex flex-wrap gap-2 pt-1">
              <p className="text-xs text-white/30 w-full uppercase tracking-wider">Previously loaded</p>
              {loadedCompanies.map((c) => (
                <button
                  key={c.company}
                  onClick={() => selectCompany(c)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: activeCompany === c.company ? "rgba(13,148,136,0.15)" : "rgba(255,255,255,0.04)",
                    border: activeCompany === c.company ? "1px solid rgba(13,148,136,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    color: activeCompany === c.company ? "#5eead4" : "rgba(255,255,255,0.5)",
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: c.status === "ready" ? "#4ade80" : "#f87171",
                      boxShadow: c.status === "ready" ? "0 0 6px #4ade80" : "none",
                    }}
                  />
                  {c.company}
                  {c.chunk_count !== undefined && (
                    <span className="text-white/30">{c.chunk_count} chunks</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── WarBook Dashboard ──────────────────────────────────────────────────── */}
      {(loadStatus === "ready") && activeCompany && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>

          {/* WarBook header */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-white/[0.08] bg-teal-500/5">
            <div className="w-9 h-9 rounded-lg bg-teal-500/15 border border-teal-500/20 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white/95">{activeCompany}</h2>
              <p className="text-xs text-white/40">ATOM WarBook — Full intelligence suite</p>
            </div>

            {/* Quick-action shortcuts */}
            <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-teal-500/30 text-teal-300 hover:bg-teal-500/10"
                onClick={() => setActiveTab("pitch")}
              >
                <Sparkles className="w-3.5 h-3.5" />Generate Pitch
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                onClick={() => setActiveTab("objection")}
              >
                <Shield className="w-3.5 h-3.5" />Predict Objections
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                onClick={() => setActiveTab("prospects")}
              >
                <Users className="w-3.5 h-3.5" />Find Contacts
              </Button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex overflow-x-auto" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap transition-all shrink-0"
                  style={{
                    color: isActive ? "#5eead4" : "rgba(255,255,255,0.35)",
                    borderBottom: isActive ? "2px solid #0d9488" : "2px solid transparent",
                    background: isActive ? "rgba(13,148,136,0.05)" : "transparent",
                  }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-4 md:p-6">
            {activeTab === "pitch" && <PitchTab activeCompany={activeCompany} />}
            {activeTab === "objection" && <ObjectionTab activeCompany={activeCompany} />}
            {activeTab === "intent" && <IntentTab activeCompany={activeCompany} />}
            {activeTab === "prospects" && <ProspectsTab activeCompany={activeCompany} />}
            {activeTab === "playbook" && <PlaybookTab activeCompany={activeCompany} />}
          </div>
        </div>
      )}

      {/* ── Placeholder when no company loaded ───────────────────────────────── */}
      {loadStatus === "idle" && (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-20 space-y-4"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/15 flex items-center justify-center">
            <Brain className="w-8 h-8 text-teal-300/50" />
          </div>
          <p className="text-sm text-white/25">Enter a company name above to build the WarBook</p>
          <p className="text-xs text-white/15">
            ATOM Pitch · Objection Handler · Market Intent · Find Contacts · Call Playbook
          </p>
        </div>
      )}

      {/* ── Recently Loaded Grid ────────────────────────────────────────────── */}
      {loadedCompanies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-white/30">
            Recent WarBook Entries
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {loadedCompanies.map((c) => (
              <button
                key={c.company}
                onClick={() => selectCompany(c)}
                className="flex flex-col gap-2.5 p-4 rounded-xl text-left transition-all group"
                style={{
                  background: activeCompany === c.company ? "rgba(13,148,136,0.1)" : "rgba(255,255,255,0.03)",
                  border: activeCompany === c.company ? "1px solid rgba(13,148,136,0.3)" : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-teal-300 shrink-0" />
                    <span className="text-sm font-medium text-white/85 truncate">{c.company}</span>
                  </div>
                  <div
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0"
                    style={{
                      background: c.status === "ready" ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                      color: c.status === "ready" ? "#4ade80" : "#f87171",
                      border: `1px solid ${c.status === "ready" ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
                    }}
                  >
                    {c.status}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/30">
                  {c.chunk_count !== undefined && (
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3" />
                      {c.chunk_count} chunks
                    </span>
                  )}
                  {c.loaded_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(c.loaded_at)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
