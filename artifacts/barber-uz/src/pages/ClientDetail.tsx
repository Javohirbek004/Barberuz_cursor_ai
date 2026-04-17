import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageContext";
import { Layout } from "@/components/Layout";
import { useParams, Link } from "wouter";
import { useGetClient } from "@workspace/api-client-react";
import {
  ChevronLeft,
  Phone,
  Pencil,
  Check,
  X,
  CalendarDays,
  Scissors,
} from "lucide-react";
import { motion } from "framer-motion";
import { MOCK_CLIENTS, SEGMENT_META, type MockClient } from "@/data/mockClients";

// ── Helpers ───────────────────────────────────────────────────────────────────
function isMockId(id: string) {
  return id.startsWith("mock-");
}

function getMockClient(id: string): MockClient | undefined {
  return MOCK_CLIENTS.find((c) => c.id === id);
}

// ── Editable notes ────────────────────────────────────────────────────────────
function NotesField({ initial }: { initial: string }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);

  function save() {
    setSaved(value);
    setEditing(false);
  }

  function cancel() {
    setValue(saved);
    setEditing(false);
  }

  return (
    <div className="bg-card border border-white/8 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground">📝 {t("client.notes")}</h3>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("client.notes.edit")}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors font-semibold"
            >
              <Check className="w-3.5 h-3.5" />
              {t("client.notes.save")}
            </button>
            <button
              onClick={cancel}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              {t("client.notes.cancel")}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("client.notes.placeholder")}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl bg-background/60 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 text-sm resize-none transition-all"
        />
      ) : (
        <p className="text-sm text-foreground/80 leading-relaxed min-h-[2.5rem]">
          {saved || (
            <span className="text-muted-foreground/50 italic">{t("client.notes.empty")}</span>
          )}
        </p>
      )}
    </div>
  );
}

// ── Booking history list ──────────────────────────────────────────────────────
function BookingHistory({
  history,
}: {
  history: { date: string; service: string; price: string }[];
}) {
  const { t } = useTranslation();

  if (history.length === 0) return null;

  return (
    <div className="bg-card border border-white/8 rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
        <CalendarDays className="w-4 h-4" />
        {t("client.history")}
      </h3>
      <div className="space-y-2">
        {history.map((h, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Scissors className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{h.service}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{h.date}</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-primary">{h.price} {t("client.spent_unit")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mock client detail page ───────────────────────────────────────────────────
function MockClientDetail({ client }: { client: MockClient }) {
  const { t } = useTranslation();
  const { user } = useAuth(false);
  const isTeam = user?.mode === "team";
  const seg = SEGMENT_META[client.segment];
  const segLabel = t(`segment.${client.segment}` as `segment.regular` | `segment.new` | `segment.lost`);

  return (
    <Layout>
      {/* Back nav */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-lg font-display font-bold text-foreground">{t("client.profile")}</h1>
      </div>

      {/* Avatar + name */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center mb-6"
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/30 font-display font-bold text-primary text-4xl uppercase shadow-xl shadow-primary/10 mb-4">
          {client.name.charAt(0)}
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground">{client.name}</h2>

        {/* Segment badge */}
        <span className={`mt-2 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border ${seg.bg} ${seg.color}`}>
          {seg.emoji} {segLabel}
        </span>

        {/* Barber (team mode only) */}
        {isTeam && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {client.barber} {t("client.barber_suffix")}
          </p>
        )}
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBox label={t("client.visits")} value={`${client.visitCount} ${t("client.visits_unit")}`} />
        <StatBox label={t("client.last_visit")} value={client.lastVisit} />
        <StatBox label={t("client.status")} value={segLabel} />
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mb-5">
        <a
          href={`tel:${client.phone.replace(/\s/g, "")}`}
          className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all font-semibold text-sm"
        >
          <Phone className="w-4 h-4" />
          📞 {t("client.call")}
        </a>
        <button className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-card border border-white/8 text-foreground hover:bg-white/5 transition-all font-semibold text-sm">
          <Pencil className="w-4 h-4 text-primary" />
          ✏️ {t("client.edit")}
        </button>
      </div>

      {/* Phone info row */}
      <div className="bg-card border border-white/8 rounded-2xl p-4 mb-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Phone className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t("client.phone")}</p>
          <p className="text-sm font-semibold text-foreground">{client.phone}</p>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-4">
        <NotesField initial={client.notes} />
      </div>

      {/* Booking history */}
      <BookingHistory history={client.bookingHistory} />
    </Layout>
  );
}

// ── API client detail page ────────────────────────────────────────────────────
function ApiClientDetail({ id }: { id: string }) {
  const { t } = useTranslation();
  const { user } = useAuth(false);
  const isTeam = user?.mode === "team";

  const { data: client, isLoading } = useGetClient(id, {
    query: { enabled: !!id },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-20 text-muted-foreground text-sm">
          {t("client.loading")}
        </div>
      </Layout>
    );
  }

  if (!client) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-muted-foreground text-sm">{t("client.not_found")}</p>
          <Link href="/clients">
            <button className="mt-4 px-4 py-2 rounded-xl bg-primary/20 text-primary text-sm">
              {t("client.back")}
            </button>
          </Link>
        </div>
      </Layout>
    );
  }

  const seg = SEGMENT_META[(client.status as "regular" | "new" | "lost") ?? "new"];

  return (
    <Layout>
      {/* Back */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-lg font-display font-bold text-foreground">{t("client.profile")}</h1>
      </div>

      {/* Avatar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center mb-6"
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/30 font-display font-bold text-primary text-4xl uppercase shadow-xl shadow-primary/10 mb-4">
          {client.name.charAt(0)}
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground">{client.name}</h2>
        {seg && (
          <span className={`mt-2 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border ${seg.bg} ${seg.color}`}>
            {seg.emoji} {seg.label}
          </span>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatBox label={t("client.visits")} value={`${client.visitCount} ${t("client.visits_unit")}`} />
        <StatBox label={t("client.spent")} value={`${client.totalSpent?.toLocaleString() ?? 0} ${t("client.spent_unit")}`} />
      </div>

      {/* Buttons */}
      {client.phone && (
        <div className="flex gap-3 mb-5">
          <a
            href={`tel:${client.phone.replace(/\s/g, "")}`}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all font-semibold text-sm"
          >
            <Phone className="w-4 h-4" />
            📞 {t("client.call")}
          </a>
          <button className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-card border border-white/8 text-foreground hover:bg-white/5 transition-all font-semibold text-sm">
            <Pencil className="w-4 h-4 text-primary" />
            ✏️ {t("client.edit")}
          </button>
        </div>
      )}

      {/* Phone row */}
      {client.phone && (
        <div className="bg-card border border-white/8 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("client.phone")}</p>
            <p className="text-sm font-semibold text-foreground">{client.phone}</p>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="mb-4">
        <NotesField initial={client.notes ?? ""} />
      </div>
    </Layout>
  );
}

// ── Shared stat box ───────────────────────────────────────────────────────────
function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-white/8 rounded-2xl p-4 text-center">
      <p className="text-base font-display font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function ClientDetail() {
  const { t } = useTranslation();
  useAuth();
  const { id } = useParams<{ id: string }>();

  if (!id) return null;

  if (isMockId(id)) {
    const mock = getMockClient(id);
    if (!mock) {
      return (
        <Layout>
          <div className="text-center py-20 text-muted-foreground text-sm">{t("client.not_found_short")}</div>
        </Layout>
      );
    }
    return <MockClientDetail client={mock} />;
  }

  return <ApiClientDetail id={id} />;
}
