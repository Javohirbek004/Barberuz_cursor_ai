import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageContext";
import { Layout } from "@/components/Layout";
import { Link, useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MenuItem {
  href?: string;
  emoji: string;
  label: string;
  sub: string;
  onClick?: () => void;
}

// ── Single menu row ───────────────────────────────────────────────────────────
function MenuRow({ item, index }: { item: MenuItem; index: number }) {
  const inner = (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border bg-card border-white/6 hover:bg-white/4 hover:border-white/10 cursor-pointer group transition-all">
      {/* Emoji bubble */}
      <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors text-xl">
        {item.emoji}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight text-foreground">
          {item.label}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{item.sub}</p>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.04 }}
    >
      {item.onClick ? (
        <button className="w-full text-left" onClick={item.onClick}>{inner}</button>
      ) : item.href ? (
        <Link href={item.href}>{inner}</Link>
      ) : inner}
    </motion.div>
  );
}

// ── Telegram banner ───────────────────────────────────────────────────────────
function TelegramBanner() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#2AABEE]/10 border border-[#2AABEE]/25"
    >
      <div className="w-9 h-9 rounded-xl bg-[#2AABEE]/15 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#2AABEE]">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.21-1.12-.33-1.08-.7.02-.19.27-.39.75-.59 2.95-1.28 4.91-2.13 5.89-2.52 2.8-1.13 3.38-1.33 3.76-1.33.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-[#2AABEE] leading-tight">
          ⚠️ {t("settings.telegram.not_connected")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("settings.telegram.connect_msg")}
        </p>
      </div>
      <button
        onClick={() => navigate("/verify-telegram")}
        className="shrink-0 h-8 px-3 rounded-xl bg-[#2AABEE] text-white text-xs font-bold hover:bg-[#229ED9] transition-all"
      >
        {t("settings.telegram.connect_btn")}
      </button>
    </motion.div>
  );
}

// ── Individual view ───────────────────────────────────────────────────────────
function IndividualSettings({ userName, telegramVerified }: { userName: string; telegramVerified: boolean }) {
  const { t } = useTranslation();

  const items: MenuItem[] = [
    { href: "/settings/profile",   emoji: "👤", label: t("settings.profile.solo"),    sub: t("settings.profile.solo_sub") },
    { href: "/settings/page",      emoji: "🌐", label: t("settings.page.solo"),        sub: t("settings.page.solo_sub") },
    { href: "/settings/analytics", emoji: "📊", label: t("settings.analytics"),        sub: t("settings.analytics_sub") },
    { href: "/settings/general",   emoji: "⚙️", label: t("settings.general"),          sub: t("settings.notifications_sub") },
    { href: "/settings/feedback",  emoji: "💬", label: t("settings.feedback"),         sub: t("settings.feedback_sub") },
  ];

  return (
    <>
      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary/15 via-primary/8 to-transparent border border-primary/15 rounded-2xl p-5 mb-6 flex items-center gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/25 flex items-center justify-center font-display font-bold text-primary text-2xl uppercase shadow-lg shadow-primary/10 shrink-0">
          {userName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-foreground text-xl leading-tight break-words">
            {userName}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">{t("settings.role.solo")}</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-400">{t("settings.active")}</span>
          </div>
        </div>
      </motion.div>

      {!telegramVerified && <TelegramBanner />}

      <div className="space-y-2">
        {items.map((item, i) => (
          <MenuRow key={item.label} item={item} index={i} />
        ))}
      </div>
    </>
  );
}

// ── Team view ─────────────────────────────────────────────────────────────────
function TeamSettings({ brandName, userName }: { brandName: string; userName: string }) {
  const { t } = useTranslation();
  const displayBrand = brandName || userName || "Barbershop";

  const items: MenuItem[] = [
    { href: "/settings/profile",   emoji: "🏢",  label: t("settings.profile.team"),   sub: t("settings.profile.team_sub") },
    { href: "/settings/page",      emoji: "🌐",  label: t("settings.page.team"),       sub: t("settings.page.team_sub") },
    { href: "/settings/analytics", emoji: "📊",  label: t("settings.analytics"),       sub: t("settings.analytics_sub") },
    { href: "/settings/barbers",   emoji: "👷‍♂️", label: t("settings.barbers"),         sub: t("settings.barbers_sub") },
    { href: "/settings/general",   emoji: "⚙️",  label: t("settings.general"),         sub: t("settings.notifications_sub") },
    { href: "/settings/feedback",  emoji: "💬",  label: t("settings.feedback"),        sub: t("settings.feedback_sub") },
  ];

  return (
    <>
      {/* Profile card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-amber-500/12 via-amber-500/6 to-transparent border border-amber-500/15 rounded-2xl p-5 mb-6 flex items-center gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/25 to-amber-500/8 border border-amber-500/20 flex items-center justify-center font-display font-bold text-amber-400 text-2xl uppercase shadow-lg shadow-amber-500/10 shrink-0">
          {displayBrand.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-foreground text-xl leading-tight truncate">
            {displayBrand}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            4 {t("settings.team_count")} <span className="text-amber-400 font-semibold">{t("settings.role.team_admin")}</span>
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-400">{t("settings.active")}</span>
          </div>
        </div>
      </motion.div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <MenuRow key={item.label} item={item} index={i} />
        ))}
      </div>
    </>
  );
}

// ── Barber member view ───────────────────────────────────────────────────────
function BarberMemberSettings({ userName, telegramVerified }: { userName: string; telegramVerified: boolean }) {
  const { t } = useTranslation();

  const items: MenuItem[] = [
    { href: "/settings/profile",   emoji: "👤", label: t("settings.profile.solo"),    sub: t("settings.profile.solo_sub") },
    { href: "/settings/analytics", emoji: "📊", label: t("settings.analytics"),        sub: t("settings.analytics_sub") },
    { href: "/settings/general",   emoji: "⚙️", label: t("settings.general"),          sub: t("settings.notifications_sub") },
    { href: "/settings/feedback",  emoji: "💬", label: t("settings.feedback"),         sub: t("settings.feedback_sub") },
  ];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-primary/15 via-primary/8 to-transparent border border-primary/15 rounded-2xl p-5 mb-6 flex items-center gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/25 flex items-center justify-center font-display font-bold text-primary text-2xl uppercase shadow-lg shadow-primary/10 shrink-0">
          {userName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-foreground text-xl leading-tight truncate">
            {userName}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">{t("settings.role.member")}</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-400">{t("settings.active")}</span>
          </div>
        </div>
      </motion.div>

      {!telegramVerified && <TelegramBanner />}

      <div className="space-y-2">
        {items.map((item, i) => (
          <MenuRow key={item.label} item={item} index={i} />
        ))}
      </div>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isTeam = user?.mode === "team";
  const isMember = (user?.mode as string) === "barber_member";
  const userName = user?.name || user?.username || "Barber";
  const brandName = user?.brandName || "";
  const telegramVerified = user?.telegramVerified === true;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">{t("settings.title")}</h1>
      </div>

      {isTeam
        ? <TeamSettings brandName={brandName} userName={userName} />
        : isMember
          ? <BarberMemberSettings userName={userName} telegramVerified={telegramVerified} />
          : <IndividualSettings userName={userName} telegramVerified={telegramVerified} />
      }
    </Layout>
  );
}
