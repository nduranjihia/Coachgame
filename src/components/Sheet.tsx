import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** `true` for destructive confirmations - tints the header and the handle. */
  danger?: boolean;
}

/** Bottom sheet used for every phone choice and confirmation. */
export default function Sheet({ open, onClose, title, children, danger = false }: SheetProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(10,7,18,.6)' }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-[560px] overflow-hidden"
            style={{
              background: 'var(--bg-2)',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              border: '1px solid var(--line)',
              borderBottom: 'none',
              boxShadow: 'var(--shadow-soft)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
          >
            <div className="flex justify-center pt-3" aria-hidden="true">
              <div
                style={{
                  width: 48,
                  height: 5,
                  borderRadius: 999,
                  background: danger ? 'var(--danger)' : 'var(--line)',
                }}
              />
            </div>
            {title ? (
              <h2
                className="font-display px-6 pt-3 text-center"
                style={{ fontSize: 24, color: danger ? 'var(--danger)' : 'var(--ink)' }}
              >
                {title}
              </h2>
            ) : null}
            <div className="px-5 pb-5 pt-3">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
