import { Link, useLocation } from "wouter";
import { useTranslation } from "@/i18n/LanguageContext";
import { Home, Calendar, Users, Settings, Plus } from "lucide-react";
import { useState } from "react";
import { QuickAddClientDialog } from "./QuickAddClientDialog";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";

export function BottomNav() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

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
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 pointer-events-none">
        <div className="mx-auto max-w-md pointer-events-auto">
          <div className="glass-panel rounded-3xl flex items-stretch px-2 relative" style={{ minHeight: 64 }}>

            {/* Left two items — each flex-1 */}
            {leftItems.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}

            {/* Center FAB column — flex-1 */}
            <div className="flex-1 flex flex-col items-center justify-start pt-0">
              <div className="relative" style={{ top: -22 }}>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.06 }}
                  onClick={() => setIsAddOpen(true)}
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary to-amber-600 text-black shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-shadow duration-300"
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

      <QuickAddClientDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
    </>
  );
}
