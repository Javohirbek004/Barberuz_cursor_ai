import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageContext";
import { Layout } from "@/components/Layout";
import { useParams, Link } from "wouter";
import { useGetClient, useUpdateClient } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react/custom-fetch";
import {
  ChevronLeft,
  Phone,
  Pencil,
  Check,
  X,
  CalendarDays,
  Scissors,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SEGMENT_META } from "@/data/mockClients";

type Segment = "regular" | "new" | "lost";

interface ClientBooking {
  id: string;
  date: string;
  serviceName: string;
  price: number;
  status: string;
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

function formatBookingDate(dateStr: string): string {
  const months = ["yan", "fev", "mart", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
  const date = new Date(dateStr);
  return `${date.getDate()}-${months[date.getMonth()]}`;
}

function formatPrice(price: number): string {
  return price.toLocaleString("uz-UZ");
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border border-white/8 rounded-2xl p-4 text-center">
      <p className="text-base font-display font-bold text-foreground leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function NotesField({
  clientId,
  initial,
  onSaved,
}: {
  clientId: string;
  initial: string;
  onSaved: (newNote: string) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const [base, setBase] = useState(initial);
  const [flash, setFlash] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { mutateAsync: updateClient, isPending: saving } = useUpdateClient();

  const enterEdit = useCallback(() => {
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  async function save() {
    try {
      await updateClient({ clientId, data: { notes: value } });
      setBase(value);
      onSaved(value);
      setEditing(false);
      setFlash(true);
      setTimeout(() => setFlash(false), 2500);
    } catch {
    }
  }

  function cancel() {
    setValue(base);
    setEditing(false);
  }

  return (
    <div className="bg-card border border-white/8 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          📝 {t("client.notes")}
          <AnimatePresence>
            {flash && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-green-400 text-xs font-semibold"
              >
                Saqlandi ✓
              </motion.span>
            )}
          </AnimatePresence>
        </h3>

        <AnimatePresence mode="wait">
          {!editing ? (
            <motion.button
              key="edit-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={enterEdit}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t("client.notes.edit")}
            </motion.button>
          ) : (
            <motion.div
              key="save-btns"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors font-semibold disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {t("client.notes.save")}
              </button>
              <button
                onClick={cancel}
                disabled={saving}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                {t("client.notes.cancel")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.textarea
            key="textarea"
            ref={textareaRef}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0 }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("client.notes.placeholder")}
            rows={3}
            className="w-full px-3 py-2.5 rounded-xl bg-background/60 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 text-sm resize-none transition-all"
          />
        ) : (
          <motion.p
            key="view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-foreground/80 leading-relaxed min-h-[2.5rem]"
          >
            {base || (
              <span className="text-muted-foreground/50 italic">{t("client.notes.empty")}</span>
            )}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function BookingHistorySection({ clientId }: { clientId: string }) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["client-bookings", clientId],
    queryFn: () =>
      customFetch<{ bookings: ClientBooking[] }>(
        `/api/clients/${clientId}/bookings`
      ),
    enabled: !!clientId,
  });

  const bookings = data?.bookings ?? [];

  if (isLoading) {
    return (
      <div className="bg-card border border-white/8 rounded-2xl p-4">
        <div className="h-4 w-32 bg-white/5 rounded-lg animate-pulse mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card border border-white/8 rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
        <CalendarDays className="w-4 h-4" />
        {t("client.history")}
      </h3>

      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground/50 italic py-2">
          {t("client.history.empty")}
        </p>
      ) : (
        <div className="space-y-0">
          {bookings.map((b, i) => (
            <div
              key={b.id}
              className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Scissors className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{b.serviceName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatBookingDate(b.date)}</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-primary shrink-0">
                {formatPrice(b.price)} {t("client.spent_unit")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditClientModal({
  clientId,
  currentName,
  currentPhone,
  onClose,
  onSaved,
}: {
  clientId: string;
  currentName: string;
  currentPhone: string;
  onClose: () => void;
  onSaved: (name: string, phone: string) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone);
  const { mutateAsync: updateClient, isPending: saving } = useUpdateClient();

  async function handleSave() {
    if (!name.trim()) return;
    try {
      await updateClient({ clientId, data: { name: name.trim(), phone: phone.trim() || undefined } });
      onSaved(name.trim(), phone.trim());
      onClose();
    } catch {
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-md bg-card border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 mx-0 sm:mx-4 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display font-bold text-foreground">
            {t("client.edit.title")}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              {t("client.edit.name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("client.edit.name_placeholder")}
              className="w-full h-12 px-4 rounded-2xl bg-background/60 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">
              {t("client.edit.phone")}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t("client.edit.phone_placeholder")}
              className="w-full h-12 px-4 rounded-2xl bg-background/60 border border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/8 text-muted-foreground hover:bg-white/10 transition-all font-medium text-sm"
          >
            {t("client.edit.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 h-12 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            {t("client.edit.save")}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ClientDetailInner({ id }: { id: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [localName, setLocalName] = useState<string | null>(null);
  const [localPhone, setLocalPhone] = useState<string | null>(null);

  const { data: client, isLoading } = useGetClient(id, {
    query: { enabled: !!id },
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center gap-3 mb-6">
          <Link href="/clients">
            <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
        </div>
        <div className="flex flex-col items-center py-10">
          <div className="w-24 h-24 rounded-full bg-card animate-pulse mb-4" />
          <div className="h-6 w-36 bg-card rounded-xl animate-pulse mb-2" />
          <div className="h-4 w-20 bg-card rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-card rounded-2xl animate-pulse" />
          ))}
        </div>
      </Layout>
    );
  }

  if (!client) {
    return (
      <Layout>
        <div className="flex items-center gap-3 mb-6">
          <Link href="/clients">
            <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
        </div>
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

  const displayName = localName ?? client.name;
  const displayPhone = localPhone ?? client.phone ?? "";
  const segment = (["regular", "new", "lost"].includes(client.status ?? "") ? client.status : "new") as Segment;
  const seg = SEGMENT_META[segment];
  const segLabel = t(`segment.${segment}` as `segment.regular` | `segment.new` | `segment.lost`);
  const lastVisitStr = client.lastVisit ? formatLastVisit(client.lastVisit) : "—";

  function handleEditSaved(name: string, phone: string) {
    setLocalName(name);
    setLocalPhone(phone);
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
  }

  function handleNoteSaved(_newNote: string) {
    queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
  }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-lg font-display font-bold text-foreground">{t("client.profile")}</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center mb-6"
      >
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-2 border-primary/30 font-display font-bold text-primary text-4xl uppercase shadow-xl shadow-primary/10 mb-4">
          {displayName.charAt(0)}
        </div>
        <h2 className="text-2xl font-display font-bold text-foreground">{displayName}</h2>
        {seg && (
          <span className={`mt-2 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full border ${seg.bg} ${seg.color}`}>
            {seg.emoji} {segLabel}
          </span>
        )}
      </motion.div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatBox
          label={t("client.visits")}
          value={`${client.visitCount} ${t("client.visits_unit")}`}
        />
        <StatBox
          label={t("client.last_visit")}
          value={lastVisitStr}
        />
        <StatBox
          label={t("client.spent")}
          value={`${formatPrice(client.totalSpent ?? 0)}`}
        />
      </div>

      <div className="flex gap-3 mb-5">
        {displayPhone ? (
          <a
            href={`tel:${displayPhone.replace(/\s/g, "")}`}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 active:scale-[0.97] transition-all font-semibold text-sm"
          >
            <Phone className="w-4 h-4" />
            {t("client.call")}
          </a>
        ) : (
          <div className="flex-1 h-12 rounded-2xl bg-white/3 border border-white/5 flex items-center justify-center gap-2 text-muted-foreground/30 text-sm">
            <Phone className="w-4 h-4" />
            {t("client.call")}
          </div>
        )}
        <button
          onClick={() => setShowEdit(true)}
          className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-card border border-white/8 text-foreground hover:bg-white/5 active:scale-[0.97] transition-all font-semibold text-sm"
        >
          <Pencil className="w-4 h-4 text-primary" />
          {t("client.edit")}
        </button>
      </div>

      {displayPhone && (
        <div className="bg-card border border-white/8 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("client.phone")}</p>
            <p className="text-sm font-semibold text-foreground">{displayPhone}</p>
          </div>
        </div>
      )}

      <div className="mb-4">
        <NotesField
          clientId={id}
          initial={client.notes ?? ""}
          onSaved={handleNoteSaved}
        />
      </div>

      <BookingHistorySection clientId={id} />

      <div className="h-8" />

      <AnimatePresence>
        {showEdit && (
          <EditClientModal
            clientId={id}
            currentName={displayName}
            currentPhone={displayPhone}
            onClose={() => setShowEdit(false)}
            onSaved={handleEditSaved}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}

export default function ClientDetail() {
  useAuth();
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <ClientDetailInner id={id} />;
}
