import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface MenuItem {
  href?: string;
  emoji: string;
  label: string;
  sub: string;
  onClick?: () => void;
}

function MenuRow({ item, index }: { item: MenuItem; index: number }) {
  const inner = (
    <div className="flex items-center gap-4 px-4 py-3.5 rounded-2xl border bg-card border-white/6 hover:bg-white/4 hover:border-white/10 cursor-pointer group transition-all">
      <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center shrink-0 transition-colors text-xl">
        {item.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight text-foreground">{item.label}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{item.sub}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + index * 0.04 }}
    >
      {item.onClick ? (
        <button className="w-full text-left" onClick={item.onClick}>{inner}</button>
      ) : item.href ? (
        <Link href={item.href}>{inner}</Link>
      ) : inner}
    </motion.div>
  );
}

export default function GeneralSettings() {
  useAuth();

  const items: MenuItem[] = [
    { href: "/settings/notifications", emoji: "🔔", label: "Bildirishnomalar", sub: "Xabarnoma sozlamalari" },
    { href: "/settings/security",      emoji: "🔐", label: "Xavfsizlik",       sub: "Parol va himoya" },
    { onClick: () => alert("Tez kunda qo'shiladi 🔒"), emoji: "🌐", label: "Til", sub: "O'zbek / Русский" },
    { onClick: () => alert("Tez kunda qo'shiladi 🔒"), emoji: "🎨", label: "Ko'rinish", sub: "Mavzu va rang" },
  ];

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
        {items.map((item, i) => (
          <MenuRow key={item.label} item={item} index={i} />
        ))}
      </div>
    </Layout>
  );
}
