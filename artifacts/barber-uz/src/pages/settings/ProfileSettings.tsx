import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Link, useLocation } from "wouter";
import { useGetProfile } from "@workspace/api-client-react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Section = "info" | "specializations" | "bio" | "schedule";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

type WeekSchedule = Record<DayKey, DaySchedule>;

interface ProfileData {
  id?: string;
  name: string;
  username?: string;
  brandName?: string | null;
  mode?: string;
  phone?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  specializations?: string | null;
  scheduleJson?: string | null;
  lunchBreakEnabled?: boolean;
  lunchBreakStart?: string | null;
  lunchBreakEnd?: string | null;
}

const DAY_LABELS: Record<DayKey, string> = {
  monday:    "Dushanba",
  tuesday:   "Seshanba",
  wednesday: "Chorshanba",
  thursday:  "Payshanba",
  friday:    "Juma",
  saturday:  "Shanba",
  sunday:    "Yakshanba",
};

const DAY_KEYS: DayKey[] = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

const DEFAULT_SCHEDULE: WeekSchedule = {
  monday:    { enabled: true,  start: "09:00", end: "21:00" },
  tuesday:   { enabled: true,  start: "09:00", end: "21:00" },
  wednesday: { enabled: true,  start: "09:00", end: "21:00" },
  thursday:  { enabled: true,  start: "09:00", end: "21:00" },
  friday:    { enabled: true,  start: "09:00", end: "21:00" },
  saturday:  { enabled: true,  start: "09:00", end: "21:00" },
  sunday:    { enabled: false, start: "09:00", end: "21:00" },
};

const SPECIALIZATION_OPTIONS = ["Fade", "Soch olish", "Soqol", "Soqol tekislash", "Bolalar", "Kompleks"];

async function saveProfile(patch: Partial<ProfileData> & Record<string, unknown>): Promise<boolean> {
  const token = localStorage.getItem("barber_token") ?? "";
  const res = await fetch("/api/settings/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
  return res.ok;
}

function parseSchedule(raw: string | null | undefined): WeekSchedule {
  if (!raw) return DEFAULT_SCHEDULE;
  try {
    return JSON.parse(raw) as WeekSchedule;
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

function parseSpecializations(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function schedulePreview(sched: WeekSchedule): string {
  const on = DAY_KEYS.filter(d => sched[d].enabled);
  if (on.length === 0) return "Yopiq";
  const first = DAY_LABELS[on[0]].slice(0, 2);
  const last  = DAY_LABELS[on[on.length - 1]].slice(0, 2);
  const start = sched[on[0]].start;
  const end   = sched[on[on.length - 1]].end;
  return `${first}–${last} ${start}–${end}`;
}

function UnsavedDialog({ onLeave, onSave }: { onLeave: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onLeave} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <h3 className="font-display font-bold text-lg text-foreground mb-2">Saqlanmagan o'zgarishlar</h3>
        <p className="text-sm text-muted-foreground mb-5">
          O'zgartirishlar saqlanmagan. Chiqib ketasizmi?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onLeave}
            className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-semibold text-foreground hover:bg-white/10 transition-all"
          >
            Chiqish
          </button>
          <button
            onClick={onSave}
            className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all"
          >
            Saqlash
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SectionCard({
  emoji, title, preview, onClick, index
}: { emoji: string; title: string; preview: string; onClick: () => void; index: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-card border border-white/6 rounded-2xl px-4 py-3.5 hover:bg-white/4 hover:border-white/10 transition-all group text-left"
    >
      <div className="w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center text-xl shrink-0 transition-colors">
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground leading-tight">{title}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{preview}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
    </motion.button>
  );
}

function SectionHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={onBack}
        className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors shrink-0"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <h2 className="text-lg font-display font-bold text-foreground">{title}</h2>
    </div>
  );
}

function SaveBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all mt-4"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        <><Check className="w-5 h-5" /> Saqlash</>
      )}
    </button>
  );
}

function useInlineToast() {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const show = useCallback((text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 2800);
  }, []);
  return { msg, show };
}

function InlineToast({ msg }: { msg: { text: string; ok: boolean } | null }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold text-white whitespace-nowrap shadow-xl ${
            msg.ok ? "bg-green-500/90" : "bg-red-500/90"
          }`}
        >
          {msg.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text"
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 px-4 rounded-2xl bg-card border border-white/8 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/15 text-sm transition-all"
      />
    </div>
  );
}

function InfoForm({
  profile,
  isTeam,
  onBack,
  onSaved,
}: {
  profile: ProfileData;
  isTeam: boolean;
  onBack: () => void;
  onSaved: (patch: Partial<ProfileData>) => void;
}) {
  const [form, setForm] = useState({
    name:      profile.name      ?? "",
    brandName: profile.brandName ?? "",
    phone:     profile.phone     ?? "",
    avatarUrl: profile.avatarUrl ?? "",
  });
  const [dirty, setDirty] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const { msg, show } = useInlineToast();

  function update(field: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [field]: val }));
    setDirty(true);
  }

  function handleBack() {
    if (dirty) setShowDialog(true);
    else onBack();
  }

  async function handleSave(): Promise<boolean> {
    setSaving(true);
    const ok = await saveProfile({
      name:      form.name,
      brandName: form.brandName || null,
      phone:     form.phone     || null,
      avatarUrl: form.avatarUrl || null,
    });
    setSaving(false);
    if (ok) {
      setDirty(false);
      onSaved(form);
      show("Saqlandi ✓");
    } else {
      show("Xatolik yuz berdi", false);
    }
    return ok;
  }

  const avatarLetter = (form.name || "B").charAt(0).toUpperCase();

  return (
    <>
      <SectionHeader title={isTeam ? "🏪 Asosiy ma'lumotlar" : "👤 Asosiy ma'lumotlar"} onBack={handleBack} />

      <div className="flex flex-col items-center mb-6">
        {form.avatarUrl ? (
          <img
            src={form.avatarUrl}
            alt="avatar"
            className="w-24 h-24 rounded-2xl object-cover border-2 border-primary/30 shadow-xl"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/25 flex items-center justify-center font-display font-bold text-primary text-4xl">
            {avatarLetter}
          </div>
        )}
        <label className="mt-2 text-xs text-primary cursor-pointer">
          {isTeam ? "Logo URL" : "Rasm URL"}
        </label>
        <input
          value={form.avatarUrl}
          onChange={e => update("avatarUrl", e.target.value)}
          placeholder="https://..."
          className="mt-1 w-full px-3 py-2 rounded-xl bg-card border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 text-center"
        />
      </div>

      <div className="space-y-4">
        <Field label="Ism" value={form.name} onChange={v => update("name", v)} placeholder="Javohirbek" />
        <Field
          label={isTeam ? "Barbershop nomi" : "Barbershop nomi (ixtiyoriy)"}
          value={form.brandName}
          onChange={v => update("brandName", v)}
          placeholder={isTeam ? "Black Star Barbershop" : "JB Barber"}
        />
        <Field
          label="Telefon"
          value={form.phone}
          onChange={v => update("phone", v)}
          placeholder="+998 90 123 45 67"
          type="tel"
        />
      </div>

      {isTeam && (
        <p className="mt-3 text-xs text-muted-foreground/60 px-1">
          ❗ Bu ma'lumotlar sahifaga ham ta'sir qiladi
        </p>
      )}

      <SaveBtn loading={saving} onClick={handleSave} />
      <InlineToast msg={msg} />
      {showDialog && (
        <UnsavedDialog
          onLeave={() => { setDirty(false); onBack(); }}
          onSave={async () => {
            setShowDialog(false);
            const ok = await handleSave();
            if (ok) onBack();
          }}
        />
      )}
    </>
  );
}

function SpecializationsForm({
  profile,
  onBack,
  onSaved,
}: {
  profile: ProfileData;
  onBack: () => void;
  onSaved: (patch: Partial<ProfileData>) => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => parseSpecializations(profile.specializations));
  const [dirty, setDirty] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const { msg, show } = useInlineToast();

  function toggle(item: string) {
    setSelected(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);
    setDirty(true);
  }

  function handleBack() {
    if (dirty) setShowDialog(true);
    else onBack();
  }

  async function handleSave(): Promise<boolean> {
    setSaving(true);
    const serialized = JSON.stringify(selected);
    const ok = await saveProfile({ specializations: serialized });
    setSaving(false);
    if (ok) {
      setDirty(false);
      onSaved({ specializations: serialized });
      show("Saqlandi ✓");
    } else {
      show("Xatolik yuz berdi", false);
    }
    return ok;
  }

  return (
    <>
      <SectionHeader title="✂️ Mutaxassislik" onBack={handleBack} />
      <p className="text-sm text-muted-foreground mb-4">
        Qaysi xizmatlar bo'yicha mutaxassisligingizni tanlang:
      </p>

      <div className="flex flex-wrap gap-2">
        {SPECIALIZATION_OPTIONS.map(item => {
          const active = selected.includes(item);
          return (
            <button
              key={item}
              onClick={() => toggle(item)}
              className={`px-4 py-2.5 rounded-2xl text-sm font-semibold border transition-all ${
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                  : "bg-card border-white/8 text-muted-foreground hover:bg-white/5"
              }`}
            >
              {active && "✓ "}{item}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground/60 px-1">❗ Sahifada ham ko'rinadi</p>
      <SaveBtn loading={saving} onClick={handleSave} />
      <InlineToast msg={msg} />
      {showDialog && (
        <UnsavedDialog
          onLeave={() => { setDirty(false); onBack(); }}
          onSave={async () => {
            setShowDialog(false);
            const ok = await handleSave();
            if (ok) onBack();
          }}
        />
      )}
    </>
  );
}

function BioForm({
  profile,
  isTeam,
  onBack,
  onSaved,
}: {
  profile: ProfileData;
  isTeam: boolean;
  onBack: () => void;
  onSaved: (patch: Partial<ProfileData>) => void;
}) {
  const [bio, setBio] = useState(profile.bio ?? "");
  const [dirty, setDirty] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const { msg, show } = useInlineToast();

  function handleBack() {
    if (dirty) setShowDialog(true);
    else onBack();
  }

  async function handleSave(): Promise<boolean> {
    setSaving(true);
    const ok = await saveProfile({ bio: bio || null });
    setSaving(false);
    if (ok) {
      setDirty(false);
      onSaved({ bio });
      show("Saqlandi ✓");
    } else {
      show("Xatolik yuz berdi", false);
    }
    return ok;
  }

  return (
    <>
      <SectionHeader title={isTeam ? "📝 Qisqa tavsif" : "📝 Qisqa bio"} onBack={handleBack} />
      <p className="text-sm text-muted-foreground mb-4">1–2 qator qisqa ma'lumot yozing:</p>

      <div className="relative">
        <textarea
          value={bio}
          onChange={e => { setBio(e.target.value); setDirty(true); }}
          placeholder="10 yillik tajriba, yuqori sifat kafolati..."
          maxLength={200}
          rows={4}
          className="w-full px-4 py-3.5 rounded-2xl bg-card border border-white/8 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 text-sm resize-none transition-all"
        />
        <span className={`absolute bottom-3 right-3 text-xs ${bio.length > 180 ? "text-orange-400" : "text-muted-foreground/40"}`}>
          {bio.length}/200
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground/60 px-1">❗ Bu qisqa versiya — sahifada ham chiqadi</p>
      <SaveBtn loading={saving} onClick={handleSave} />
      <InlineToast msg={msg} />
      {showDialog && (
        <UnsavedDialog
          onLeave={() => { setDirty(false); onBack(); }}
          onSave={async () => {
            setShowDialog(false);
            const ok = await handleSave();
            if (ok) onBack();
          }}
        />
      )}
    </>
  );
}

function ScheduleForm({
  profile,
  onBack,
  onSaved,
}: {
  profile: ProfileData;
  onBack: () => void;
  onSaved: (patch: Partial<ProfileData>) => void;
}) {
  const [sched, setSched] = useState<WeekSchedule>(() => parseSchedule(profile.scheduleJson));
  const [lunchOn, setLunchOn] = useState(profile.lunchBreakEnabled ?? false);
  const [lunchStart, setLunchStart] = useState(profile.lunchBreakStart ?? "12:00");
  const [lunchEnd, setLunchEnd]     = useState(profile.lunchBreakEnd   ?? "13:00");
  const [dirty, setDirty] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const { msg, show } = useInlineToast();

  function updateDay(day: DayKey, field: keyof DaySchedule, value: boolean | string) {
    setSched(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
    setDirty(true);
  }

  function validate(): boolean {
    const errs: string[] = [];

    for (const day of DAY_KEYS) {
      if (!sched[day].enabled) continue;
      if (sched[day].start >= sched[day].end) {
        errs.push(`${DAY_LABELS[day]}: boshlanish vaqti tugash vaqtidan oldin bo'lishi kerak`);
      }
      if (lunchOn) {
        if (lunchStart < sched[day].start || lunchEnd > sched[day].end) {
          errs.push(`${DAY_LABELS[day]}: tushlik ish vaqtidan (${sched[day].start}–${sched[day].end}) tashqarida`);
        }
      }
    }

    if (lunchOn && lunchStart >= lunchEnd) {
      errs.push("Tushlik: boshlanish vaqti tugash vaqtidan oldin bo'lishi kerak");
    }

    setErrors(errs);
    return errs.length === 0;
  }

  function handleBack() {
    if (dirty) setShowDialog(true);
    else onBack();
  }

  async function handleSave(): Promise<boolean> {
    if (!validate()) return false;
    setSaving(true);
    const patch = {
      scheduleJson:       JSON.stringify(sched),
      lunchBreakEnabled:  lunchOn,
      lunchBreakStart:    lunchStart,
      lunchBreakEnd:      lunchEnd,
    };
    const ok = await saveProfile(patch);
    setSaving(false);
    if (ok) {
      setDirty(false);
      onSaved(patch);
      show("Saqlandi ✓");
    } else {
      show("Xatolik yuz berdi", false);
    }
    return ok;
  }

  return (
    <>
      <SectionHeader title="🕒 Ish vaqti" onBack={handleBack} />

      <div className="space-y-2 mb-5">
        {DAY_KEYS.map(day => (
          <div key={day} className="flex items-center gap-3 bg-card border border-white/6 rounded-2xl px-4 py-3">
            <button
              onClick={() => updateDay(day, "enabled", !sched[day].enabled)}
              className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${sched[day].enabled ? "bg-primary" : "bg-white/10"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  sched[day].enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>

            <span className={`text-sm font-medium w-24 shrink-0 ${sched[day].enabled ? "text-foreground" : "text-muted-foreground/50"}`}>
              {DAY_LABELS[day]}
            </span>

            {sched[day].enabled ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={sched[day].start}
                  onChange={e => updateDay(day, "start", e.target.value)}
                  className="flex-1 h-9 px-2 rounded-xl bg-background/60 border border-white/8 text-foreground text-sm focus:outline-none focus:border-primary/40"
                />
                <span className="text-muted-foreground text-xs">–</span>
                <input
                  type="time"
                  value={sched[day].end}
                  onChange={e => updateDay(day, "end", e.target.value)}
                  className="flex-1 h-9 px-2 rounded-xl bg-background/60 border border-white/8 text-foreground text-sm focus:outline-none focus:border-primary/40"
                />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground/40 font-medium">YOPIQ</span>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-white/6 my-5" />

      <div className="bg-card border border-white/6 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-sm text-foreground">🍽 Tushlik vaqti</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Ixtiyoriy</p>
          </div>
          <button
            onClick={() => { setLunchOn(!lunchOn); setDirty(true); }}
            className={`relative w-11 h-6 rounded-full transition-all ${lunchOn ? "bg-primary" : "bg-white/10"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${lunchOn ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {lunchOn && (
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={lunchStart}
              onChange={e => { setLunchStart(e.target.value); setDirty(true); }}
              className="flex-1 h-9 px-2 rounded-xl bg-background/60 border border-white/8 text-foreground text-sm focus:outline-none focus:border-primary/40"
            />
            <span className="text-muted-foreground text-xs">–</span>
            <input
              type="time"
              value={lunchEnd}
              onChange={e => { setLunchEnd(e.target.value); setDirty(true); }}
              className="flex-1 h-9 px-2 rounded-xl bg-background/60 border border-white/8 text-foreground text-sm focus:outline-none focus:border-primary/40"
            />
          </div>
        )}
      </div>

      {errors.length > 0 && (
        <div className="mt-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-xs text-red-400 px-1">⚠️ {e}</p>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground/60 px-1">❗ Kalendar va sahifaga ta'sir qiladi</p>
      <SaveBtn loading={saving} onClick={handleSave} />
      <InlineToast msg={msg} />
      {showDialog && (
        <UnsavedDialog
          onLeave={() => { setDirty(false); onBack(); }}
          onSave={async () => {
            setShowDialog(false);
            const ok = await handleSave();
            if (ok) onBack();
          }}
        />
      )}
    </>
  );
}

function isTelegramConnected(): boolean {
  try {
    const u = JSON.parse(localStorage.getItem("barber_user") || "null");
    return u?.telegramVerified === true;
  } catch {
    return false;
  }
}

function TelegramBanner() {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (isTelegramConnected() || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 flex items-center gap-3 bg-[#2AABEE]/10 border border-[#2AABEE]/20 rounded-2xl px-4 py-3"
    >
      <span className="text-lg shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Telegram ulanmagan</p>
        <p className="text-xs text-muted-foreground">Xabarlarni olish uchun ulang</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate("/verify-telegram")}
          className="h-8 px-3 rounded-xl bg-[#2AABEE] text-white text-xs font-bold hover:bg-[#229ED9] transition-colors"
        >
          Ulanish
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          ×
        </button>
      </div>
    </motion.div>
  );
}

export default function ProfileSettings() {
  const { user, logout } = useAuth();
  const isTeam = user?.mode === "team";
  const pageTitle = isTeam ? "Barbershop profili" : "Mening profilim";

  const { data: profileRaw, isLoading } = useGetProfile();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);

  useEffect(() => {
    if (profileRaw) setProfile(profileRaw as ProfileData);
  }, [profileRaw]);

  function handleSaved(patch: Partial<ProfileData>) {
    setProfile(prev => prev ? { ...prev, ...patch } : prev);
  }

  if (isLoading || !profile) {
    return (
      <Layout>
        <div className="py-20 text-center text-muted-foreground text-sm">Yuklanmoqda...</div>
      </Layout>
    );
  }

  if (activeSection === "info") {
    return (
      <Layout>
        <InfoForm
          profile={profile}
          isTeam={isTeam}
          onBack={() => setActiveSection(null)}
          onSaved={handleSaved}
        />
      </Layout>
    );
  }

  if (activeSection === "specializations") {
    return (
      <Layout>
        <SpecializationsForm
          profile={profile}
          onBack={() => setActiveSection(null)}
          onSaved={handleSaved}
        />
      </Layout>
    );
  }

  if (activeSection === "bio") {
    return (
      <Layout>
        <BioForm
          profile={profile}
          isTeam={isTeam}
          onBack={() => setActiveSection(null)}
          onSaved={handleSaved}
        />
      </Layout>
    );
  }

  if (activeSection === "schedule") {
    return (
      <Layout>
        <ScheduleForm
          profile={profile}
          onBack={() => setActiveSection(null)}
          onSaved={handleSaved}
        />
      </Layout>
    );
  }

  const sched = parseSchedule(profile.scheduleJson);
  const specs  = parseSpecializations(profile.specializations);

  const soloSections: { key: Section; emoji: string; title: string; preview: string }[] = [
    {
      key: "info",
      emoji: "👤",
      title: "Asosiy ma'lumotlar",
      preview: [profile.name, profile.phone].filter(Boolean).join(" · ") || "To'ldiring",
    },
    {
      key: "specializations",
      emoji: "✂️",
      title: "Mutaxassislik",
      preview: specs.length > 0 ? specs.join(", ") : "Tanlanmagan",
    },
    {
      key: "bio",
      emoji: "📝",
      title: "Qisqa bio",
      preview: profile.bio ? profile.bio.slice(0, 50) + (profile.bio.length > 50 ? "…" : "") : "Yozilmagan",
    },
    {
      key: "schedule",
      emoji: "🕒",
      title: "Ish vaqti",
      preview: schedulePreview(sched),
    },
  ];

  const teamSections: { key: Section; emoji: string; title: string; preview: string }[] = [
    {
      key: "info",
      emoji: "🏪",
      title: "Asosiy ma'lumotlar",
      preview: [profile.brandName || profile.name, profile.phone].filter(Boolean).join(" · ") || "To'ldiring",
    },
    {
      key: "bio",
      emoji: "📝",
      title: "Qisqa tavsif",
      preview: profile.bio ? profile.bio.slice(0, 50) + (profile.bio.length > 50 ? "…" : "") : "Yozilmagan",
    },
    {
      key: "schedule",
      emoji: "🕒",
      title: "Ish vaqti",
      preview: schedulePreview(sched),
    },
  ];

  const sections = isTeam ? teamSections : soloSections;

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-7">
        <Link href="/settings">
          <button className="w-10 h-10 rounded-2xl bg-card border border-white/8 flex items-center justify-center hover:bg-white/5 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <h1 className="text-xl font-display font-bold text-foreground">{pageTitle}</h1>
      </div>

      <TelegramBanner />

      <div className="space-y-2.5">
        {sections.map((s, i) => (
          <SectionCard
            key={s.key}
            emoji={s.emoji}
            title={s.title}
            preview={s.preview}
            onClick={() => setActiveSection(s.key)}
            index={i}
          />
        ))}
      </div>

      <div className="mt-8 pb-4">
        <button
          onClick={logout}
          className="w-full p-4 rounded-2xl bg-destructive/10 text-destructive font-bold text-base flex items-center justify-center gap-2 hover:bg-destructive/20 transition-all border border-destructive/20"
        >
          🚪 Hisobdan chiqish
        </button>
      </div>
    </Layout>
  );
}
