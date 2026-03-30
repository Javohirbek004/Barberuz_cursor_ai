import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronRight, User, Globe, BarChart2, Gift, MessageSquare, Building2, HardHat } from "lucide-react";
import { motion } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MenuItem {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
  disabled?: boolean;
}

// ── Single menu row ───────────────────────────────────────────────────────────
function MenuRow({ item, index }: { item: MenuItem; index: number }) {
  const inner = (
    <div
      className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all ${
        item.disabled
          ? "bg-card/40 border-white/4 opacity-50 cursor-not-allowed select-none"
          : "bg-card border-white/6 hover:bg-white/4 hover:border-white/10 cursor-pointer group"
      }`}
    >
      {/* Icon bubble */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        item.disabled ? "bg-white/5" : "bg-primary/10 group-hover:bg-primary/15 transition-colors"
      }`}>
        <span className={item.disabled ? "text-muted-foreground" : "text-primary"}>
          {item.icon}
        </span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold text-sm leading-tight ${
          item.disabled ? "text-muted-foreground" : "text-foreground"
        }`}>
          {item.label}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{item.sub}</p>
      </div>

      {/* Chevron */}
      {!item.disabled && (
        <ChevronRight className="w-4.5 h-4.5 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.04 }}
    >
      {item.disabled ? inner : <Link href={item.href}>{inner}</Link>}
    </motion.div>
  );
}

// ── Individual view ───────────────────────────────────────────────────────────
function IndividualSettings({ userName }: { userName: string }) {
  const displayName = userName || "Barber";

  const items: MenuItem[] = [
    {
      href: "/settings/profile",
      icon: <User className="w-5 h-5" />,
      label: "Mening profilim",
      sub: "Shaxsiy ma'lumotlar",
    },
    {
      href: "/settings/page",
      icon: <Globe className="w-5 h-5" />,
      label: "Mening sahifam",
      sub: "Mijozlar ko'radigan sahifa",
    },
    {
      href: "/settings/analytics",
      icon: <BarChart2 className="w-5 h-5" />,
      label: "Tahlil va statistika",
      sub: "Daromad va bronlar",
    },
    {
      href: "/settings/bonus",
      icon: <Gift className="w-5 h-5" />,
      label: "Bonus dasturi  🔒",
      sub: "Tez kunda...",
      disabled: true,
    },
    {
      href: "/settings/feedback",
      icon: <MessageSquare className="w-5 h-5" />,
      label: "Fikr va takliflar",
      sub: "Bizga xabar yuboring",
    },
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
          {displayName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-foreground text-xl leading-tight truncate">
            {displayName}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">Yakka barber</p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-400">Aktiv</span>
          </div>
        </div>
      </motion.div>

      {/* Menu */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <MenuRow key={item.href} item={item} index={i} />
        ))}
      </div>
    </>
  );
}

// ── Team view ─────────────────────────────────────────────────────────────────
function TeamSettings({ userName }: { userName: string }) {
  const items: MenuItem[] = [
    {
      href: "/settings/profile",
      icon: <Building2 className="w-5 h-5" />,
      label: "Barbershop profili",
      sub: "Salon ma'lumotlari",
    },
    {
      href: "/settings/page",
      icon: <Globe className="w-5 h-5" />,
      label: "Barbershop sahifasi",
      sub: "Mijozlar uchun sahifa 🔥",
    },
    {
      href: "/settings/analytics",
      icon: <BarChart2 className="w-5 h-5" />,
      label: "Tahlil va statistika",
      sub: "Daromad va bronlar",
    },
    {
      href: "/settings/barbers",
      icon: <HardHat className="w-5 h-5" />,
      label: "Ustalar boshqaruvi",
      sub: "Ustalarni qo'shish, tahrirlash",
    },
    {
      href: "/settings/bonus",
      icon: <Gift className="w-5 h-5" />,
      label: "Bonus dasturi  🔒",
      sub: "Tez kunda...",
      disabled: true,
    },
    {
      href: "/settings/feedback",
      icon: <MessageSquare className="w-5 h-5" />,
      label: "Fikr va takliflar",
      sub: "Bizga xabar yuboring",
    },
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
          B
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-foreground text-xl leading-tight">
            Black Star Barbershop
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

      {/* Menu */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <MenuRow key={item.href} item={item} index={i} />
        ))}
      </div>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth();
  const isTeam = user?.mode === "team";
  const displayName = user?.name || user?.username || "Barber";

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Sozlamalar</h1>
      </div>

      {isTeam
        ? <TeamSettings userName={displayName} />
        : <IndividualSettings userName={displayName} />
      }
    </Layout>
  );
}
