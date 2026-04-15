import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { type Prospect, type Contact } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Radar,
  Loader2,
  Signal,
  ChevronDown,
  ChevronUp,
  Flame,
  Mail,
  Phone,
  Linkedin,
  User,
  Globe,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  PhoneCall,
  History,
  Plus,
  Download,
  Search,
  SlidersHorizontal,
  X,
  Building2,
  Users,
  DollarSign,
  MapPin,
  Cpu,
  Tag,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Clock,
  ArrowLeft,
} from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────

const INDUSTRIES = [
  "All Industries",
  "Technology & SaaS",
  "Healthcare & Life Sciences",
  "Financial Services & Banking",
  "Real Estate & PropTech",
  "Manufacturing",
  "Retail & E-Commerce",
  "Insurance",
  "Defense & Government",
  "Energy & Utilities",
  "Education & EdTech",
  "Transportation & Logistics",
  "Media & Entertainment",
  "Telecommunications",
  "Legal Services",
  "Construction & Engineering",
  "Agriculture & Food Tech",
  "Hospitality & Travel",
  "Non-Profit & NGO",
  "Automotive",
  "Aerospace",
  "Cybersecurity",
  "Biotech & Pharma",
];

const GEOGRAPHIES = [
  { value: "All US", label: "All US" },
  { value: "US South", label: "US South (TX, FL, GA, NC, TN...)" },
  { value: "US Northeast", label: "US Northeast (NY, NJ, MA, CT, PA...)" },
  { value: "US Midwest", label: "US Midwest (IL, OH, MI, IN, MN...)" },
  { value: "US West", label: "US West (CA, WA, OR, CO, AZ...)" },
  { value: "US Southeast", label: "US Southeast (FL, GA, NC, SC, VA...)" },
  { value: "Texas", label: "Texas" },
  { value: "California", label: "California" },
  { value: "New York", label: "New York" },
  { value: "Florida", label: "Florida" },
  { value: "Illinois", label: "Illinois" },
  { value: "Georgia", label: "Georgia" },
  { value: "North Carolina", label: "North Carolina" },
  { value: "Washington", label: "Washington" },
  { value: "Massachusetts", label: "Massachusetts" },
  { value: "Colorado", label: "Colorado" },
  { value: "Arizona", label: "Arizona" },
  { value: "Tennessee", label: "Tennessee" },
  { value: "Pennsylvania", label: "Pennsylvania" },
  { value: "Ohio", label: "Ohio" },
  { value: "EU", label: "EU (Germany, France, Netherlands...)" },
  { value: "UK", label: "United Kingdom" },
  { value: "Canada", label: "Canada" },
  { value: "Global", label: "Global" },
];

const EMPLOYEE_SIZES = [
  { value: "", label: "Any Size" },
  { value: "1-10", label: "1–10 employees" },
  { value: "11-50", label: "11–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-500", label: "201–500 employees" },
  { value: "501-1000", label: "501–1,000 employees" },
  { value: "1001-5000", label: "1,001–5,000 employees" },
  { value: "5001-10000", label: "5,001–10,000 employees" },
  { value: "10001+", label: "10,000+ employees" },
];

const REVENUE_RANGES = [
  { value: "", label: "Any Revenue" },
  { value: "under-1m", label: "Under $1M" },
  { value: "1m-10m", label: "$1M – $10M" },
  { value: "10m-50m", label: "$10M – $50M" },
  { value: "50m-100m", label: "$50M – $100M" },
  { value: "100m-500m", label: "$100M – $500M" },
  { value: "500m-1b", label: "$500M – $1B" },
  { value: "1b+", label: "$1B+" },
];

const JOB_TITLES = [
  "CEO", "CTO", "CIO", "CISO", "CFO", "COO",
  "VP Engineering", "VP Sales", "VP Operations", "VP IT",
  "Director of IT", "Director of Engineering",
  "Head of AI", "Head of Technology",
  "Chief Digital Officer", "Chief Innovation Officer",
  "SVP Technology", "Managing Director", "President", "Owner", "Founder",
];

const STORAGE_KEY = "atom_prospect_history";
const PAGE_SIZE = 10;

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScanFilters {
  industry: string;
  geo: string;
  employeeSize: string;
  revenueRange: string;
  productFocus: string;
  jobTitles: string[];
  techStack: string;
  keywords: string;
}

interface HistoryEntry {
  id: string;
  filters: ScanFilters;
  prospects: Prospect[];
  timestamp: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 50)));
  } catch {}
}

function filterSummary(filters: ScanFilters): string {
  const parts: string[] = [];
  if (filters.industry && filters.industry !== "All Industries") parts.push(filters.industry);
  if (filters.geo && filters.geo !== "All US") parts.push(filters.geo);
  if (filters.employeeSize) parts.push(filters.employeeSize + " emp");
  if (filters.revenueRange) parts.push(filters.revenueRange);
  if (filters.productFocus) parts.push(`"${filters.productFocus}"`);
  if (filters.jobTitles.length > 0) parts.push(filters.jobTitles.slice(0, 2).join(", "));
  if (filters.techStack) parts.push(filters.techStack);
  if (filters.keywords) parts.push(filters.keywords);
  return parts.length > 0 ? parts.join(" · ") : "All prospects";
}

function exportToCSV(prospects: Prospect[]) {
  const rows: string[] = [];
  rows.push(["Company","Domain","Industry","Score","Company Size","Employee Count","Revenue","Urgency","Status","Contact Name","Contact Title","Email","Phone","LinkedIn","Reason"].join(","));
  for (const p of prospects) {
    const contacts: Contact[] = JSON.parse(p.contacts || "[]");
    if (contacts.length === 0) {
      rows.push([`"${p.companyName}"`,p.domain,`"${p.industry}"`,p.score,p.companySize,(p as any).employeeCount||"",`"${(p as any).revenue||""}"`,p.urgency,p.status,"","","","","",`"${p.reason.replace(/"/g,"'")}"`].join(","));
    } else {
      for (const c of contacts) {
        rows.push([`"${p.companyName}"`,p.domain,`"${p.industry}"`,p.score,p.companySize,(p as any).employeeCount||"",`"${(p as any).revenue||""}"`,p.urgency,p.status,`"${c.firstName} ${c.lastName}"`,`"${c.position}"`,c.email,c.phone||"",c.linkedin||"",`"${p.reason.replace(/"/g,"'")}"`].join(","));
      }
    }
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prospects-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-rose-500" : score >= 60 ? "bg-amber-500" : "bg-teal-600";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${score >= 80 ? "text-rose-500" : score >= 60 ? "text-amber-500" : "text-teal-300"}`}>
        {Math.round(score)}
      </span>
    </div>
  );
}

function VerificationBadge({ status }: { status: string }) {
  if (status === "valid" || status === "verified")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[9px] gap-0.5 px-1.5">
        <CheckCircle2 className="w-2.5 h-2.5" />verified
      </Badge>
    );
  if (status === "accept_all")
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-[9px] gap-0.5 px-1.5">
        <ShieldCheck className="w-2.5 h-2.5" />accept-all
      </Badge>
    );
  return (
    <Badge className="bg-white/5 text-white/40 border-white/10 text-[9px] gap-0.5 px-1.5">
      <AlertCircle className="w-2.5 h-2.5" />unverified
    </Badge>
  );
}

function ContactRow({ contact, prospect, compact = false }: { contact: Contact; prospect: Prospect; compact?: boolean }) {
  const [, navigate] = useLocation();
  const matchedProducts = JSON.parse(prospect.matchedProducts || "[]") as string[];

  const handleCallAtom = () => {
    const params = new URLSearchParams({
      company: prospect.companyName,
      contact: `${contact.firstName} ${contact.lastName}`,
      title: contact.position || "",
      phone: contact.phone || "",
      product: matchedProducts[0] || "",
    });
    navigate(`/atom-leadgen?${params.toString()}`);
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
            <User className="w-3 h-3 text-teal-300" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate text-white/90">{contact.firstName} {contact.lastName}</p>
            <p className="text-[10px] text-white/40 truncate">{contact.position}</p>
          </div>
        </div>
        <Button size="sm" onClick={handleCallAtom} disabled={!contact.phone}
          className="h-6 text-[10px] px-2 gap-1 bg-teal-600/15 hover:bg-teal-600/25 text-teal-300 border border-teal-500/20 shrink-0">
          <PhoneCall className="w-2.5 h-2.5" />Call
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-teal-300" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/90">{contact.firstName} {contact.lastName}</p>
            <p className="text-xs text-white/50">{contact.position}</p>
          </div>
        </div>
        <Button size="sm" onClick={handleCallAtom} disabled={!contact.phone}
          className="h-7 text-xs px-2.5 gap-1.5 bg-teal-600/15 hover:bg-teal-600/25 text-teal-300 border border-teal-500/20 shrink-0">
          <PhoneCall className="w-3 h-3" />Call with ATOM
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-teal-300 transition-colors">
            <Mail className="w-3 h-3" />{contact.email}
            {contact.emailStatus && <VerificationBadge status={contact.emailStatus} />}
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-[10px] text-white/50 hover:text-teal-300 transition-colors">
            <Phone className="w-3 h-3" />{contact.phone}
          </a>
        )}
        {contact.linkedin && (
          <a href={contact.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-white/50 hover:text-teal-300 transition-colors">
            <Linkedin className="w-3 h-3" />LinkedIn
          </a>
        )}
      </div>
    </div>
  );
}

function ProspectCard({ prospect, isViewingHistory }: { prospect: Prospect; isViewingHistory: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const contacts: Contact[] = JSON.parse(prospect.contacts || "[]");
  const matchedProducts: string[] = JSON.parse(prospect.matchedProducts || "[]");
  const [, navigate] = useLocation();

  const urgencyColor = prospect.urgency === "hot" ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
    : prospect.urgency === "warm" ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
    : "text-teal-400 border-teal-500/30 bg-teal-500/10";

  return (
    <Card className="bg-[#111113] border-white/[0.08] hover:border-teal-500/20 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
                    {prospect.companyName}
                  </h3>
                  <Badge className={`text-[10px] px-1.5 py-0 border font-mono ${urgencyColor}`}>
                    {prospect.urgency === "hot" && <Flame className="w-2.5 h-2.5 mr-0.5" />}
                    {prospect.urgency}
                  </Badge>
                  {matchedProducts.map((p) => (
                    <Badge key={p} className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-300 border-purple-500/20 font-mono">{p}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[11px] text-white/40 flex items-center gap-1"><Globe className="w-3 h-3" />{prospect.domain}</span>
                  {prospect.industry && <span className="text-[11px] text-white/40 flex items-center gap-1"><Briefcase className="w-3 h-3" />{prospect.industry}</span>}
                  {(prospect as any).location && <span className="text-[11px] text-white/40 flex items-center gap-1"><MapPin className="w-3 h-3" />{(prospect as any).location}</span>}
                  {(prospect as any).employeeCount && <span className="text-[11px] text-white/40 flex items-center gap-1"><Users className="w-3 h-3" />{(prospect as any).employeeCount}</span>}
                  {(prospect as any).revenue && <span className="text-[11px] text-white/40 flex items-center gap-1"><DollarSign className="w-3 h-3" />{(prospect as any).revenue}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-28">
                  <p className="text-[9px] text-white/30 mb-1 font-mono uppercase tracking-wider">Intel Score</p>
                  <ScoreBar score={prospect.score} />
                </div>
              </div>
            </div>

            {prospect.reason && (
              <p className="text-xs text-white/50 mt-2 leading-relaxed line-clamp-2">{prospect.reason}</p>
            )}

            {contacts.length > 0 && !expanded && (
              <div className="mt-3 space-y-1">
                {contacts.slice(0, 2).map((c, i) => (
                  <ContactRow key={i} contact={c} prospect={prospect} compact />
                ))}
                {contacts.length > 2 && (
                  <button onClick={() => setExpanded(true)} className="text-[11px] text-teal-400/70 hover:text-teal-400 transition-colors">
                    +{contacts.length - 2} more contacts
                  </button>
                )}
              </div>
            )}

            {expanded && (
              <div className="mt-3 space-y-2">
                {contacts.map((c, i) => (
                  <ContactRow key={i} contact={c} prospect={prospect} />
                ))}
                <button onClick={() => setExpanded(false)} className="text-[11px] text-white/30 hover:text-white/50 transition-colors">
                  Show less
                </button>
              </div>
            )}

            {!expanded && contacts.length <= 2 && contacts.length > 0 && (
              <button onClick={() => setExpanded(true)} className="text-[11px] text-teal-400/70 hover:text-teal-400 transition-colors mt-2">
                View full details
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card className="bg-[#111113] border-white/[0.08]">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <Skeleton className="w-10 h-10 rounded-lg bg-white/5" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48 bg-white/5" />
            <Skeleton className="h-3 w-32 bg-white/5" />
            <Skeleton className="h-3 w-full bg-white/5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── History Drawer ──────────────────────────────────────────────────────────

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

  useEffect(() => {
    if (open) setHistory(loadHistory());
  }, [open]);

  const deleteEntry = (id: string) => {
    const updated = history.filter((e) => e.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  const clearAll = () => {
    setHistory([]);
    saveHistory([]);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}
      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-96 z-50 flex flex-col transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "#111113", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
              Search History
            </span>
            {history.length > 0 && (
              <Badge className="bg-teal-500/15 text-teal-400 border-teal-500/20 text-[10px] font-mono">{history.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}
                className="h-7 text-xs text-white/30 hover:text-rose-400 hover:bg-rose-500/10 px-2">
                Clear all
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}
              className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/5">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <History className="w-10 h-10 text-white/10 mb-3" />
              <p className="text-sm text-white/30">No search history yet</p>
              <p className="text-xs text-white/20 mt-1">Past searches will appear here</p>
            </div>
          ) : (
            history.map((entry) => (
              <div key={entry.id}
                className="rounded-xl border border-white/[0.08] bg-[#161618] p-3 hover:border-teal-500/20 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <button className="flex-1 text-left" onClick={() => { onRestore(entry); onClose(); }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Clock className="w-3 h-3 text-white/30" />
                      <span className="text-[10px] text-white/30 font-mono">{formatTimestamp(entry.timestamp)}</span>
                      <Badge className="bg-teal-500/10 text-teal-400/70 border-teal-500/15 text-[10px] font-mono ml-auto">
                        {entry.prospects.length} results
                      </Badge>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">{filterSummary(entry.filters)}</p>
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => deleteEntry(entry.id)}
                    className="h-6 w-6 p-0 text-white/20 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <button
                  className="mt-2 w-full text-[10px] text-teal-400/60 hover:text-teal-400 transition-colors text-left flex items-center gap-1"
                  onClick={() => { onRestore(entry); onClose(); }}
                >
                  <ArrowLeft className="w-3 h-3 rotate-180" />
                  Re-view these results
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── Filter Panel ────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters: ScanFilters;
  onChange: (f: ScanFilters) => void;
  onScan: () => void;
  isScanning: boolean;
}

function FilterPanel({ filters, onChange, onScan, isScanning }: FilterPanelProps) {
  const set = (key: keyof ScanFilters, val: any) => onChange({ ...filters, [key]: val });

  const toggleTitle = (t: string) => {
    const cur = filters.jobTitles;
    set("jobTitles", cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]);
  };

  return (
    <div className="space-y-5">
      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1">
            <Briefcase className="w-3 h-3" />Industry
          </label>
          <Select value={filters.industry} onValueChange={(v) => set("industry", v)}>
            <SelectTrigger className="h-9 text-xs bg-[#161618] border-white/[0.08] text-white/70 hover:border-teal-500/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.08] text-white/80 max-h-64">
              {INDUSTRIES.map((i) => <SelectItem key={i} value={i} className="text-xs hover:bg-teal-500/10">{i}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1">
            <MapPin className="w-3 h-3" />Geography
          </label>
          <Select value={filters.geo} onValueChange={(v) => set("geo", v)}>
            <SelectTrigger className="h-9 text-xs bg-[#161618] border-white/[0.08] text-white/70 hover:border-teal-500/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.08] text-white/80 max-h-64">
              {GEOGRAPHIES.map((g) => <SelectItem key={g.value} value={g.value} className="text-xs hover:bg-teal-500/10">{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1">
            <Users className="w-3 h-3" />Company Size
          </label>
          <Select value={filters.employeeSize} onValueChange={(v) => set("employeeSize", v)}>
            <SelectTrigger className="h-9 text-xs bg-[#161618] border-white/[0.08] text-white/70 hover:border-teal-500/30">
              <SelectValue placeholder="Any Size" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.08] text-white/80">
              {EMPLOYEE_SIZES.map((s) => <SelectItem key={s.value} value={s.value || "_any"} className="text-xs hover:bg-teal-500/10">{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1">
            <DollarSign className="w-3 h-3" />Revenue
          </label>
          <Select value={filters.revenueRange} onValueChange={(v) => set("revenueRange", v)}>
            <SelectTrigger className="h-9 text-xs bg-[#161618] border-white/[0.08] text-white/70 hover:border-teal-500/30">
              <SelectValue placeholder="Any Revenue" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1c1f] border-white/[0.08] text-white/80">
              {REVENUE_RANGES.map((r) => <SelectItem key={r.value} value={r.value || "_any"} className="text-xs hover:bg-teal-500/10">{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1">
            <Tag className="w-3 h-3" />Product / Service Focus
          </label>
          <input
            type="text"
            value={filters.productFocus}
            onChange={(e) => set("productFocus", e.target.value)}
            placeholder='e.g. "Cloudflare CDN" or "Akamai"'
            className="w-full h-9 px-3 text-xs rounded-md border border-white/[0.08] bg-[#161618] text-white/70 placeholder:text-white/25 focus:outline-none focus:border-teal-500/40 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1">
            <Cpu className="w-3 h-3" />Tech Stack
          </label>
          <input
            type="text"
            value={filters.techStack}
            onChange={(e) => set("techStack", e.target.value)}
            placeholder="e.g. Salesforce, AWS, HubSpot"
            className="w-full h-9 px-3 text-xs rounded-md border border-white/[0.08] bg-[#161618] text-white/70 placeholder:text-white/25 focus:outline-none focus:border-teal-500/40 transition-colors"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1">
            <Search className="w-3 h-3" />Keywords
          </label>
          <input
            type="text"
            value={filters.keywords}
            onChange={(e) => set("keywords", e.target.value)}
            placeholder="e.g. digital transformation, cloud"
            className="w-full h-9 px-3 text-xs rounded-md border border-white/[0.08] bg-[#161618] text-white/70 placeholder:text-white/25 focus:outline-none focus:border-teal-500/40 transition-colors"
          />
        </div>
      </div>

      {/* Job Titles */}
      <div className="space-y-2">
        <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 flex items-center gap-1">
          <User className="w-3 h-3" />Target Job Titles
        </label>
        <div className="flex flex-wrap gap-1.5">
          {JOB_TITLES.map((t) => {
            const active = filters.jobTitles.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTitle(t)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-all ${
                  active
                    ? "bg-teal-500/20 text-teal-300 border-teal-500/40"
                    : "bg-white/[0.03] text-white/40 border-white/[0.08] hover:border-white/20 hover:text-white/60"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scan Button */}
      <Button
        onClick={onScan}
        disabled={isScanning}
        className="w-full h-11 text-sm font-semibold bg-teal-600 hover:bg-teal-500 text-white gap-2 transition-all"
        style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}
      >
        {isScanning ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Scanning Apollo...</>
        ) : (
          <><Radar className="w-4 h-4" />Scan for Prospects</>
        )}
      </Button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const DEFAULT_FILTERS: ScanFilters = {
  industry: "All Industries",
  geo: "All US",
  employeeSize: "",
  revenueRange: "",
  productFocus: "",
  jobTitles: [],
  techStack: "",
  keywords: "",
};

export default function ProspectEngine() {
  const { toast } = useToast();

  // View state: "form" = show filter form, "results" = show current results, "history-view" = viewing past results
  const [view, setView] = useState<"form" | "results" | "history-view">("form");
  const [filters, setFilters] = useState<ScanFilters>(DEFAULT_FILTERS);
  const [currentResults, setCurrentResults] = useState<Prospect[]>([]);
  const [currentFilters, setCurrentFilters] = useState<ScanFilters>(DEFAULT_FILTERS);

  // History viewer state
  const [historyEntry, setHistoryEntry] = useState<HistoryEntry | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  const scanMutation = useMutation({
    mutationFn: async (f: ScanFilters) => {
      const payload: any = {};
      if (f.industry && f.industry !== "All Industries") payload.industry = f.industry;
      if (f.geo && f.geo !== "All US") payload.geo = f.geo;
      if (f.employeeSize && f.employeeSize !== "_any") payload.employeeSize = f.employeeSize;
      if (f.revenueRange && f.revenueRange !== "_any") payload.revenueRange = f.revenueRange;
      if (f.productFocus) payload.productFocus = f.productFocus;
      if (f.jobTitles.length > 0) payload.jobTitles = f.jobTitles;
      if (f.techStack) payload.techStack = f.techStack;
      if (f.keywords) payload.keywords = f.keywords;
      const res = await apiRequest("POST", "/api/prospects/scan", payload);
      return res.json();
    },
    onSuccess: (data) => {
      const prospects: Prospect[] = data.prospects || data || [];
      // CRITICAL: Set ONLY the new results, clearing any previous ones
      setCurrentResults(prospects);
      setCurrentFilters(filters);
      setPage(1);
      setView("results");

      // Save to history
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        filters: { ...filters },
        prospects,
        timestamp: Date.now(),
      };
      const history = loadHistory();
      saveHistory([entry, ...history]);

      toast({
        title: `${prospects.length} prospects found`,
        description: filterSummary(filters),
      });
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err.message, variant: "destructive" });
    },
  });

  const handleScan = () => {
    // Clear current results BEFORE starting new scan
    setCurrentResults([]);
    setView("form"); // Stay on form while scanning
    scanMutation.mutate(filters);
  };

  const handleNewSearch = () => {
    setCurrentResults([]);
    setHistoryEntry(null);
    setView("form");
    setPage(1);
  };

  const handleRestoreHistory = (entry: HistoryEntry) => {
    setHistoryEntry(entry);
    setView("history-view");
    setPage(1);
  };

  const displayedProspects = view === "history-view" && historyEntry
    ? historyEntry.prospects
    : currentResults;

  const totalPages = Math.ceil(displayedProspects.length / PAGE_SIZE);
  const paginated = displayedProspects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6 min-h-screen" style={{ fontFamily: "'Satoshi', Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <Radar className="w-5 h-5 text-teal-400" />
            </div>
            <h1
              className="text-2xl font-bold text-[#e8e8ea] tracking-tight"
              style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif", letterSpacing: "-0.03em" }}
            >
              ATOM Prospect
            </h1>
          </div>
          <p className="text-sm text-[#8a8a96] ml-12">
            Apollo-powered prospect scanner · find decision makers with verified contact data
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(view === "results" || view === "history-view") && (
            <>
              {view === "results" && currentResults.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => exportToCSV(currentResults)}
                  className="h-8 text-xs gap-1.5 border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 bg-transparent">
                  <Download className="w-3.5 h-3.5" />CSV
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleNewSearch}
                className="h-8 text-xs gap-1.5 border-teal-500/30 text-teal-400 hover:bg-teal-500/10 bg-transparent">
                <Plus className="w-3.5 h-3.5" />New Search
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}
            className="h-8 text-xs gap-1.5 border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 bg-transparent">
            <History className="w-3.5 h-3.5" />History
          </Button>
        </div>
      </div>

      {/* FORM VIEW */}
      {view === "form" && (
        <Card className="bg-[#111113] border-white/[0.08]">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <SlidersHorizontal className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
                Scan Filters
              </span>
              <Badge className="bg-teal-500/10 text-teal-400/70 border-teal-500/15 text-[10px] font-mono ml-auto">
                Apollo · 275M+ contacts
              </Badge>
            </div>
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              onScan={handleScan}
              isScanning={scanMutation.isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* SCANNING SKELETON */}
      {scanMutation.isPending && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
            <span className="text-sm text-teal-400/70">Scanning Apollo database...</span>
          </div>
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* RESULTS VIEW */}
      {(view === "results" || view === "history-view") && !scanMutation.isPending && (
        <div className="space-y-4">
          {/* Results Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              {view === "history-view" && historyEntry && (
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs font-mono gap-1">
                  <History className="w-3 h-3" />Viewing history · {formatTimestamp(historyEntry.timestamp)}
                </Badge>
              )}
              <div className="flex items-center gap-2">
                <Signal className="w-4 h-4 text-teal-400" />
                <span className="text-sm font-semibold text-[#e8e8ea]" style={{ fontFamily: "'Cabinet Grotesk', Arial, sans-serif" }}>
                  {displayedProspects.length} Prospects Found
                </span>
                {displayedProspects.length > 0 && (
                  <Badge className="bg-teal-500/10 text-teal-400/70 border-teal-500/15 text-[10px] font-mono">
                    {filterSummary(view === "history-view" && historyEntry ? historyEntry.filters : currentFilters)}
                  </Badge>
                )}
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/5">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-white/40 font-mono">{page}/{totalPages}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="h-7 w-7 p-0 text-white/40 hover:text-white hover:bg-white/5">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Prospect Cards */}
          {paginated.length === 0 ? (
            <Card className="bg-[#111113] border-white/[0.08]">
              <CardContent className="py-16 flex flex-col items-center gap-3">
                <Radar className="w-12 h-12 text-white/10" />
                <p className="text-sm text-white/30">No prospects found for these filters</p>
                <Button variant="outline" size="sm" onClick={handleNewSearch}
                  className="mt-2 border-teal-500/30 text-teal-400 hover:bg-teal-500/10 bg-transparent">
                  Adjust Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {paginated.map((p) => (
                <ProspectCard key={p.id} prospect={p} isViewingHistory={view === "history-view"} />
              ))}
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="h-8 text-xs gap-1 text-white/40 hover:text-white hover:bg-white/5">
                <ChevronLeft className="w-3.5 h-3.5" />Previous
              </Button>
              <span className="text-xs text-white/30 font-mono">Page {page} of {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="h-8 text-xs gap-1 text-white/40 hover:text-white hover:bg-white/5">
                Next<ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
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
