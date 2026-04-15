import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
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

function bonusAlert() {
  alert("Tez kunda qo'shiladi 🔒");
}

// ── Individual view ───────────────────────────────────────────────────────────
function IndividualSettings({ userName }: { userName: string }) {
  const items: MenuItem[] = [
    { href: "/settings/profile",   emoji: "👤", label: "Mening profilim",      sub: "Shaxsiy ma'lumotlar" },
    { href: "/settings/page",      emoji: "🌐", label: "Mening sahifam",       sub: "Mijozlar ko'radigan sahifa" },
    { href: "/settings/analytics", emoji: "📊", label: "Tahlil va statistika", sub: "Daromad va bronlar" },
    { href: "/settings/general",   emoji: "⚙️", label: "Umumiy sozlamalar",    sub: "Bildirishnomalar, xavfsizlik, til" },
    { onClick: bonusAlert,         emoji: "💰", label: "Bonus dasturi",         sub: "Tez kunda qo'shiladi 🔒" },
    { href: "/settings/feedback",  emoji: "💬", label: "Fikr va takliflar",     sub: "Bizga xabar yuboring" },
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
          <p className="font-display font-bold text-foreground text-xl leading-tight truncate">
            {userName}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">Yakka barber</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-400">Aktiv</span>
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

// ── Team view ─────────────────────────────────────────────────────────────────
function TeamSettings({ brandName, userName }: { brandName: string; userName: string }) {
  const displayBrand = brandName || userName || "Barbershop";

  const items: MenuItem[] = [
    { href: "/settings/profile",   emoji: "🏢",  label: "Barbershop profili",   sub: "Salon ma'lumotlari" },
    { href: "/settings/page",      emoji: "🌐",  label: "Barbershop sahifasi",  sub: "Mijozlar uchun sahifa 🔥" },
    { href: "/settings/analytics", emoji: "📊",  label: "Tahlil va statistika", sub: "Daromad va bronlar" },
    { href: "/settings/barbers",   emoji: "👷‍♂️", label: "Ustalar boshqaruvi",  sub: "Ustalarni qo'shish, tahrirlash" },
    { href: "/settings/general",   emoji: "⚙️",  label: "Umumiy sozlamalar",    sub: "Bildirishnomalar, xavfsizlik, til" },
    { onClick: bonusAlert,         emoji: "💰",  label: "Bonus dasturi",         sub: "Tez kunda qo'shiladi 🔒" },
    { href: "/settings/feedback",  emoji: "💬",  label: "Fikr va takliflar",     sub: "Bizga xabar yuboring" },
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
            4 usta • Siz: <span className="text-amber-400 font-semibold">Admin</span>
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-400">Aktiv</span>
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

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth();
  const isTeam = user?.mode === "team";
  const userName = user?.name || user?.username || "Barber";
  const brandName = user?.brandName || "";

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Sozlamalar</h1>
      </div>

      {isTeam
        ? <TeamSettings brandName={brandName} userName={userName} />
        : <IndividualSettings userName={userName} />
      }
    </Layout>
  );
}
