import { Link, useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { Home, Calendar, Users, Settings, Plus } from "lucide-react";
import { useState } from "react";
import { BookingFlowDialog } from "./BookingFlowDialog";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { ONBOARDING_HINT_KEY } from "@/lib/onboarding";

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [guardNav, setGuardNav] = useState(false);
  const [hint, setHint] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_HINT_KEY) === "1"; } catch { return false; }
  });
  const showHint = hint;

  function closeHint() {
    localStorage.removeItem(ONBOARDING_HINT_KEY);
    setHint(false);
  }

  function handleDialogOpen(open: boolean) {
    setIsAddOpen(open);
    if (!open) {
      setGuardNav(true);
      window.setTimeout(() => setGuardNav(false), 500);
    }
  }

  const isTeam = user?.mode === "team";

  const leftItems = [
    { href: "/dashboard", icon: Home, label: t("nav.dashboard") },
    { href: "/calendar", icon: Calendar, label: isTeam ? t("nav.calendar.team") : t("nav.calendar") },
  ];

  const rightItems = [
    { href: "/clients", icon: Users, label: t("nav.clients") },
    { href: "/settings", icon: Settings, label: t("nav.settings") },
  ];

  function NavItem({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) {
    const isActive = href === "/settings"
      ? location.startsWith("/settings")
      : location === href;

    return (
      <Link href={href} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1">
        <motion.div whileTap={{ scale: 0.85 }}>
          <Icon
            className={`w-[22px] h-[22px] transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
          />
        </motion.div>
        <span
          className={`text-[9px] font-medium leading-tight transition-colors text-center ${
            isActive ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {label}
        </span>
      </Link>
    );
  }

  return (
    <>
      <div id="bottom-nav-root" className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 pointer-events-none transition-opacity duration-200">
        <div className={`mx-auto max-w-md ${isAddOpen || guardNav ? "pointer-events-none" : "pointer-events-auto"}`}>
          <div className="glass-panel rounded-3xl flex items-stretch px-2 relative" style={{ minHeight: 64 }}>

            {/* Left two items — each flex-1 */}
            {leftItems.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}

            {/* Center FAB column — flex-1 */}
            <div className="flex-1 flex flex-col items-center justify-start pt-0">
              <div className="relative" style={{ top: -22 }}>
                {showHint && (
                  <div className="absolute bottom-[68px] left-1/2 w-52 -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-center text-[13px] leading-snug text-foreground shadow-lg">
                    Birinchi mijozingizni shu yerdan qo‘shing
                    <span className="absolute left-1/2 -bottom-1.5 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-zinc-900" />
                  </div>
                )}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.06 }}
                  onClick={() => { closeHint(); setIsAddOpen(true); }}
                  className={`flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary to-amber-600 text-black shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow duration-300 ${showHint ? "plus-glow" : ""}`}
                >
                  <Plus className="w-8 h-8" />
                </motion.button>
              </div>
            </div>

            {/* Right two items — each flex-1 */}
            {rightItems.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </div>
        </div>
      </div>

      <BookingFlowDialog
        open={isAddOpen}
        onOpenChange={handleDialogOpen}
        isTeam={isTeam}
      />
    </>
  );
}
