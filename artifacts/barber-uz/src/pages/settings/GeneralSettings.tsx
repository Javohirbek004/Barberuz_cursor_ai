import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/i18n/LanguageContext";
import { useTheme, type Theme } from "@/hooks/useTheme";
import type { Language } from "@/i18n/translations";

function MenuRow({
  emoji, label, sub, onClick, index,
}: {
  emoji: string; label: string; sub: string; onClick: () => void; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04 }}
    >
      <button className="w-full text-left" onClick={onClick}>
        <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border bg-card border-white/6 hover:bg-white/4 hover:border-white/10 cursor-pointer group transition-all">
          <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors text-xl">
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{sub}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
        </div>
      </button>
    </motion.div>
  );
}

function LinkRow({
  href, emoji, label, sub, index,
}: {
  href: string; emoji: string; label: string; sub: string; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04 }}
    >
      <Link href={href}>
        <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border bg-card border-white/6 hover:bg-white/4 hover:border-white/10 cursor-pointer group transition-all">
          <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors text-xl">
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{sub}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}

function OptionRow({
  emoji, label, selected, onClick,
}: {
  emoji: string; label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-all"
      style={{
        background: selected ? "hsl(var(--primary) / 0.08)" : "hsl(var(--card))",
        borderColor: selected ? "hsl(var(--primary) / 0.3)" : "rgba(255,255,255,0.06)",
      }}
    >
      <span className="text-xl">{emoji}</span>
      <span className="flex-1 text-left text-sm font-semibold text-foreground">{label}</span>
      {selected && <Check className="w-4 h-4 text-primary shrink-0" />}
    </button>
  );
}

function BottomSheet({
  open, onClose, title, children,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-white/10 rounded-t-3xl px-4 pt-5 pb-10 max-w-md mx-auto"
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
            <h2 className="text-base font-bold text-foreground mb-4">{title}</h2>
            <div className="space-y-2">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

const LANG_NAMES: Record<Language, string> = {
  uz: "O'zbek",
  ru: "Русский",
};

const THEME_NAMES: Record<Theme, string> = {
  system: "Tizim bo'yicha",
  light: "Yorqin rejim",
  dark: "Qorong'u rejim",
};

export default function GeneralSettings() {
  useAuth();
  const { lang, setLang } = useTranslation();
  const { theme, changeTheme } = useTheme();

  const [sheet, setSheet] = useState<null | "lang" | "theme">(null);

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-7">
        <Link href="/settings">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">Umumiy sozlamalar</h1>
      </div>

      <div className="space-y-2">
        <LinkRow index={0} href="/settings/notifications" emoji="🔔" label="Bildirishnomalar" sub="Xabarnoma sozlamalari" />
        <LinkRow index={1} href="/settings/security"      emoji="🔐" label="Xavfsizlik"       sub="Parol va himoya" />
        <MenuRow index={2} emoji="🌐" label="Til"           sub={LANG_NAMES[lang]}         onClick={() => setSheet("lang")} />
        <MenuRow index={3} emoji="🎨" label="Ilova dizayni" sub={THEME_NAMES[theme]}       onClick={() => setSheet("theme")} />
      </div>

      <BottomSheet open={sheet === "lang"} onClose={() => setSheet(null)} title="🌐 Til">
        <OptionRow emoji="🇺🇿" label="O'zbekcha" selected={lang === "uz"} onClick={() => { setLang("uz"); setSheet(null); }} />
        <OptionRow emoji="🇷🇺" label="Русский"   selected={lang === "ru"} onClick={() => { setLang("ru"); setSheet(null); }} />
      </BottomSheet>

      <BottomSheet open={sheet === "theme"} onClose={() => setSheet(null)} title="🎨 Ilova dizayni">
        <OptionRow emoji="📱" label="Tizim bo'yicha" selected={theme === "system"} onClick={() => { changeTheme("system"); setSheet(null); }} />
        <OptionRow emoji="☀️" label="Yorqin rejim"   selected={theme === "light"}  onClick={() => { changeTheme("light");  setSheet(null); }} />
        <OptionRow emoji="🌙" label="Qorong'u rejim" selected={theme === "dark"}   onClick={() => { changeTheme("dark");   setSheet(null); }} />
      </BottomSheet>
    </Layout>
  );
}
