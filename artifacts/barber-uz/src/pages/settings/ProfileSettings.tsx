import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageContext";
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

const DAY_KEY_TO_T: Record<DayKey, string> = {
  monday:    "day.monday",
  tuesday:   "day.tuesday",
  wednesday: "day.wednesday",
  thursday:  "day.thursday",
  friday:    "day.friday",
  saturday:  "day.saturday",
  sunday:    "day.sunday",
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

function schedulePreview(sched: WeekSchedule, t: (k: string) => string): string {
  const on = DAY_KEYS.filter(d => sched[d].enabled);
  if (on.length === 0) return t("profile.schedule.closed");
  const first = t(DAY_KEY_TO_T[on[0]]).slice(0, 2);
  const last  = t(DAY_KEY_TO_T[on[on.length - 1]]).slice(0, 2);
  const start = sched[on[0]].start;
  const end   = sched[on[on.length - 1]].end;
  return `${first}–${last} ${start}–${end}`;
}

function UnsavedDialog({ onLeave, onSave }: { onLeave: () => void; onSave: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onLeave} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-sm bg-card border border-white/10 rounded-3xl p-6 shadow-2xl"
      >
        <h3 className="font-display font-bold text-lg text-foreground mb-2">{t("profile.unsaved.title")}</h3>
        <p className="text-sm text-muted-foreground mb-5">{t("profile.unsaved.desc")}</p>
        <div className="flex gap-3">
          <button
            onClick={onLeave}
            className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 text-sm font-semibold text-foreground hover:bg-white/10 transition-all"
          >
            {t("profile.unsaved.leave")}
          </button>
          <button
            onClick={onSave}
            className="flex-1 h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all"
          >
            {t("profile.unsaved.save")}
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

function SaveBtn({ loading, onClick, label }: { loading: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-60 transition-all mt-4"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        <><Check className="w-5 h-5" /> {label}</>
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
  const { t } = useTranslation();
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
      show(t("profile.saved"));
    } else {
      show(t("profile.error"), false);
    }
    return ok;
  }

  const avatarLetter = (form.name || "B").charAt(0).toUpperCase();

  return (
    <>
      <SectionHeader title={`${isTeam ? "🏪" : "👤"} ${t("profile.section.info")}`} onBack={handleBack} />

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
          {isTeam ? t("profile.info.avatar_label.team") : t("profile.info.avatar_label.solo")}
        </label>
        <input
          value={form.avatarUrl}
          onChange={e => update("avatarUrl", e.target.value)}
          placeholder="https://..."
          className="mt-1 w-full px-3 py-2 rounded-xl bg-card border border-white/8 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 text-center"
        />
      </div>

      <div className="space-y-4">
        <Field label={t("profile.info.name")} value={form.name} onChange={v => update("name", v)} placeholder="Javohirbek" />
        <Field
          label={isTeam ? t("profile.info.brand") : t("profile.info.brand_optional")}
          value={form.brandName}
          onChange={v => update("brandName", v)}
          placeholder={isTeam ? "Black Star Barbershop" : "JB Barber"}
        />
        <Field
          label={t("profile.info.phone")}
          value={form.phone}
          onChange={v => update("phone", v)}
          placeholder="+998 90 123 45 67"
          type="tel"
        />
      </div>

      {isTeam && (
        <p className="mt-3 text-xs text-muted-foreground/60 px-1">
          {t("profile.info.team_note")}
        </p>
      )}

      <SaveBtn loading={saving} onClick={handleSave} label={t("profile.save")} />
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
  const { t } = useTranslation();
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
      show(t("profile.saved"));
    } else {
      show(t("profile.error"), false);
    }
    return ok;
  }

  return (
    <>
      <SectionHeader title={`✂️ ${t("profile.section.spec")}`} onBack={handleBack} />
      <p className="text-sm text-muted-foreground mb-4">{t("profile.spec.select")}</p>

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

      <p className="mt-3 text-xs text-muted-foreground/60 px-1">{t("profile.spec.visible")}</p>
      <SaveBtn loading={saving} onClick={handleSave} label={t("profile.save")} />
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
  const { t } = useTranslation();
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
      show(t("profile.saved"));
    } else {
      show(t("profile.error"), false);
    }
    return ok;
  }

  return (
    <>
      <SectionHeader title={`📝 ${isTeam ? t("profile.section.bio.team") : t("profile.section.bio.solo")}`} onBack={handleBack} />
      <p className="text-sm text-muted-foreground mb-4">{t("profile.bio.hint")}</p>

      <div className="relative">
        <textarea
          value={bio}
          onChange={e => { setBio(e.target.value); setDirty(true); }}
          placeholder={t("profile.bio.placeholder")}
          maxLength={200}
          rows={4}
          className="w-full px-4 py-3.5 rounded-2xl bg-card border border-white/8 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 text-sm resize-none transition-all"
        />
        <span className={`absolute bottom-3 right-3 text-xs ${bio.length > 180 ? "text-orange-400" : "text-muted-foreground/40"}`}>
          {bio.length}/200
        </span>
      </div>

      <p className="mt-2 text-xs text-muted-foreground/60 px-1">{t("profile.bio.visible")}</p>
      <SaveBtn loading={saving} onClick={handleSave} label={t("profile.save")} />
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
  const { t } = useTranslation();
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
        errs.push(`${t(DAY_KEY_TO_T[day])}: ${t("profile.schedule.error.time_order")}`);
      }
      if (lunchOn) {
        if (lunchStart < sched[day].start || lunchEnd > sched[day].end) {
          errs.push(`${t(DAY_KEY_TO_T[day])}: ${t("profile.schedule.error.lunch_outside")} (${sched[day].start}–${sched[day].end})`);
        }
      }
    }

    if (lunchOn && lunchStart >= lunchEnd) {
      errs.push(`${t("profile.schedule.lunch").replace("🍽 ", "")}: ${t("profile.schedule.error.time_order")}`);
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
      show(t("profile.saved"));
    } else {
      show(t("profile.error"), false);
    }
    return ok;
  }

  return (
    <>
      <SectionHeader title={`🕒 ${t("profile.section.schedule")}`} onBack={handleBack} />

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
              {t(DAY_KEY_TO_T[day])}
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
              <span className="text-xs text-muted-foreground/40 font-medium">{t("profile.schedule.closed")}</span>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-white/6 my-5" />

      <div className="bg-card border border-white/6 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-sm text-foreground">{t("profile.schedule.lunch")}</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">{t("profile.schedule.lunch_optional")}</p>
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

      <p className="mt-3 text-xs text-muted-foreground/60 px-1">{t("profile.schedule.note")}</p>
      <SaveBtn loading={saving} onClick={handleSave} label={t("profile.save")} />
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
  const { t } = useTranslation();
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
        <p className="text-sm font-semibold text-foreground">{t("profile.telegram.not_connected")}</p>
        <p className="text-xs text-muted-foreground">{t("profile.telegram.connect_msg")}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate("/verify-telegram")}
          className="h-8 px-3 rounded-xl bg-[#2AABEE] text-white text-xs font-bold hover:bg-[#229ED9] transition-colors"
        >
          {t("profile.telegram.connect_btn")}
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
  const { user } = useAuth();
  const { t } = useTranslation();
  const isTeam = user?.mode === "team";

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
        <div className="py-20 text-center text-muted-foreground text-sm">{t("loading")}</div>
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
      title: t("profile.section.info"),
      preview: [profile.name, profile.phone].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "specializations",
      emoji: "✂️",
      title: t("profile.section.spec"),
      preview: specs.length > 0 ? specs.join(", ") : "—",
    },
    {
      key: "bio",
      emoji: "📝",
      title: t("profile.section.bio.solo"),
      preview: profile.bio ? profile.bio.slice(0, 50) + (profile.bio.length > 50 ? "…" : "") : "—",
    },
    {
      key: "schedule",
      emoji: "🕒",
      title: t("profile.section.schedule"),
      preview: schedulePreview(sched, t),
    },
  ];

  const teamSections: { key: Section; emoji: string; title: string; preview: string }[] = [
    {
      key: "info",
      emoji: "🏪",
      title: t("profile.section.info"),
      preview: [profile.brandName || profile.name, profile.phone].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "bio",
      emoji: "📝",
      title: t("profile.section.bio.team"),
      preview: profile.bio ? profile.bio.slice(0, 50) + (profile.bio.length > 50 ? "…" : "") : "—",
    },
    {
      key: "schedule",
      emoji: "🕒",
      title: t("profile.section.schedule"),
      preview: schedulePreview(sched, t),
    },
  ];

  const sections = isTeam ? teamSections : soloSections;
  const pageTitle = isTeam ? t("settings.profile.team") : t("settings.profile.solo");

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

    </Layout>
  );
}
