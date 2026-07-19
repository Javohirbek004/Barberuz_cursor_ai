import { useState } from "react";
import { ArrowLeft, Plus, Check, X } from "lucide-react";
import {
  useListCategories,
  useCreateCategory,
  type ServiceCategory,
} from "@/hooks/useCategories";

export interface ServiceFormData {
  id?: string;
  name: string;
  categoryId: string | null;
  duration: number;
  price: number;
  description: string;
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
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  const [description, setDescription] = useState(initial?.description ?? "");

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catCreating, setCatCreating] = useState(false);

  const { data: categories = [] } = useListCategories();
  const createCatMut = useCreateCategory();

  function handleSave() {
    if (!name.trim() || !price) return;
    onSave({
      id: initial?.id,
      name: name.trim(),
      categoryId,
      duration: parseInt(duration) || 30,
      price: parseInt(price) || 0,
      description,
    });
  }

  async function handleCreateCat() {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    setCatCreating(true);
    try {
      const created = await createCatMut.mutateAsync(trimmed);
      setCategoryId(created.id);
      setShowNewCat(false);
      setNewCatName("");
    } finally {
      setCatCreating(false);
    }
  }

  const selectedCat = categories.find((c: ServiceCategory) => c.id === categoryId);

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

      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Nomi *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fade, Klassik, Soqol..."
          className="w-full h-11 px-4 rounded-2xl bg-white/5 border border-white/8 text-sm focus:outline-none focus:border-primary/50"
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-muted-foreground">Kategoriya</label>
        <div className="flex gap-2">
          <select
            value={categoryId ?? ""}
            onChange={(e) => setCategoryId(e.target.value || null)}
            className="flex-1 h-11 px-3 rounded-2xl bg-white/5 border border-white/8 text-sm text-foreground focus:outline-none focus:border-primary/50 appearance-none"
          >
            <option value="">— Kategoriya tanlang —</option>
            {categories.map((c: ServiceCategory) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Inline new-category creation */}
          {showNewCat ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCat()}
                placeholder="Yangi kategoriya"
                className="h-11 w-32 px-3 rounded-2xl text-xs bg-white/5 border border-white/15 focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={handleCreateCat}
                disabled={catCreating || !newCatName.trim()}
                className="h-11 w-11 rounded-2xl bg-primary/15 border border-primary/30 text-primary flex items-center justify-center disabled:opacity-40"
              >
                {catCreating ? (
                  <span className="w-3.5 h-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => { setShowNewCat(false); setNewCatName(""); }}
                className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 text-muted-foreground flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewCat(true)}
              className="h-11 px-3 rounded-2xl bg-white/5 border border-dashed border-white/15 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center gap-1 text-xs font-semibold shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Yangi
            </button>
          )}
        </div>
        {selectedCat && (
          <p className="text-[11px] text-muted-foreground/60 px-1">
            Tanlangan: <span className="text-primary">{selectedCat.name}</span>
          </p>
        )}
      </div>

      {/* Duration + Price */}
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

      {/* Description */}
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
