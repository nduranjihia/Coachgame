import { motion } from 'framer-motion';
import { APP_NAME, TAGLINE } from '@/lib/constants';

export interface LogoProps {
  /** `tv` renders the 14vh display logo, `phone` a 32px lockup. */
  variant?: 'tv' | 'phone';
  showTagline?: boolean;
  bouncing?: boolean;
}

/** The wordmark. The name itself always comes from `APP_NAME`. */
export default function Logo({ variant = 'phone', showTagline = true, bouncing = false }: LogoProps) {
  const size = variant === 'tv' ? '14vh' : '40px';
  return (
    <div className="flex flex-col items-center">
      <motion.div
        animate={bouncing ? { y: [0, -10, 0] } : undefined}
        transition={bouncing ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        <span
          className="font-display"
          style={{
            fontSize: size,
            lineHeight: 1,
            color: 'var(--sun)',
            textShadow: '0 .06em 0 var(--coral), 0 .1em 0 rgba(0,0,0,.35)',
            letterSpacing: '0.01em',
          }}
        >
          {APP_NAME}
        </span>
      </motion.div>
      {showTagline ? (
        <span
          className="font-body"
          style={{
            fontSize: variant === 'tv' ? '2.8vh' : '15px',
            color: 'var(--ink-dim)',
            marginTop: variant === 'tv' ? '1.2vh' : '4px',
          }}
        >
          {TAGLINE}
        </span>
      ) : null}
    </div>
  );
}
