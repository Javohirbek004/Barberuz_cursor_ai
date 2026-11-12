import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageContext";
import { pick } from "@/i18n/pick";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, Send, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = [
  { value: "💡 Taklif",  label: "💡 Taklif" },
  { value: "🐞 Xatolik", label: "🐞 Xatolik" },
  { value: "⚡ Muammo",  label: "⚡ Muammo" },
];

// ── Simple in-page toast ──────────────────────────────────────────────────────
function SuccessToast({ visible, text }: { visible: boolean; text: string }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-green-500/90 backdrop-blur-sm shadow-xl shadow-green-500/20 text-white font-semibold text-sm whitespace-nowrap"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function FeedbackPage() {
  const { user } = useAuth();
  const { lang } = useTranslation();
  const categories = [
    { value: "💡 Taklif", label: pick(lang, "💡 Taklif", "💡 Предложение") },
    { value: "🐞 Xatolik", label: pick(lang, "🐞 Xatolik", "🐞 Ошибка") },
    { value: "⚡ Muammo", label: pick(lang, "⚡ Muammo", "⚡ Проблема") },
  ];

  const [text, setText] = useState("");
  const [category, setCategory] = useState(categories[0].value);
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("barber_token") ?? "";
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: text.trim(), category }),
      });

      const body = await res.json().catch(() => null) as { message?: string; sent?: boolean } | null;
      if (!res.ok || body?.sent === false) {
        throw new Error(body?.message || pick(lang, "Yuborishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.", "Не отправилось. Попробуйте ещё раз."));
      }

      // Success
      setText("");
      setCategory(categories[0].value);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
    } catch (err) {
      console.error("[Feedback] submit error:", err);
      setError(err instanceof Error ? err.message : pick(lang, "Yuborishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.", "Не отправилось. Попробуйте ещё раз."));
    } finally {
      setLoading(false);
    }
  }

  const charCount = text.length;
  const canSubmit = text.trim().length > 0 && !loading;

  return (
    <Layout>
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/settings">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">{pick(lang, "💬 Fikr va takliflar", "💬 Отзывы и предложения")}</h1>
      </div>

      {/* Subtext */}
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        {pick(lang, "Sizning fikringiz ilovani yaxshilashga yordam beradi", "Ваше мнение помогает улучшить приложение")}
      </p>

      {/* Category selector */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          {pick(lang, "Kategoriya", "Категория")}
        </label>
        <div className="flex gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`flex-1 py-2.5 rounded-2xl text-sm font-semibold border transition-all ${
                category === cat.value
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-card border-white/8 text-muted-foreground hover:bg-white/5"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Textarea */}
      <div className="mb-5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          {pick(lang, "Xabar", "Сообщение")}
        </label>
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={pick(lang, "Fikringizni yozing... (xatolik, taklif yoki muammo)", "Напишите мнение... (ошибка, идея или проблема)")}
            rows={6}
            maxLength={1000}
            className="w-full px-4 py-3.5 rounded-2xl bg-card border border-white/8 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 text-sm resize-none transition-all leading-relaxed"
          />
          <span className={`absolute bottom-3 right-4 text-xs ${charCount > 900 ? "text-orange-400" : "text-muted-foreground/40"}`}>
            {charCount}/1000
          </span>
        </div>
      </div>

      {/* User info preview */}
      {user && (
        <div className="bg-card border border-white/6 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-sm uppercase shrink-0">
            {(user.name || user.username || "B").charAt(0)}
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{user.name || user.username}</span>
            {" "}{pick(lang, "nomidan yuborilyapti", "отправит сообщение")}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400 mb-4 px-1">{error}</p>
      )}

      {/* Submit button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full h-14 rounded-2xl flex items-center justify-center gap-2.5 font-bold text-base transition-all ${
          canSubmit
            ? "bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/25"
            : "bg-card border border-white/8 text-muted-foreground cursor-not-allowed"
        }`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            {pick(lang, "Yuborilmoqda...", "Отправляется...")}
          </span>
        ) : (
          <>
            <Send className="w-5 h-5" />
            {pick(lang, "Yuborish", "Отправить")}
          </>
        )}
      </motion.button>

      {/* Toast */}
      <SuccessToast visible={showToast} text={pick(lang, "Rahmat! Fikringiz qabul qilindi 🙌", "Спасибо! Мы получили ваше сообщение 🙌")} />
    </Layout>
  );
}
