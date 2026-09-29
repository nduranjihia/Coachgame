import { useEffect, useState } from 'react';
import Button from '@/components/Button';

export interface TvTroubleProps {
  message: string;
  onRetry: () => void;
}

/**
 * The TV's dead end, made visible. Section 6.2 used to leave a failed
 * `create_tv_household` sitting on the boot logo forever, with no message and
 * no way forward - indistinguishable from a crashed app on a television.
 */
export default function TvTrouble({ message, onRetry }: TvTroubleProps) {
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!waiting) return undefined;
    const timer = window.setTimeout(onRetry, 4000);
    return () => window.clearTimeout(timer);
  }, [onRetry, waiting]);

  return (
    <div className="cc-tv-root flex-col items-center justify-center gap-[3vh] text-center">
      <h1 className="font-display" style={{ fontSize: '6vh', color: 'var(--ink)' }}>
        {waiting ? 'One more go…' : 'We could not start'}
      </h1>
      <p className="font-body" style={{ fontSize: '3vh', color: 'var(--ink-dim)', maxWidth: '70ch' }}>
        {message}
      </p>
      <p className="font-body" style={{ fontSize: '2.4vh', color: 'var(--ink-dim)' }}>
        This usually means the connection dropped. We retry on our own.
      </p>
      <Button
        onClick={() => {
          setWaiting(true);
          onRetry();
        }}
        disabled={waiting}
      >
        {waiting ? 'Retrying…' : 'Try again'}
      </Button>
    </div>
  );
}
