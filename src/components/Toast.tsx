import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useSession } from '@/store/session';

const TONE_STYLE = {
  info: { bg: 'var(--bg-3)', color: 'var(--ink)' },
  error: { bg: 'rgba(255,77,77,.92)', color: '#14101F' },
  success: { bg: 'var(--ok)', color: '#14101F' },
} as const;

function ToneIcon({ tone }: { tone: keyof typeof TONE_STYLE }) {
  if (tone === 'error') return <AlertCircle size={22} />;
  if (tone === 'success') return <CheckCircle2 size={22} />;
  return <Info size={22} />;
}

/** Global toast stack, rendered once by both role roots. */
export default function Toast() {
  const toasts = useSession((s) => s.toasts);
  const dismiss = useSession((s) => s.dismissToast);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4"
      style={{ top: 'calc(env(safe-area-inset-top) + 68px)' }}
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            onClick={() => dismiss(t.id)}
            className="pointer-events-auto flex max-w-[92vw] items-center gap-3 rounded-3xl px-5 py-3 text-left"
            style={{
              background: TONE_STYLE[t.tone].bg,
              color: TONE_STYLE[t.tone].color,
              boxShadow: 'var(--shadow-soft)',
              fontSize: 16,
              fontWeight: 600,
            }}
            initial={{ opacity: 0, y: -16, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <ToneIcon tone={t.tone} />
            <span>{t.message}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
