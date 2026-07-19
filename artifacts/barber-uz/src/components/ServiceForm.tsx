import { useState } from "react";
import { ArrowLeft } from "lucide-react";

export interface ServiceFormData {
  id?: string;
  name: string;
  category: string;
  duration: number;
  price: number;
  description: string;
}

const DEFAULT_CATS = ["soch", "soqol", "bolalar", "vip"];
const CAT_LABELS: Record<string, string> = {
  soch: "Soch",
  soqol: "Soqol",
  bolalar: "Bolalar",
  vip: "VIP",
};

export function ServiceForm({
  initial,
  customCats = [],
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<ServiceFormData>;
  customCats?: string[];
  onSave: (s: ServiceFormData) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "soch");
  const [duration, setDuration] = useState(String(initial?.duration ?? 30));
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [description, setDescription] = useState(initial?.description ?? "");

  const allCats = [...DEFAULT_CATS, ...customCats];

  function handleSave() {
    if (!name.trim() || !price) return;
    onSave({
      id: initial?.id,
      name: name.trim(),
      category,
      duration: parseInt(duration) || 30,
      price: parseInt(price) || 0,
      description,
    });
  }

  return (
    <div className="space-y-4 pb-8">
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

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Nomi *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fade, Klassik, Soqol..."
          className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Kategoriya</label>
        <div className="flex flex-wrap gap-2">
          {allCats.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                category === c
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-white/4 border-white/8 text-muted-foreground"
              }`}
            >
              {CAT_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Davomiylik (min)</label>
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="30"
            className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Narxi (so'm) *</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="80000"
            className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Tavsif (ixtiyoriy)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Qisqa tavsif..."
          className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50 resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!name.trim() || !price || saving}
        className="w-full h-12 rounded-2xl bg-primary text-black font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
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
