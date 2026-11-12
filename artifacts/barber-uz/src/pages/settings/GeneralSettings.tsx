import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/i18n/LanguageContext";
import { pick } from "@/i18n/pick";
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

function themeName(lang: string, theme: Theme): string {
  if (theme === "light") return pick(lang, "Yorqin rejim", "Светлая тема");
  if (theme === "dark") return pick(lang, "Qorong'u rejim", "Тёмная тема");
  return pick(lang, "Tizim bo'yicha", "Как в системе");
}

export default function GeneralSettings() {
  const { logout } = useAuth();
  const { lang } = useTranslation();
  const { theme } = useTheme();
  const [showConfirm, setShowConfirm] = useState(false);

  function handleLogoutConfirm() {
    setShowConfirm(false);
    localStorage.clear();
    logout();
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-7">
        <Link href="/settings">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">{pick(lang, "Umumiy sozlamalar", "Общие настройки")}</h1>
      </div>

      <div className="space-y-2">
        <LinkRow index={0} href="/settings/notifications" emoji="🔔" label={pick(lang, "Bildirishnomalar", "Уведомления")} sub={pick(lang, "Xabarnoma sozlamalari", "Настройки сообщений")} />
        <LinkRow index={1} href="/settings/security"      emoji="🔐" label={pick(lang, "Xavfsizlik", "Безопасность")}       sub={pick(lang, "Parol va himoya", "Пароль и защита")} />
        <LinkRow index={2} href="/settings/language"      emoji="🌐" label={pick(lang, "Til", "Язык")}              sub={LANG_NAMES[lang]} />
        <LinkRow index={3} href="/settings/theme"         emoji="🎨" label={pick(lang, "Ilova dizayni", "Оформление")}    sub={themeName(lang, theme)} />
      </div>

      <div className="mt-10 pt-6 border-t border-white/8">
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          onClick={() => setShowConfirm(true)}
          className="w-full p-4 rounded-2xl bg-destructive/10 text-destructive font-bold text-base flex items-center justify-center gap-2.5 hover:bg-destructive/20 transition-all border border-destructive/20"
        >
          <LogOut className="w-5 h-5" />
          {pick(lang, "Chiqish", "Выйти")}
        </motion.button>
      </div>

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-destructive/15 mx-auto mb-4">
                <LogOut className="w-6 h-6 text-destructive" />
              </div>
              <h2 className="text-lg font-bold text-foreground text-center mb-1.5">
                {pick(lang, "Akkauntdan chiqmoqchimisiz?", "Выйти из аккаунта?")}
              </h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                {pick(lang, "Chiqsangiz, qayta kirish talab qilinadi.", "После выхода нужно будет войти снова.")}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-2xl bg-white/6 border border-white/10 text-foreground font-semibold text-sm hover:bg-white/10 transition-all"
                >
                  {pick(lang, "Yo'q", "Нет")}
                </button>
                <button
                  onClick={handleLogoutConfirm}
                  className="flex-1 py-3 rounded-2xl bg-destructive text-white font-semibold text-sm hover:bg-destructive/85 transition-all"
                >
                  {pick(lang, "Ha, chiqish", "Да, выйти")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
