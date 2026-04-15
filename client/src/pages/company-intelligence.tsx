import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  Search,
  Loader2,
  Copy,
  CheckCircle2,
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
  Flame,
  History,
  Trash2,
  Globe,
  MapPin,
  Calendar,
  DollarSign,
  Cpu,
  Newspaper,
  Crosshair,
  MessageSquare,
  Activity,
  X,
  ArrowLeft,
  PhoneCall,
  Swords,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyOverview {
  description: string;
  industry: string;
  founded: string;
  headquarters: string;
  employeeCount: string;
  revenue: string;
  website: string;
  stockTicker: string | null;
}

interface Competitor {
  name: string;
  threat: "high" | "medium" | "low";
  differentiator: string;
}

interface PainPoint {
  pain: string;
  severity: "critical" | "high" | "medium";
  opportunity: string;
}

interface BuyingSignal {
  signal: string;
  strength: "strong" | "moderate" | "weak";
  source: string;
}

interface NewsItem {
  headline: string;
  date: string;
  relevance: string;
}

interface ObjectionPrediction {
  objection: string;
  probability: "high" | "medium" | "low";
  counterStrategy: string;
}

interface PitchAngle {
  angle: string;
  targetPersona: string;
  openingLine: string;
}

interface CallStrategy {
  bestTimeToCall: string;
  gatekeeperTips: string;
  toneRecommendation: string;
  keyQuestions: string[];
}

interface WarBook {
  overview: CompanyOverview;
  executiveSummary: string;
  techStack: string[];
  competitors: Competitor[];
  painPoints: PainPoint[];
  buyingSignals: BuyingSignal[];
  recentNews: NewsItem[];
  objectionPredictions: ObjectionPrediction[];
  pitchAngles: PitchAngle[];
  callStrategy: CallStrategy;
  sentimentScore: number;
  buyerIntentScore: number;
  priorityLevel: "high" | "medium" | "low";
}

interface Contact {
  name: string;
  title: string;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  city?: string | null;
  state?: string | null;
}

interface WarBookResult {
  company: string;
  warbook: WarBook;
  contacts: Contact[];
  companyProfile: any;
  citations: string[];
  sources: { perplexity: boolean; apollo: boolean; pdl: boolean };
  generatedAt: string;
}

interface HistoryEntry {
  id: string;
  company: string;
  website?: string;
  result: WarBookResult;
  timestamp: number;
}

const STORAGE_KEY = "atom_warbook_history";
type Tab = "intel" | "people" | "competitive" | "pain" | "signals" | "news" | "battlecard" | "battleplan";

const LOADING_STEPS = [
  { label: "Searching the web for company intel...", icon: Search },
  { label: "Analyzing competitors & market position...", icon: Shield },
  { label: "Finding decision makers...", icon: Users },
  { label: "Identifying pain points & opportunities...", icon: Target },
  { label: "Building battle plan & objection handlers...", icon: Crosshair },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch {}
}

function formatTimestamp(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const hours = diff / (1000 * 60 * 60);
  if (hours < 1) {
    const mins = Math.floor(diff / (1000 * 60));
    return mins <= 1 ? "just now" : `${mins}m ago`;
  }
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function priorityColor(level: string): string {
  if (level === "high") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (level === "medium") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-teal-500/15 text-teal-400 border-teal-500/25";
}

function threatColor(t: string): string {
  if (t === "high") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (t === "medium") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
}

function severityColor(s: string): string {
  if (s === "critical") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (s === "high") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-teal-500/15 text-teal-400 border-teal-500/25";
}

function strengthColor(s: string): string {
  if (s === "strong") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
  if (s === "moderate") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-white/5 text-white/40 border-white/10";
}

function probColor(p: string): string {
  if (p === "high") return "bg-rose-500/15 text-rose-400 border-rose-500/25";
  if (p === "medium") return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  return "bg-white/5 text-white/40 border-white/10";
}

// ─── Gauge Component ──────────────────────────────────────────────────────────

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const filled = (value / 100) * c;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="48" cy="48" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${filled} ${c - filled}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums" style={{ color, fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
            {value}
          </span>
          <span className="text-[9px] text-white/30 font-mono">/100</span>
        </div>
      </div>
      <p className="text-[10px] font-mono uppercase tracking-wider text-white/40">{label}</p>
    </div>
  );
}

// ─── History Drawer ───────────────────────────────────────────────────────────

function HistoryDrawer({
  open,
  onClose,
  onRestore,
}: {
  open: boolean;
  onClose: () => void;
  onRestore: (entry: HistoryEntry) => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  useEffect(() => { if (open) setHistory(loadHistory()); }, [open]);

  const deleteEntry = (id: string) => {
    const updated = history.filter((e) => e.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />}
      <div
        className={`fixed top-0 right-0 bottom-0 w-96 z-50 flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "#111113", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
              WarBook History
            </span>
            {history.length > 0 && (
              <Badge className="bg-teal-500/15 text-teal-400 border-teal-500/20 text-[10px] font-mono">{history.length}</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/5">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <History className="w-10 h-10 text-white/10 mb-3" />
              <p className="text-sm text-white/30">No WarBooks built yet</p>
            </div>
          ) : (
            history.map((entry) => (
              <div key={entry.id} className="rounded-xl border border-white/[0.08] bg-[#161618] p-3 hover:border-teal-500/20 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <button className="flex-1 text-left" onClick={() => { onRestore(entry); onClose(); }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Building2 className="w-3.5 h-3.5 text-teal-400" />
                      <span className="text-sm font-semibold text-[#e8e8ea]">{entry.company}</span>
                      <Badge className={`text-[9px] font-mono ml-auto ${priorityColor(entry.result.warbook?.priorityLevel || "low")}`}>
                        {entry.result.warbook?.priorityLevel}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-white/20" />
                      <span className="text-[10px] text-white/30 font-mono">{formatTimestamp(entry.timestamp)}</span>
                      {entry.website && <span className="text-[10px] text-white/20 truncate">{entry.website}</span>}
                    </div>
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => deleteEntry(entry.id)}
                    className="h-6 w-6 p-0 text-white/20 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <button className="mt-2 w-full text-[10px] text-teal-400/60 hover:text-teal-400 transition-colors text-left flex items-center gap-1"
                  onClick={() => { onRestore(entry); onClose(); }}>
                  <ArrowLeft className="w-3 h-3 rotate-180" />View WarBook
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── WarBook Display ──────────────────────────────────────────────────────────

function WarBookDisplay({ result }: { result: WarBookResult }) {
  const [tab, setTab] = useState<Tab>("intel");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const wb = result.warbook;
  const cp = result.companyProfile;

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "intel", label: "Intel Overview", icon: Database },
    { id: "people", label: "Decision Makers", icon: Users },
    { id: "competitive", label: "Competitive", icon: Shield },
    { id: "pain", label: "Pain Points", icon: AlertCircle },
    { id: "signals", label: "Buying Signals", icon: Activity },
    { id: "news", label: "News", icon: Newspaper },
    { id: "battlecard", label: "Battle Card", icon: Swords },
    { id: "battleplan", label: "Battle Plan", icon: Crosshair },
  ];

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const callWithAtom = (contact: Contact) => {
    if (!contact.phone) return;
    const params = new URLSearchParams({
      company: result.company,
      contact: contact.name,
      title: contact.title,
      phone: contact.phone,
    });
    navigate(`/atom-leadgen?${params.toString()}`);
  };

  return (
    <div className="space-y-5">
      {/* ─── Header Card ─────────────────────────────────────────────────── */}
      <Card className="bg-[#111113] border-white/[0.08]">
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-start gap-5">
            {/* Left: Company info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-[#e8e8ea]"
                    style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", letterSpacing: "-0.03em" }}>
                    {result.company}
                  </h2>
                  {wb?.overview?.stockTicker && (
                    <span className="text-xs font-mono text-white/30">{wb.overview.stockTicker}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-auto flex-wrap">
                  <Badge className={`text-xs font-mono border ${priorityColor(wb?.priorityLevel || "medium")}`}>
                    {wb?.priorityLevel === "high" && <Flame className="w-3 h-3 mr-1" />}
                    {wb?.priorityLevel?.toUpperCase()} PRIORITY
                  </Badge>
                  {wb?.overview?.industry && (
                    <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs font-mono">
                      {wb.overview.industry}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                {[
                  { icon: MapPin, label: wb?.overview?.headquarters || cp?.location || "—" },
                  { icon: Users, label: wb?.overview?.employeeCount || cp?.employeeCount || "—" },
                  { icon: DollarSign, label: wb?.overview?.revenue || cp?.revenue || "—" },
                  { icon: Calendar, label: wb?.overview?.founded || cp?.founded || "—" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-white/25 shrink-0" />
                      <span className="text-xs text-white/50 truncate">{item.label}</span>
                    </div>
                  );
                })}
              </div>

              {wb?.overview?.website && (
                <a href={wb.overview.website.startsWith("http") ? wb.overview.website : `https://${wb.overview.website}`}
                  target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors">
                  <Globe className="w-3.5 h-3.5" />{wb.overview.website}
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>
              )}

              {/* ATOM source badges (replacing third-party names) */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-white/25 font-mono">DATA SOURCES:</span>
                {result.sources?.perplexity && <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-[9px] font-mono">ATOM Web Intel</Badge>}
                {result.sources?.apollo && <Badge className="bg-teal-500/10 text-teal-300 border-teal-500/20 text-[9px] font-mono">ATOM Contacts</Badge>}
                {result.sources?.pdl && <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[9px] font-mono">ATOM Enrich</Badge>}
              </div>
            </div>

            {/* Right: Gauges */}
            <div className="flex items-center gap-6 lg:border-l lg:border-white/[0.06] lg:pl-5">
              <Gauge value={wb?.sentimentScore || 0} label="Sentiment" color="#00c8c8" />
              <Gauge value={wb?.buyerIntentScore || 0} label="Buyer Intent" color="#a855f7" />
            </div>
          </div>

          {/* Executive Summary */}
          {wb?.executiveSummary && (
            <div className="mt-4 p-4 rounded-xl border border-teal-500/15 bg-teal-500/[0.04]">
              <div className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-wider text-teal-400/60 mb-1.5">Executive Summary</p>
                  <p className="text-sm text-white/70 leading-relaxed">{wb.executiveSummary}</p>
                </div>
                <button onClick={() => copyText(wb.executiveSummary)} className="ml-auto shrink-0 p-1 text-white/20 hover:text-teal-400 transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-xl bg-[#111113] border border-white/[0.08] w-fit min-w-full">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap ${
                  active ? "bg-teal-500/15 text-teal-300 border border-teal-500/25" : "text-white/35 hover:text-white/60 hover:bg-white/[0.04]"
                }`}
                style={{ fontFamily: "'Satoshi', Arial, sans-serif" }}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Tab Content ──────────────────────────────────────────────────── */}

      {/* INTEL OVERVIEW */}
      {tab === "intel" && (
        <div className="space-y-4">
          {wb?.overview?.description && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <p className="text-xs font-mono uppercase tracking-wider text-white/30 mb-2">About</p>
                <p className="text-sm text-white/65 leading-relaxed">{wb.overview.description}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Industry", value: wb?.overview?.industry, icon: Briefcase },
              { label: "Founded", value: wb?.overview?.founded, icon: Calendar },
              { label: "HQ", value: wb?.overview?.headquarters, icon: MapPin },
              { label: "Ticker", value: wb?.overview?.stockTicker || "Private", icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon as any;
              return (
                <Card key={item.label} className="bg-[#111113] border-white/[0.08]">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className="w-3 h-3 text-white/25" />
                      <p className="text-[9px] font-mono uppercase tracking-wider text-white/25">{item.label}</p>
                    </div>
                    <p className="text-sm font-semibold text-white/80" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
                      {item.value || "—"}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {wb?.techStack && wb.techStack.length > 0 && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-teal-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
                    Tech Stack
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {wb.techStack.map((t) => (
                    <Badge key={t} className="bg-blue-500/10 text-blue-300 border-blue-500/20 text-[10px] font-mono px-2">{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* DECISION MAKERS */}
      {tab === "people" && (
        <div className="space-y-3">
          {result.contacts.length === 0 ? (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="py-12 flex flex-col items-center gap-2">
                <Users className="w-10 h-10 text-white/10" />
                <p className="text-sm text-white/30">No contacts found</p>
              </CardContent>
            </Card>
          ) : (
            result.contacts.map((c, i) => (
              <Card key={i} className="bg-[#111113] border-white/[0.08] hover:border-teal-500/20 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-teal-400">
                          {c.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-[#e8e8ea]">{c.name}</p>
                          <Badge className="bg-green-500/15 text-green-400 border-green-500/25 text-[9px] px-1.5 py-0 h-4 font-mono">✓ verified</Badge>
                        </div>
                        <p className="text-xs text-white/50">{c.title}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!c.phone}
                      onClick={() => callWithAtom(c)}
                      className="h-8 text-xs px-3 gap-1.5 bg-teal-600/15 hover:bg-teal-600/25 text-teal-300 border border-teal-500/20 shrink-0"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />Call with ATOM
                    </Button>
                  </div>
                  {/* Contact details row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 pl-[52px]">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-teal-400 transition-colors">
                        <Mail className="w-3.5 h-3.5" />{c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-teal-400 transition-colors">
                        <Phone className="w-3.5 h-3.5" />{c.phone}
                      </a>
                    )}
                    {c.linkedin && (
                      <a href={c.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-blue-400/70 hover:text-blue-400 transition-colors">
                        <Linkedin className="w-3.5 h-3.5" />LinkedIn
                      </a>
                    )}
                  </div>
                  {/* Location + tags row */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-[52px]">
                    {(c.city || c.state) && (
                      <span className="flex items-center gap-1 text-[10px] text-white/25">
                        <MapPin className="w-3 h-3" />{[c.city, c.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                    <Badge className="bg-white/5 text-white/30 border-white/[0.06] text-[9px] px-1.5 py-0 h-4 font-mono">
                      {c.title?.toLowerCase().includes("vp") || c.title?.toLowerCase().includes("vice") ? "vp" : c.title?.toLowerCase().includes("director") ? "director" : c.title?.toLowerCase().includes("chief") || c.title?.toLowerCase().includes("cto") || c.title?.toLowerCase().includes("ceo") ? "c-suite" : "senior"}
                    </Badge>
                    <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20 text-[9px] px-1.5 py-0 h-4 font-mono">ATOM Verified</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* COMPETITIVE */}
      {tab === "competitive" && (
        <div className="space-y-3">
          {(!wb?.competitors || wb.competitors.length === 0) ? (
            <EmptyState icon={Shield} label="No competitive data available" />
          ) : (
            wb.competitors.map((comp, i) => (
              <Card key={i} className="bg-[#111113] border-white/[0.08] hover:border-white/15 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-white/30" />
                      <span className="text-sm font-semibold text-[#e8e8ea]">{comp.name}</span>
                    </div>
                    <Badge className={`text-[10px] font-mono border ${threatColor(comp.threat)}`}>
                      {comp.threat.toUpperCase()} THREAT
                    </Badge>
                  </div>
                  <p className="text-xs text-white/55 leading-relaxed">{comp.differentiator}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* PAIN POINTS */}
      {tab === "pain" && (
        <div className="space-y-3">
          {(!wb?.painPoints || wb.painPoints.length === 0) ? (
            <EmptyState icon={AlertCircle} label="No pain points identified" />
          ) : (
            wb.painPoints.map((pp, i) => (
              <Card key={i} className="bg-[#111113] border-white/[0.08] hover:border-white/15 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <Badge className={`text-[10px] font-mono border shrink-0 ${severityColor(pp.severity)}`}>
                      {pp.severity.toUpperCase()}
                    </Badge>
                    <p className="text-sm font-medium text-[#e8e8ea]">{pp.pain}</p>
                  </div>
                  <div className="flex items-start gap-2 mt-2 pl-1">
                    <Zap className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-teal-300/70 leading-relaxed"><span className="text-teal-400/60 font-mono text-[10px] uppercase mr-1">How we help:</span>{pp.opportunity}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* BUYING SIGNALS */}
      {tab === "signals" && (
        <div className="space-y-3">
          {(!wb?.buyingSignals || wb.buyingSignals.length === 0) ? (
            <EmptyState icon={Activity} label="No buying signals detected" />
          ) : (
            wb.buyingSignals.map((sig, i) => (
              <Card key={i} className="bg-[#111113] border-white/[0.08] hover:border-white/15 transition-all">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <div className="flex items-start gap-2">
                      <Activity className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-[#e8e8ea]">{sig.signal}</p>
                    </div>
                    <Badge className={`text-[10px] font-mono border shrink-0 ${strengthColor(sig.strength)}`}>
                      {sig.strength.toUpperCase()}
                    </Badge>
                  </div>
                  {sig.source && (
                    <p className="text-[11px] text-white/30 pl-6"><span className="font-mono text-[9px] uppercase">source:</span> {sig.source}</p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* NEWS */}
      {tab === "news" && (
        <div className="space-y-3">
          {(!wb?.recentNews || wb.recentNews.length === 0) ? (
            <EmptyState icon={Newspaper} label="No recent news found" />
          ) : (
            <div className="relative pl-5">
              {/* Timeline line */}
              <div className="absolute left-0 top-2 bottom-2 w-px bg-white/[0.06]" />
              <div className="space-y-3">
                {wb.recentNews.map((n, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-5 top-3 w-2 h-2 rounded-full bg-teal-500/60 border border-teal-500/40" />
                    <Card className="bg-[#111113] border-white/[0.08] hover:border-teal-500/20 transition-all">
                      <CardContent className="p-3.5">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="text-sm font-medium text-[#e8e8ea]">{n.headline}</p>
                          {n.date && (
                            <span className="text-[10px] text-white/30 font-mono shrink-0">{n.date}</span>
                          )}
                        </div>
                        {n.relevance && (
                          <p className="text-xs text-white/45 leading-relaxed">{n.relevance}</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* BATTLE CARD — competitive intel from ATOM Deep Research */}
      {tab === "battlecard" && (
        <div className="space-y-5">
          {(() => {
            const bc = wb.battleCard;
            if (!bc) return <p className="text-[#8a8a96]">No battle card data available. Run a new WarBook to generate competitive battle card intel.</p>;
            return (
              <>
                {/* Pricing & Contracts */}
                <Card className="bg-[#111113] border-white/[0.08]">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-amber-400" />
                      <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Pricing & Contract Intel</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-[#161618] rounded-lg p-3 border border-white/[0.05]">
                        <span className="text-xs text-[#4a4a55] font-mono uppercase tracking-wider">Pricing Model</span>
                        <p className="text-sm text-[#e8e8ea] mt-1">{bc.pricingModel || "Unknown"}</p>
                      </div>
                      <div className="bg-[#161618] rounded-lg p-3 border border-white/[0.05]">
                        <span className="text-xs text-[#4a4a55] font-mono uppercase tracking-wider">Contract Terms</span>
                        <p className="text-sm text-[#e8e8ea] mt-1">{bc.contractTerms || "Unknown"}</p>
                      </div>
                      {bc.switchingCost && (
                        <div className="bg-[#161618] rounded-lg p-3 border border-white/[0.05] md:col-span-2">
                          <span className="text-xs text-[#4a4a55] font-mono uppercase tracking-wider">Switching Cost</span>
                          <p className="text-sm text-[#e8e8ea] mt-1">{bc.switchingCost}</p>
                        </div>
                      )}
                      {bc.winRate && (
                        <div className="bg-[#161618] rounded-lg p-3 border border-white/[0.05] md:col-span-2">
                          <span className="text-xs text-[#4a4a55] font-mono uppercase tracking-wider">Estimated Win Rate</span>
                          <p className="text-sm text-teal-400 font-semibold mt-1">{bc.winRate}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Known Weaknesses */}
                {bc.knownWeaknesses?.length > 0 && (
                  <Card className="bg-[#111113] border-white/[0.08]">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-4 h-4 text-red-400" />
                        <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Known Weaknesses</h4>
                      </div>
                      <div className="space-y-2">
                        {bc.knownWeaknesses.map((w: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                            <span className="text-sm text-[#e8e8ea]">{w}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Customer Complaints */}
                {bc.customerComplaints?.length > 0 && (
                  <Card className="bg-[#111113] border-white/[0.08]">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare className="w-4 h-4 text-amber-400" />
                        <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Customer Complaints</h4>
                      </div>
                      <div className="space-y-2">
                        {bc.customerComplaints.map((c: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                            <Flame className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                            <span className="text-sm text-[#e8e8ea]">{c}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Feature Gaps */}
                {bc.featureGaps?.length > 0 && (
                  <Card className="bg-[#111113] border-white/[0.08]">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-purple-400" />
                        <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Feature Gaps (What They're Missing)</h4>
                      </div>
                      <div className="space-y-2">
                        {bc.featureGaps.map((g: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-purple-500/5 border border-purple-500/10 rounded-lg p-3">
                            <ChevronRight className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                            <span className="text-sm text-[#e8e8ea]">{g}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Talking Points */}
                {bc.talkingPoints?.length > 0 && (
                  <Card className="bg-[#111113] border-teal-500/20">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Swords className="w-4 h-4 text-teal-400" />
                        <h4 className="text-sm font-bold text-teal-400" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Competitive Talking Points</h4>
                      </div>
                      <div className="space-y-2">
                        {bc.talkingPoints.map((tp: string, i: number) => (
                          <div key={i} className="flex items-start gap-3 bg-teal-500/5 border border-teal-500/10 rounded-lg p-3">
                            <span className="text-xs font-mono text-teal-400 bg-teal-500/20 px-2 py-0.5 rounded-full shrink-0 mt-0.5">{i + 1}</span>
                            <span className="text-sm text-[#e8e8ea]">{tp}</span>
                            <button onClick={() => copyText(tp)} className="ml-auto shrink-0 text-[#4a4a55] hover:text-teal-400 transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sales Process Weaknesses */}
                {bc.salesProcessWeaknesses?.length > 0 && (
                  <Card className="bg-[#111113] border-white/[0.08]">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-blue-400" />
                        <h4 className="text-sm font-bold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', sans-serif" }}>Their Sales Process Weaknesses</h4>
                      </div>
                      <div className="space-y-2">
                        {bc.salesProcessWeaknesses.map((w: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
                            <ChevronRight className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                            <span className="text-sm text-[#e8e8ea]">{w}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* BATTLE PLAN */}
      {tab === "battleplan" && (
        <div className="space-y-5">
          {/* Objection Predictions */}
          {wb?.objectionPredictions && wb.objectionPredictions.length > 0 && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
                    Predicted Objections
                  </span>
                </div>
                <div className="space-y-3">
                  {wb.objectionPredictions.map((obj, i) => (
                    <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <Badge className={`text-[9px] font-mono border shrink-0 ${probColor(obj.probability)}`}>
                          {obj.probability.toUpperCase()} PROB
                        </Badge>
                        <p className="text-xs font-medium text-white/80">"{obj.objection}"</p>
                        <button onClick={() => copyText(`Objection: ${obj.objection}\n\nCounter: ${obj.counterStrategy}`)}
                          className="ml-auto shrink-0 p-0.5 text-white/15 hover:text-teal-400 transition-colors">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-start gap-2 pl-1">
                        <Shield className="w-3 h-3 text-teal-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-teal-300/70 leading-relaxed">{obj.counterStrategy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pitch Angles */}
          {wb?.pitchAngles && wb.pitchAngles.length > 0 && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-teal-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
                    Recommended Pitch Angles
                  </span>
                </div>
                <div className="space-y-3">
                  {wb.pitchAngles.map((pa, i) => (
                    <div key={i} className="rounded-lg border border-teal-500/15 bg-teal-500/[0.04] p-3">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-sm font-semibold text-teal-300">{pa.angle}</p>
                        <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-[9px] font-mono shrink-0">
                          {pa.targetPersona}
                        </Badge>
                      </div>
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-3 h-3 text-white/25 shrink-0 mt-0.5" />
                        <p className="text-xs text-white/55 italic">"{pa.openingLine}"</p>
                        <button onClick={() => copyText(pa.openingLine)}
                          className="ml-auto shrink-0 p-0.5 text-white/15 hover:text-teal-400 transition-colors">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Call Strategy */}
          {wb?.callStrategy && (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Phone className="w-4 h-4 text-teal-400" />
                  <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
                    Call Strategy
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  {[
                    { label: "Best Time to Call", value: wb.callStrategy.bestTimeToCall, icon: Clock },
                    { label: "Gatekeeper Tips", value: wb.callStrategy.gatekeeperTips, icon: Shield },
                    { label: "Tone", value: wb.callStrategy.toneRecommendation, icon: Activity },
                  ].map((item) => {
                    const Icon = item.icon as any;
                    return (
                      <div key={item.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3 h-3 text-white/25" />
                          <p className="text-[10px] font-mono uppercase tracking-wider text-white/25">{item.label}</p>
                        </div>
                        <p className="text-xs text-white/65">{item.value || "—"}</p>
                      </div>
                    );
                  })}
                </div>

                {wb.callStrategy.keyQuestions && wb.callStrategy.keyQuestions.length > 0 && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-white/25 mb-2">Key Discovery Questions</p>
                    <ul className="space-y-1.5">
                      {wb.callStrategy.keyQuestions.map((q, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                          <span className="text-teal-400/60 font-mono shrink-0">{i + 1}.</span>
                          <span>{q}</span>
                          <button onClick={() => copyText(q)} className="ml-auto shrink-0 p-0.5 text-white/10 hover:text-teal-400 transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Citations ─────────────────────────────────────────────────────── */}
      {result.citations && result.citations.length > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer p-3 bg-[#111113] border border-white/[0.08] rounded-xl hover:border-white/[0.12] transition-colors list-none [&::-webkit-details-marker]:hidden">
            <BookOpen className="w-4 h-4 text-white/30" />
            <span className="text-xs font-semibold text-white/50">Sources & Citations</span>
            <Badge className="bg-white/5 text-white/25 border-white/[0.06] text-[9px] font-mono">{result.citations.length}</Badge>
            <ChevronRight className="w-3.5 h-3.5 text-white/20 ml-auto transition-transform duration-200 group-open:rotate-90" />
          </summary>
          <div className="mt-1 p-3 bg-[#111113] border border-white/[0.08] rounded-xl space-y-1">
            {result.citations.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-[11px] text-white/30 hover:text-teal-400 transition-colors truncate">
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{url}</span>
              </a>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Empty State Helper ───────────────────────────────────────────────────────

function EmptyState({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <Card className="bg-[#111113] border-white/[0.08]">
      <CardContent className="py-12 flex flex-col items-center gap-2">
        <Icon className="w-10 h-10 text-white/10" />
        <p className="text-sm text-white/25">{label}</p>
      </CardContent>
    </Card>
  );
}

// Briefcase icon fix
function Briefcase(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompanyIntelligence() {
  const { toast } = useToast();
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<WarBookResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Animate loading steps
  useEffect(() => {
    if (!loading) { setLoadStep(0); return; }
    const interval = setInterval(() => {
      setLoadStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 3500);
    return () => clearInterval(interval);
  }, [loading]);

  const buildWarBook = async () => {
    if (!company.trim()) {
      toast({ title: "Company name required", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/warbook/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: company.trim(), website: website.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: WarBookResult = await res.json();

      setResult(data);

      // Save to history
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        company: company.trim(),
        website: website.trim() || undefined,
        result: data,
        timestamp: Date.now(),
      };
      const history = loadHistory();
      saveHistory([entry, ...history]);

      toast({ title: `WarBook built for ${company}`, description: `Priority: ${data.warbook?.priorityLevel?.toUpperCase()}` });
    } catch (err: any) {
      toast({ title: "Failed to build WarBook", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") buildWarBook();
  };

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setCompany(entry.company);
    setWebsite(entry.website || "");
    setResult(entry.result);
  };

  return (
    <div className="space-y-6 min-h-screen" style={{ fontFamily: "'Satoshi', Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-teal-400" />
            </div>
            <h1 className="text-2xl font-bold text-[#e8e8ea] tracking-tight"
              style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", letterSpacing: "-0.03em" }}>
              ATOM WarBook
            </h1>
          </div>
          <p className="text-sm text-[#8a8a96] ml-12">
            ATOM Deep Intelligence Engine
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {result && (
            <Button variant="outline" size="sm" onClick={() => { setResult(null); setCompany(""); setWebsite(""); }}
              className="h-8 text-xs border-white/[0.08] text-white/40 hover:text-white hover:border-white/20 bg-transparent">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />New Research
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}
            className="h-8 text-xs gap-1.5 border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 bg-transparent">
            <History className="w-3.5 h-3.5" />History
          </Button>
        </div>
      </div>

      {/* Input Card — always visible */}
      <Card className={`border transition-all ${result ? "border-teal-500/15 bg-teal-500/[0.02]" : "border-white/[0.08] bg-[#111113]"}`}>
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
                <Building2 className="w-3 h-3" />Company Name
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Cloudflare, Akamai, Salesforce..."
                className="w-full h-10 px-3 text-sm rounded-lg border border-white/[0.08] bg-[#161618] text-[#e8e8ea] placeholder:text-white/20 focus:outline-none focus:border-teal-500/40 transition-colors"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-white/35 flex items-center gap-1">
                <Globe className="w-3 h-3" />Website URL <span className="text-white/20">(optional)</span>
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="https://cloudflare.com"
                className="w-full h-10 px-3 text-sm rounded-lg border border-white/[0.08] bg-[#161618] text-[#e8e8ea] placeholder:text-white/20 focus:outline-none focus:border-teal-500/40 transition-colors"
              />
            </div>
            <div className="sm:self-end">
              <Button
                onClick={buildWarBook}
                disabled={!company.trim() || loading}
                className="h-10 px-6 text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white gap-2 w-full sm:w-auto transition-all"
                style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Building...</>
                ) : (
                  <><BookOpen className="w-4 h-4" />Build WarBook</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="bg-[#111113] border-teal-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 rounded-full border-2 border-teal-500/20" />
                <div className="absolute inset-0 rounded-full border-2 border-teal-500 border-r-transparent animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
                  Building WarBook for {company}
                </p>
                <p className="text-xs text-white/30">ATOM Intelligence scanning...</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {LOADING_STEPS.map((step, i) => {
                const Icon = step.icon;
                const done = i < loadStep;
                const active = i === loadStep;
                return (
                  <div key={i} className={`flex items-center gap-3 transition-all ${done ? "opacity-50" : active ? "opacity-100" : "opacity-20"}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                      done ? "bg-emerald-500/20 border-emerald-500/30" :
                      active ? "bg-teal-500/20 border-teal-500/30" :
                      "bg-white/5 border-white/10"
                    }`}>
                      {done
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        : active
                        ? <Loader2 className="w-3 h-3 text-teal-400 animate-spin" />
                        : <Icon className="w-3 h-3 text-white/25" />
                      }
                    </div>
                    <p className={`text-xs ${done ? "text-white/40" : active ? "text-white/80" : "text-white/20"}`}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Skeleton preview */}
            <div className="mt-5 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WarBook Result */}
      {result && !loading && <WarBookDisplay result={result} />}

      {/* Empty state */}
      {!result && !loading && (
        <Card className="bg-[#111113] border-white/[0.08]">
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/5 border border-teal-500/10 flex items-center justify-center mb-2">
              <Brain className="w-8 h-8 text-teal-400/40" />
            </div>
            <p className="text-base font-semibold text-white/30" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
              Enter a company to build their WarBook
            </p>
            <p className="text-sm text-white/20 text-center max-w-sm">
              ATOM will compile a full intelligence package on this company,
              including decision makers, pain points, buying signals, and a complete battle plan.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              {["Cloudflare", "Akamai", "Salesforce", "HubSpot", "Snowflake"].map((ex) => (
                <button key={ex} onClick={() => setCompany(ex)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/[0.08] text-white/30 hover:text-teal-400 hover:border-teal-500/20 hover:bg-teal-500/5 transition-all font-mono">
                  {ex}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History Drawer */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestoreHistory}
      />
    </div>
  );
}
