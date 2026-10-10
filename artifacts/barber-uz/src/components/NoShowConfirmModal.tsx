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
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center px-4 pb-8 sm:pb-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={busy ? undefined : onCancel}
          />
          <motion.div
            data-testid="noshow-confirm"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-[#1a1a1f] p-5 shadow-2xl"
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
    </AnimatePresence>
  );
}
