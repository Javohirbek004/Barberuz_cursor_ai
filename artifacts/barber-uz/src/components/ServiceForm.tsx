import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  useListCategories,
  type ServiceCategory,
} from "@/hooks/useCategories";

export interface ServiceFormData {
  id?: string;
  name: string;
  categoryId: string | null;
  duration: number;
  price: number;
  description?: string;
}

function formatPriceDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function pickDefaultCategoryId(
  preferred: string | null | undefined,
  categories: ServiceCategory[],
): string | null {
  if (preferred && categories.some((c) => c.id === preferred)) return preferred;
  const soch = categories.find((c) => c.name.toLowerCase().includes("soch"));
  return soch?.id ?? categories[0]?.id ?? null;
}

export function ServiceForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<ServiceFormData>;
  onSave: (s: ServiceFormData) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [duration, setDuration] = useState(String(initial?.duration ?? 30));
  const [price, setPrice] = useState(
    initial?.price != null && initial.price !== 0 ? formatPriceDigits(String(initial.price)) : "",
  );

  const { data: categories = [] } = useListCategories();

  useEffect(() => {
    if (initial?.id) return;
    setCategoryId((current) => {
      if (current && categories.some((c) => c.id === current)) return current;
      return pickDefaultCategoryId(initial?.categoryId ?? null, categories);
    });
  }, [categories, initial?.id, initial?.categoryId]);

  function handleSave() {
    if (!name.trim() || !price) return;
    onSave({
      id: initial?.id,
      name: name.trim(),
      categoryId,
      duration: parseInt(duration) || 30,
      price: parseInt(price.replace(/\D/g, ""), 10) || 0,
    });
  }

  function focusField(event: { target: EventTarget | null }) {
    const node = event.target;
    if (!(node instanceof HTMLElement)) return;
    window.setTimeout(() => {
      node.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 280);
  }

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={onCancel}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h3 className="font-bold text-foreground">
          {initial?.id ? "Xizmatni tahrirlash" : "Yangi xizmat"}
        </h3>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Nomi *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={focusField}
          placeholder="Masalan: Soch olish, Soqol tekislash..."
          className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50"
        />
      </div>

      {/* Category — horizontal pill chips */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Kategoriya</label>
        <div className="flex flex-wrap gap-2">
          {categories.map((c: ServiceCategory) => {
            const active = categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(active ? null : c.id)}
                className={`h-8 px-3 rounded-full text-xs font-semibold border transition-all ${
                  active
                    ? "bg-primary text-black border-primary"
                    : "bg-white/5 text-muted-foreground border-white/10 hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration + Price */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Davomiylik (min)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onFocus={focusField}
            placeholder="30"
            className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Narxi (so'm) *</label>
          <input
            type="text"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(formatPriceDigits(e.target.value))}
            onFocus={focusField}
            placeholder="Masalan: 80 000"
            className="w-full h-12 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm tabular-nums focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={!name.trim() || !price || saving}
        className="w-full h-12 mt-2 rounded-2xl bg-primary text-black font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Saqlanmoqda...
          </>
        ) : initial?.id ? (
          "Saqlash"
        ) : (
          "Qo'shish"
        )}
      </button>
    </div>
  );
}
