import Logo from '@/components/Logo';

/** Section 11.1 TV Boot: the logo bouncing while the household is created. */
export default function TvBoot() {
  return (
    <div className="cc-tv-root items-center justify-center">
      <Logo variant="tv" bouncing />
      <p
        className="font-body absolute bottom-[8vh] left-1/2 -translate-x-1/2"
        style={{ fontSize: '3vh', color: 'var(--ink-dim)' }}
      >
        Warming up the couch…
      </p>
    </div>
  );
}
