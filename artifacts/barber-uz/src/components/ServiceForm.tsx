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

          {/* "+ Yangi" chip */}
          {showNewCat ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCat()}
                placeholder="Kategoriya nomi"
                className="h-8 w-28 px-3 rounded-full text-xs bg-white/5 border border-primary/40 focus:outline-none focus:border-primary/70 text-foreground"
              />
              <button
                onClick={handleCreateCat}
                disabled={catCreating || !newCatName.trim()}
                className="h-8 w-8 rounded-full bg-primary/15 border border-primary/30 text-primary flex items-center justify-center disabled:opacity-40"
              >
                {catCreating ? (
                  <span className="w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </button>
              <button
                onClick={() => { setShowNewCat(false); setNewCatName(""); }}
                className="h-8 w-8 rounded-full bg-white/5 border border-white/10 text-muted-foreground flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewCat(true)}
              className="h-8 px-3 rounded-full bg-white/5 border border-dashed border-white/15 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center gap-1 text-xs font-semibold"
            >
              <Plus className="w-3 h-3" />
              Yangi
            </button>
          )}
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
