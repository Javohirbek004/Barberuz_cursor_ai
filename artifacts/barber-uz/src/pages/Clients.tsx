import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageContext";
import { Layout } from "@/components/Layout";
import { useListClients } from "@workspace/api-client-react";
import { Search, ChevronRight, Phone, Users, UserX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { SEGMENT_META, type Segment } from "@/data/mockClients";

type SegmentFilter = "all" | Segment;

const TEAM_BARBER_NAMES = ["Sardor", "Jasur", "Ali", "Kamol"] as const;

interface ClientItem {
  id: string;
  name: string;
  phone: string;
  lastVisit: string | null;
  visitCount: number;
  segment: Segment;
  barber: string;
}

function formatLastVisit(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "Bugun";
  if (diffDays === 1) return "Kecha";
  if (diffDays < 7) return `${diffDays} kun oldin`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta oldin`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} oy oldin`;
  return `${Math.floor(diffDays / 365)} yil oldin`;
}

function ClientCard({
  client,
  showBarber,
  index,
}: {
  client: ClientItem;
  showBarber: boolean;
  index: number;
}) {
  const { t } = useTranslation();
  const seg = SEGMENT_META[client.segment];
  const segLabel = t(`segment.${client.segment}` as `segment.regular` | `segment.new` | `segment.lost`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link href={`/client/${client.id}`}>
        <div className="bg-card border border-white/5 p-4 rounded-2xl flex items-center gap-4 hover:bg-white/[0.03] hover:border-white/10 transition-all cursor-pointer group">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 font-display font-bold text-primary text-lg uppercase shrink-0">
            {client.name.charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-foreground text-base truncate">
                {client.name}
              </span>
              <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${seg.bg} ${seg.color}`}>
                {seg.emoji} {segLabel}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {client.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {client.phone}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              {client.lastVisit && (
                <>
                  <span>{t("clients.last_visit")} {client.lastVisit}</span>
                  <span>•</span>
                </>
              )}
              <span className="text-primary/80 font-medium">{client.visitCount} {t("clients.visits")}</span>
              {showBarber && client.barber !== "—" && (
                <>
                  <span>•</span>
                  <span className="text-muted-foreground">{client.barber} {t("clients.barber_suffix")}</span>
                </>
              )}
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="relative mb-5">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("clients.search")}
        className="w-full h-12 pl-10 pr-4 rounded-2xl bg-card border border-white/8 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all text-sm"
      />
    </div>
  );
}

function SegmentChips({
  value,
  onChange,
}: {
  value: SegmentFilter;
  onChange: (v: SegmentFilter) => void;
}) {
  const { t } = useTranslation();

  const SEGMENTS = [
    { id: "all",     label: t("clients.filter.all") },
    { id: "regular", label: t("clients.filter.regular") },
    { id: "new",     label: t("clients.filter.new") },
    { id: "lost",    label: t("clients.filter.lost") },
  ] as const;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {SEGMENTS.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id as SegmentFilter)}
          className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-sm font-medium transition-all ${
            value === s.id
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "bg-card border border-white/5 text-muted-foreground hover:bg-white/5"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ isSearch }: { isSearch: boolean }) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-muted/30 border border-white/5 flex items-center justify-center mb-5">
        <UserX className="w-9 h-9 text-muted-foreground/50" />
      </div>
      <p className="text-base font-semibold text-foreground/70">
        {isSearch ? t("clients.not_found") : t("clients.empty")}
      </p>
      <p className="text-sm text-muted-foreground/50 mt-1 max-w-[220px]">
        {isSearch ? t("clients.not_found_hint") : t("clients.empty_hint")}
      </p>
    </motion.div>
  );
}

function useClients(search: string, segment: SegmentFilter) {
  const { data: apiData, isLoading } = useListClients({
    filter: segment !== "all" ? segment : undefined,
    search: search || undefined,
  });

  const clients: ClientItem[] = (apiData?.clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    lastVisit: c.lastVisit ? formatLastVisit(c.lastVisit) : null,
    visitCount: c.visitCount,
    segment: (c.status as Segment) ?? "new",
    barber: "—",
  }));

  return { clients, isLoading, total: apiData?.total ?? 0 };
}

function IndividualView() {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [search, setSearch] = useState("");

  const { clients, isLoading, total } = useClients(search, segment);

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-display font-bold text-foreground">{t("nav.clients")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {total} {t("clients.count")}
        </p>
      </div>

      <SearchBar value={search} onChange={setSearch} />

      <div className="mb-4">
        <SegmentChips value={segment} onChange={setSegment} />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-card border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState isSearch={!!(search || segment !== "all")} />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {clients.map((c, i) => (
              <ClientCard key={c.id} client={c} showBarber={false} index={i} />
            ))}
          </div>
        </AnimatePresence>
      )}
    </>
  );
}

function TeamView() {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [barber, setBarber] = useState<string>("__all__");
  const [search, setSearch] = useState("");

  const { clients: allClients, isLoading, total } = useClients(search, segment);

  const clients = allClients.filter(
    (c) => barber === "__all__" || c.barber === barber
  );

  const allBarberLabel = t("team.all");
  const barberList = [allBarberLabel, ...TEAM_BARBER_NAMES];

  return (
    <>
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">{t("nav.clients")}</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{t("clients.all_shop")} • {total} {t("clients.count")}</p>
      </div>

      <SearchBar value={search} onChange={setSearch} />

      <div className="mb-3">
        <SegmentChips value={segment} onChange={setSegment} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
        {barberList.map((b) => {
          const id = b === allBarberLabel ? "__all__" : b;
          return (
            <button
              key={id}
              onClick={() => setBarber(id)}
              className={`shrink-0 px-3.5 py-2 rounded-2xl text-sm font-medium border transition-all ${
                barber === id
                  ? "bg-foreground/10 border-foreground/20 text-foreground"
                  : "bg-card border-white/5 text-muted-foreground hover:bg-white/5"
              }`}
            >
              {b}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-card border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState isSearch={!!(search || segment !== "all")} />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {clients.map((c, i) => (
              <ClientCard key={c.id} client={c} showBarber={true} index={i} />
            ))}
          </div>
        </AnimatePresence>
      )}
    </>
  );
}

export default function Clients() {
  const { user } = useAuth();
  return (
    <Layout>
      {user?.mode === "team" ? <TeamView /> : <IndividualView />}
    </Layout>
  );
}
