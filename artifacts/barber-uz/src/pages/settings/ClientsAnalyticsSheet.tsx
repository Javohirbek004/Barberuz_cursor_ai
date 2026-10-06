import { useEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";

type Period = "bugun" | "hafta" | "oy";
type SegmentKey = "regular" | "new" | "lost";

const PERIOD_API: Record<Period, string> = { bugun: "today", hafta: "week", oy: "month" };

const PERIODS: { key: Period; label: string }[] = [
  { key: "bugun", label: "Bugun" },
  { key: "hafta", label: "Hafta" },
  { key: "oy", label: "Oy" },
];

const SEGMENT_INFO: Record<SegmentKey, { label: string; emoji: string; text: string; badge: string }> = {
  regular: {
    label: "Doimiy",
    emoji: "🔥",
    text: "So'nggi 30 kunda 2 va undan ortiq marta xizmat olgan mijozlar.",
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  },
  new: {
    label: "Yangi",
    emoji: "✨",
    text: "Birinchi marta tashrif buyurgan mijozlar.",
    badge: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  },
  lost: {
    label: "Yoʻqolgan",
    emoji: "⚠️",
    text: "Oldin kelgan, lekin oxirgi 30+ kundan beri kelmagan mijozlar.",
    badge: "bg-red-500/15 text-red-300 border-red-500/25",
  },
};

export const CLIENTS_EMPTY_TEXT = "Tanlangan davrda mijozlar tahlili uchun ma'lumotlar yo'q.";

interface TopClient {
  name: string;
  visitsInPeriod: number;
  segment: SegmentKey | null;
  lastVisit: { date: string; time: string };
  daysAgo: number;
}

interface ClientsResponse {
  period: string;
  today: string;
  segments: { all: number; regular: number; new: number; lost: number };
  topClients: TopClient[];
}

function getToken() {
  return localStorage.getItem("barber_token") ?? "";
}

async function fetchClients(period: Period): Promise<ClientsResponse> {
  const res = await fetch(`/api/analytics/clients?period=${PERIOD_API[period]}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("fetch_error");
  return res.json();
}

function lastVisitLabel(c: TopClient): string {
  if (c.daysAgo === 0) return `Bugun, ${c.lastVisit.time}`;
  if (c.daysAgo === 1) return `Kecha, ${c.lastVisit.time}`;
  return `${c.daysAgo} kun oldin`;
}

function SegmentBadge({ segment }: { segment: SegmentKey | null }) {
  if (!segment) return null;
  const s = SEGMENT_INFO[segment];
  return (
    <span
      data-testid={`badge-${segment}`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${s.badge}`}
    >
      {s.label} {s.emoji}
    </span>
  );
}

function PeriodTabs({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div
      role="tablist"
      data-testid="clients-period-tabs"
      className="flex gap-1.5 bg-background/60 p-1 rounded-2xl border border-white/6 mb-4"
    >
      {PERIODS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          data-period={key}
          onClick={() => onChange(key)}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
            value === key
              ? "bg-primary text-black shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SegmentCard({
  segmentKey,
  title,
  count,
  tone,
  onInfo,
  infoOpen,
}: {
  segmentKey: "all" | SegmentKey;
  title: string;
  count: number;
  tone: string;
  onInfo?: () => void;
  infoOpen?: boolean;
}) {
  return (
    <div
      data-testid={`segment-${segmentKey}`}
      className={`relative rounded-2xl border p-3.5 ${tone}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground/80">{title}</span>
        {onInfo && (
          <button
            type="button"
            aria-label={`${title} haqida ma'lumot`}
            aria-expanded={infoOpen}
            data-testid={`info-${segmentKey}`}
            onClick={onInfo}
            className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div data-testid={`count-${segmentKey}`} className="mt-1 font-display font-bold text-2xl text-foreground tabular-nums">
        {count}
      </div>
    </div>
  );
}

/** "Mijozlar tahlili" – segment counters and top clients, powered by real bookings. */
export function ClientsAnalyticsSheet({ onClose }: { onClose: () => void }) {
  const [period, setPeriod] = useState<Period>("bugun");
  const [cache, setCache] = useState<Partial<Record<Period, ClientsResponse>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [infoKey, setInfoKey] = useState<SegmentKey | null>(null);
  const infoWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchClients(period)
      .then((res) => {
        if (!cancelled) setCache((c) => ({ ...c, [period]: res }));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  // Tap outside the segment grid / its note closes the definition note.
  useEffect(() => {
    if (!infoKey) return;
    function onDown(e: MouseEvent | TouchEvent) {
      if (infoWrapRef.current && !infoWrapRef.current.contains(e.target as Node)) setInfoKey(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [infoKey]);

  const data = cache[period];
  const toggleInfo = (k: SegmentKey) => setInfoKey((cur) => (cur === k ? null : k));

  return (
    <BottomSheet title="Mijozlar tahlili" onClose={onClose}>
      <PeriodTabs
        value={period}
        onChange={(p) => {
          setInfoKey(null);
          setPeriod(p);
        }}
      />

      {!data && loading && (
        <div className="space-y-3" data-testid="clients-loading">
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
          <div className="h-16 rounded-2xl bg-white/5 animate-pulse" />
          <div className="h-16 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      )}

      {!data && !loading && error && (
        <div className="text-center py-10 text-sm text-muted-foreground">Ma'lumot yuklanmadi</div>
      )}

      {data && data.segments.all === 0 && (
        <div
          data-testid="clients-empty"
          className="text-center py-12 px-4 text-sm text-muted-foreground"
        >
          {CLIENTS_EMPTY_TEXT}
        </div>
      )}

      {data && data.segments.all > 0 && (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : "opacity-100"}`}>
          <div ref={infoWrapRef}>
            <div className="grid grid-cols-2 gap-3">
              <SegmentCard
                segmentKey="all"
                title="Hammasi"
                count={data.segments.all}
                tone="bg-white/4 border-white/10"
              />
              <SegmentCard
                segmentKey="regular"
                title="Doimiy 🔥"
                count={data.segments.regular}
                tone="bg-orange-500/8 border-orange-500/20"
                onInfo={() => toggleInfo("regular")}
                infoOpen={infoKey === "regular"}
              />
              <SegmentCard
                segmentKey="new"
                title="Yangi ✨"
                count={data.segments.new}
                tone="bg-sky-500/8 border-sky-500/20"
                onInfo={() => toggleInfo("new")}
                infoOpen={infoKey === "new"}
              />
              <SegmentCard
                segmentKey="lost"
                title="Yoʻqolgan ⚠️"
                count={data.segments.lost}
                tone="bg-red-500/8 border-red-500/20"
                onInfo={() => toggleInfo("lost")}
                infoOpen={infoKey === "lost"}
              />
            </div>

            {infoKey && (
              <div
                role="note"
                data-testid="segment-info"
                className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-background px-3 py-2.5 text-xs leading-relaxed text-foreground/90"
              >
                <span className="flex-1">
                  <b>
                    {SEGMENT_INFO[infoKey].label} {SEGMENT_INFO[infoKey].emoji}:
                  </b>{" "}
                  <span data-testid="segment-info-text">{SEGMENT_INFO[infoKey].text}</span>
                </span>
                <button
                  type="button"
                  aria-label="Yopish"
                  onClick={() => setInfoKey(null)}
                  className="shrink-0 w-5 h-5 -mr-1 -mt-0.5 rounded-full flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Top mijozlar
            </div>
            <div className="space-y-2" data-testid="top-clients">
              {data.topClients.map((c, i) => (
                <div
                  key={`${c.name}-${i}`}
                  data-testid="top-client"
                  className="flex items-center gap-3 py-3 px-3.5 rounded-2xl bg-white/3 border border-white/6"
                >
                  <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{c.name}</span>
                      <SegmentBadge segment={c.segment} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.visitsInPeriod} marta · Oxirgi tashrif: {lastVisitLabel(c)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
