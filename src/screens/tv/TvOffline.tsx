import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

/** Section 11.1 screen 6: dim the screen and wait. Retries happen on their own. */
export default function TvOffline() {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-[2.4vh]"
      style={{ background: 'rgba(20,16,31,.9)', backdropFilter: 'blur(4px)' }}
      role="status"
      aria-live="polite"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        className="flex"
      >
        <Loader2 size="9vh" style={{ color: 'var(--ink-dim)' }} />
      </motion.div>
      <h1 className="font-display" style={{ fontSize: '7vh', color: 'var(--ink)' }}>
        Reconnecting…
      </h1>
    </div>
  );
}
