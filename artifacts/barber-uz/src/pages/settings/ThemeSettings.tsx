import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { useTranslation } from "@/i18n/LanguageContext";
import { pick } from "@/i18n/pick";

export default function ThemeSettings() {
  useAuth();
  const { theme, changeTheme } = useTheme();
  const { lang } = useTranslation();
  const themes: { code: Theme; emoji: string; label: string }[] = [
    { code: "system", emoji: "📱", label: pick(lang, "Tizim bo'yicha", "Как в системе") },
    { code: "light",  emoji: "☀️", label: pick(lang, "Yorqin rejim", "Светлая тема") },
    { code: "dark",   emoji: "🌙", label: pick(lang, "Qorong'u rejim", "Тёмная тема") },
  ];

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-7">
        <Link href="/settings/general">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">{pick(lang, "🎨 Ilova ko'rinishi", "🎨 Оформление")}</h1>
      </div>

      <div className="space-y-2">
        {themes.map(({ code, emoji, label }, i) => (
          <motion.button
            key={code}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            onClick={() => changeTheme(code)}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all"
            style={{
              background: theme === code ? "hsl(var(--primary) / 0.08)" : "hsl(var(--card))",
              borderColor: theme === code ? "hsl(var(--primary) / 0.3)" : "hsl(var(--border))",
            }}
          >
            <span className="text-2xl">{emoji}</span>
            <span className="flex-1 text-left text-sm font-semibold text-foreground">{label}</span>
            {theme === code && <Check className="w-4 h-4 text-primary shrink-0" />}
          </motion.button>
        ))}
      </div>
    </Layout>
  );
}
