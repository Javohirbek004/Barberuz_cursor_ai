import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export function NoShowConfirmModal({
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-5">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80"
            onClick={busy ? undefined : onCancel}
          />
          <motion.div
            data-testid="noshow-confirm"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="relative z-10 w-full max-w-sm rounded-3xl border border-white/15 bg-[#2a2a32] p-5 shadow-2xl"
          >
            <p className="text-[15px] font-semibold text-foreground leading-snug">
              Mijoz salonga kelmadi deb belgilashni tasdiqlaysizmi?
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Bu bron daromadga qoʻshilmaydi.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                type="button"
                data-testid="noshow-back"
                disabled={busy}
                onClick={onCancel}
                className="h-10 rounded-xl bg-white/8 border border-white/10 text-sm font-semibold text-foreground disabled:opacity-40"
              >
                Orqaga
              </button>
              <button
                type="button"
                data-testid="noshow-confirm-yes"
                disabled={busy}
                onClick={onConfirm}
                className="h-10 rounded-xl bg-red-500/15 border border-red-500/30 text-sm font-semibold text-red-300 disabled:opacity-40"
              >
                {busy ? "..." : "Ha, tasdiqlash"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
