import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/i18n/LanguageContext";
import { useTheme, type Theme } from "@/hooks/useTheme";
import type { Language } from "@/i18n/translations";

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
  const { lang } = useTranslation();
  const { theme } = useTheme();

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
        <LinkRow index={2} href="/settings/language"      emoji="🌐" label="Til"              sub={LANG_NAMES[lang]} />
        <LinkRow index={3} href="/settings/theme"         emoji="🎨" label="Ilova dizayni"    sub={THEME_NAMES[theme]} />
      </div>
    </Layout>
  );
}
