import { Link, useLocation } from "wouter";
import { 
  Shield, MessageSquareWarning, TrendingUp, 
  Radar, ChevronLeft, ChevronRight, Moon, Sun, PhoneCall, Megaphone, Brain,
  Menu, X, Swords
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem { href: string; icon: any; label: string; }

const navItems: NavItem[] = [
  { href: "/war-room", icon: Swords, label: "ATOM War Room" },
  { href: "/pitch", icon: TrendingUp, label: "ATOM Pitch" },
  { href: "/objections", icon: MessageSquareWarning, label: "ATOM Objection Handler" },
  { href: "/market", icon: Shield, label: "ATOM Market Intent" },
  { href: "/prospects", icon: Radar, label: "ATOM Prospect" },
  { href: "/atom-leadgen", icon: PhoneCall, label: "ATOM Lead Gen" },
  { href: "/atom-campaign", icon: Megaphone, label: "ATOM Campaign" },
  { href: "/company-intelligence", icon: Brain, label: "ATOM WarBook" },
];

// ATOM Sales Dominator Logo — Neon red atomic orbitals + crossed swords + CPU core
function AtomLogo({ size = 36 }: { size?: number }) {
  const glowId = `atom-glow-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="ATOM Sales Dominator" style={{ filter: `drop-shadow(0 0 6px rgba(239,68,68,0.6)) drop-shadow(0 0 2px rgba(255,60,60,0.8))` }}>
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="glow"/>
          <feMerge>
            <feMergeNode in="glow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${glowId})`} stroke="#ef4444" strokeWidth="1.5" fill="none" strokeLinecap="round">
        {/* Crossed swords (behind orbitals) */}
        <g opacity="0.95">
          {/* Sword 1: top-left to bottom-right */}
          <line x1="8" y1="8" x2="40" y2="40" strokeWidth="1.2"/>
          <line x1="6" y1="10" x2="10" y2="6" strokeWidth="1.5"/>
          {/* Sword 2: top-right to bottom-left */}
          <line x1="40" y1="8" x2="8" y2="40" strokeWidth="1.2"/>
          <line x1="38" y1="10" x2="42" y2="6" strokeWidth="1.5"/>
        </g>
        {/* Atomic orbitals — 3 ellipses at different rotations */}
        <ellipse cx="24" cy="24" rx="18" ry="7" strokeWidth="1.3"/>
        <ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(60 24 24)" strokeWidth="1.3"/>
        <ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(-60 24 24)" strokeWidth="1.3"/>
        {/* CPU chip core */}
        <rect x="19" y="19" width="10" height="10" rx="1" strokeWidth="1.2" fill="#0b0b0c"/>
        {/* CPU pins */}
        <line x1="21" y1="17" x2="21" y2="19" strokeWidth="0.8"/>
        <line x1="24" y1="17" x2="24" y2="19" strokeWidth="0.8"/>
        <line x1="27" y1="17" x2="27" y2="19" strokeWidth="0.8"/>
        <line x1="21" y1="29" x2="21" y2="31" strokeWidth="0.8"/>
        <line x1="24" y1="29" x2="24" y2="31" strokeWidth="0.8"/>
        <line x1="27" y1="29" x2="27" y2="31" strokeWidth="0.8"/>
        <line x1="17" y1="21" x2="19" y2="21" strokeWidth="0.8"/>
        <line x1="17" y1="24" x2="19" y2="24" strokeWidth="0.8"/>
        <line x1="17" y1="27" x2="19" y2="27" strokeWidth="0.8"/>
        <line x1="29" y1="21" x2="31" y2="21" strokeWidth="0.8"/>
        <line x1="29" y1="24" x2="31" y2="24" strokeWidth="0.8"/>
        <line x1="29" y1="27" x2="31" y2="27" strokeWidth="0.8"/>
        {/* CPU inner grid */}
        <rect x="21.5" y="21.5" width="5" height="5" strokeWidth="0.7" opacity="0.7"/>
      </g>
    </svg>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => { setMobileOpen(false); }, [location]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Ambient purple glow at bottom */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-48 blur-3xl opacity-[0.15] rounded-full translate-y-1/2" style={{ background: "#dc2626" }} />

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {!isMobile && collapsed ? (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <AtomLogo size={22} />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="shrink-0"><AtomLogo size={32} /></div>
            <div className="min-w-0 flex-1">
              <h1
                className="text-lg font-bold tracking-tight leading-none truncate"
                style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: "#f6f6fd", letterSpacing: "-0.03em", textShadow: "0 0 8px rgba(239,68,68,0.25)" }}
              >
                AT<span style={{ color: "#ef4444", textShadow: "0 0 8px rgba(239,68,68,0.7)" }}>O</span>M
              </h1>
              <p className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: "rgba(239,68,68,0.6)", fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                Sales Dominator
              </p>
            </div>
            {isMobile && (
              <button onClick={() => setMobileOpen(false)} className="ml-auto shrink-0 w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: "rgba(255,255,255,0.4)" }} aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Flat nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center gap-2.5 px-3 py-2.5 text-[13px] transition-all rounded-lg ${collapsed && !isMobile ? "justify-center" : ""}`}
              style={isActive ? {
                background: "rgba(105,106,172,0.1)",
                color: "#a2a3e9",
                boxShadow: "inset 0 0 12px rgba(105,106,172,0.08)"
              } : {
                color: "rgba(255,255,255,0.6)"
              }}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
            >
              {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: "#696aac" }} />}
              <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? "#a2a3e9" : "rgba(255,255,255,0.5)" }} />
              {(!collapsed || isMobile) && <span className="truncate min-w-0 font-medium">{item.label}</span>}
            </Link>
          );
          if (collapsed && !isMobile) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return <div key={item.href}>{linkContent}</div>;
        })}
      </nav>

      {/* Footer */}
      <div className="relative border-t p-2 space-y-1 shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {(!collapsed || isMobile) && (
          <div className="px-3 py-2">
            <p className="text-xs font-light" style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
              ATOM · Nirmata Holdings · © 2026
            </p>
          </div>
        )}
        <Button
          variant="ghost" size="sm"
          className="w-full justify-start hover:bg-white/[0.03]"
          style={{ color: "rgba(255,255,255,0.55)" }}
          onClick={() => setIsDark(!isDark)}
          data-testid="button-theme-toggle"
        >
          {isDark ? <Sun className="w-4 h-4 mr-2 shrink-0" /> : <Moon className="w-4 h-4 mr-2 shrink-0" />}
          {(!collapsed || isMobile) && (isDark ? "Light Mode" : "Dark Mode")}
        </Button>
        {!isMobile && (
          <Button
            variant="ghost" size="sm"
            className="w-full justify-start hover:bg-white/[0.03]"
            style={{ color: "rgba(255,255,255,0.55)" }}
            onClick={() => setCollapsed(!collapsed)}
            data-testid="button-collapse-sidebar"
          >
            {collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <><ChevronLeft className="w-4 h-4 mr-2 shrink-0" />Collapse</>}
          </Button>
        )}
      </div>
    </>
  );

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <aside
          className={`relative hidden md:flex flex-col border-r text-sidebar-foreground transition-all duration-300 overflow-hidden ${collapsed ? "w-16" : "w-64"}`}
          style={{ background: "#08080c", borderColor: "rgba(255,255,255,0.08)" }}
        >
          <SidebarContent isMobile={false} />
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col border-r text-sidebar-foreground overflow-hidden z-10" style={{ background: "#08080c", borderColor: "rgba(255,255,255,0.08)" }}>
              <SidebarContent isMobile={true} />
            </aside>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex md:hidden items-center gap-3 h-14 px-4 border-b shrink-0" style={{ background: "#08080c", borderColor: "rgba(255,255,255,0.08)" }}>
            <button onClick={() => setMobileOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/5" style={{ color: "rgba(255,255,255,0.6)" }} aria-label="Open menu" data-testid="button-mobile-menu">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <AtomLogo size={22} />
                <span className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", color: "#f6f6fd", letterSpacing: "-0.02em" }}>
                  AT<span style={{ color: "#ef4444", textShadow: "0 0 6px rgba(239,68,68,0.7)" }}>O</span>M
                </span>
              </div>
            </div>
            <div className="w-10" />
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="p-4 md:p-6 md:max-w-[1400px] md:mx-auto">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
