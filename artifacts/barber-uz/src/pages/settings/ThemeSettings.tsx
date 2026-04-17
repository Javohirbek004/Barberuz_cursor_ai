import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme, type Theme } from "@/hooks/useTheme";

const THEMES: { code: Theme; emoji: string; label: string }[] = [
  { code: "system", emoji: "📱", label: "Tizim bo'yicha" },
  { code: "light",  emoji: "☀️", label: "Yorqin rejim" },
  { code: "dark",   emoji: "🌙", label: "Qorong'u rejim" },
];

export default function ThemeSettings() {
  useAuth();
  const { theme, changeTheme } = useTheme();

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-7">
        <Link href="/settings/general">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">🎨 Ilova ko'rinishi</h1>
      </div>

      <div className="space-y-2">
        {THEMES.map(({ code, emoji, label }, i) => (
          <motion.button
            key={code}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.04 }}
            onClick={() => changeTheme(code)}
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all"
            style={{
              background: theme === code ? "hsl(var(--primary) / 0.08)" : "hsl(var(--card))",
              borderColor: theme === code ? "hsl(var(--primary) / 0.3)" : "rgba(255,255,255,0.06)",
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
