import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageContext";
import { Layout } from "@/components/Layout";
import { useListClients } from "@workspace/api-client-react";
import { Search, ChevronRight, Phone, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { MOCK_CLIENTS, SEGMENT_META, type Segment, type MockClient } from "@/data/mockClients";

type SegmentFilter = "all" | Segment;

// ── Team barbers ──────────────────────────────────────────────────────────────
const TEAM_BARBERS = ["Barchasi", "Sardor", "Jasur", "Ali", "Kamol"] as const;

// ── Client card ───────────────────────────────────────────────────────────────
function ClientCard({
  client,
  showBarber,
  index,
}: {
  client: MockClient;
  showBarber: boolean;
  index: number;
}) {
  const { t } = useTranslation();
  const seg = SEGMENT_META[client.segment];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link href={`/client/${client.id}`}>
        <div className="bg-card border border-white/5 p-4 rounded-2xl flex items-center gap-4 hover:bg-white/3 hover:border-white/10 transition-all cursor-pointer group">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20 font-display font-bold text-primary text-lg uppercase shrink-0">
            {client.name.charAt(0)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-foreground text-base truncate">
                {client.name}
              </span>
              <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${seg.bg} ${seg.color}`}>
                {seg.emoji} {seg.label}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {client.phone}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span>{t("clients.last_visit")} {client.lastVisit}</span>
              <span>•</span>
              <span className="text-primary/80 font-medium">{client.visitCount} {t("clients.visits")}</span>
              {showBarber && (
                <>
                  <span>•</span>
                  <span className="text-muted-foreground">{client.barber} {t("clients.barber_suffix")}</span>
                </>
              )}
            </div>
          </div>

          {/* Chevron */}
          <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </div>
      </Link>
    </motion.div>
  );
}

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="relative mb-5">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
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

// ── Segment chips ─────────────────────────────────────────────────────────────
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

// ── Merge API + mock data ─────────────────────────────────────────────────────
function useMergedClients(search: string, segment: SegmentFilter) {
  const { data: apiData, isLoading } = useListClients({
    filter: segment !== "all" ? segment : undefined,
    search: search || undefined,
  });

  const apiClients: MockClient[] = (apiData?.clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone ?? "",
    lastVisit: c.lastVisit ?? "—",
    visitCount: c.visitCount,
    segment: (c.status as Segment) ?? "new",
    barber: "—",
    notes: c.notes ?? "",
    bookingHistory: [],
  }));

  const base = apiClients.length > 0 ? apiClients : MOCK_CLIENTS;

  const filtered = base.filter((c) => {
    const matchSegment = segment === "all" || c.segment === segment;
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    return matchSegment && matchSearch;
  });

  return { clients: filtered, isLoading };
}

// ── Individual view ───────────────────────────────────────────────────────────
function IndividualView() {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [search, setSearch] = useState("");

  const { clients, isLoading } = useMergedClients(search, segment);

  return (
    <>
      <div className="mb-5">
        <h1 className="text-2xl font-display font-bold text-foreground">{t("nav.clients")}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {clients.length} {t("clients.count")}
        </p>
      </div>

      <SearchBar value={search} onChange={setSearch} />

      <div className="mb-4">
        <SegmentChips value={segment} onChange={setSegment} />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{t("clients.loading")}</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{t("clients.not_found")}</div>
      ) : (
        <div className="space-y-3">
          {clients.map((c, i) => (
            <ClientCard key={c.id} client={c} showBarber={false} index={i} />
          ))}
        </div>
      )}
    </>
  );
}

// ── Team view ─────────────────────────────────────────────────────────────────
function TeamView() {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [barber, setBarber] = useState<string>("Barchasi");
  const [search, setSearch] = useState("");

  const { clients: allClients, isLoading } = useMergedClients(search, segment);

  const clients = allClients.filter(
    (c) => barber === "Barchasi" || c.barber === barber
  );

  return (
    <>
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-display font-bold text-foreground">{t("nav.clients")}</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{t("clients.all_shop")} • {clients.length} {t("clients.count")}</p>
      </div>

      <SearchBar value={search} onChange={setSearch} />

      {/* Layer 1: Segment */}
      <div className="mb-3">
        <SegmentChips value={segment} onChange={setSegment} />
      </div>

      {/* Layer 2: Barber */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
        {TEAM_BARBERS.map((b) => (
          <button
            key={b}
            onClick={() => setBarber(b)}
            className={`shrink-0 px-3.5 py-2 rounded-2xl text-sm font-medium border transition-all ${
              barber === b
                ? "bg-foreground/10 border-foreground/20 text-foreground"
                : "bg-card border-white/5 text-muted-foreground hover:bg-white/5"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{t("clients.loading")}</div>
      ) : clients.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{t("clients.not_found")}</div>
      ) : (
        <div className="space-y-3">
          {clients.map((c, i) => (
            <ClientCard key={c.id} client={c} showBarber={true} index={i} />
          ))}
        </div>
      )}
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Clients() {
  const { user } = useAuth();
  return (
    <Layout>
      {user?.mode === "team" ? <TeamView /> : <IndividualView />}
    </Layout>
  );
}
