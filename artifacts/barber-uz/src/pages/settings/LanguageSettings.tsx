import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

const LANGS: { code: Language; emoji: string; label: string }[] = [
  { code: "uz", emoji: "🇺🇿", label: "O'zbekcha" },
  { code: "ru", emoji: "🇷🇺", label: "Русский" },
];

export default function LanguageSettings() {
  useAuth();
  const { lang, setLang } = useTranslation();

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-7">
        <Link href="/settings/general">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">🌐 Til</h1>
      </div>

      <div className="space-y-2">
        {LANGS.map(({ code, emoji, label }, i) => (
          <motion.button
            key={code}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            onClick={() => setLang(code)}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all"
            style={{
              background: lang === code ? "hsl(var(--primary) / 0.08)" : "hsl(var(--card))",
              borderColor: lang === code ? "hsl(var(--primary) / 0.3)" : "rgba(255,255,255,0.06)",
            }}
          >
            <span className="text-2xl">{emoji}</span>
            <span className="flex-1 text-left text-sm font-semibold text-foreground">{label}</span>
            {lang === code && <Check className="w-4 h-4 text-primary shrink-0" />}
          </motion.button>
        ))}
      </div>
    </Layout>
  );
}
