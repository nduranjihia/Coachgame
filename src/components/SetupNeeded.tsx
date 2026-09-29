import Button from './Button';
import Logo from './Logo';

/**
 * Shown when the Supabase project is missing env vars or anonymous sign-ins are
 * disabled. Never shows a raw error - just the one thing the person must do.
 */
export default function SetupNeeded() {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: 'var(--glow), var(--bg-0)' }}
    >
      <Logo showTagline={false} />
      <h1 className="font-display" style={{ fontSize: 30, color: 'var(--sun)' }}>
        One quick setup step
      </h1>
      <p className="font-body max-w-[520px] text-[17px] leading-relaxed" style={{ color: 'var(--ink-dim)' }}>
        Turn on <strong style={{ color: 'var(--ink)' }}>Anonymous sign-ins</strong> in your Supabase
        dashboard (Authentication &rarr; Sign In / Providers), then reload this page.
      </p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  );
}
