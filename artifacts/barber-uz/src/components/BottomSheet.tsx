import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useDragControls } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Slide-up sheet (~85% of the screen).
 * Closes with the ✕ button, a tap outside, the Escape key, or by dragging the handle/header down.
 */
export function BottomSheet({ title, onClose, children }: Props) {
  const dragControls = useDragControls();

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        data-testid="sheet-backdrop"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        data-testid="bottom-sheet"
        role="dialog"
        aria-label={title}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 600) onClose();
        }}
        className="relative w-full max-w-md bg-card rounded-t-3xl z-10 h-[85vh] max-h-[85vh] flex flex-col shadow-2xl"
      >
        {/* Drag handle + header: pull down to dismiss */}
        <div
          data-testid="sheet-drag-area"
          onPointerDown={(e) => dragControls.start(e)}
          className="shrink-0 cursor-grab touch-none select-none"
        >
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3" />
          <div className="flex items-center justify-between px-5 pt-3 pb-3">
            <h2 className="font-display font-bold text-lg text-foreground">{title}</h2>
            <button
              type="button"
              aria-label="Yopish"
              data-testid="sheet-close"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="h-px bg-white/6 mx-5 shrink-0" />

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 pb-12">{children}</div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
