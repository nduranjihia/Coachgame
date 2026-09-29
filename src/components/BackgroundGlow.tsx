/** The warm living-room glow that sits behind every screen. */
export default function BackgroundGlow() {
  return (
    <div
      aria-hidden="true"
      className="cc-bg-drift pointer-events-none fixed inset-0 -z-10"
      style={{
        background:
          'radial-gradient(60vmax 60vmax at 15% -10%, rgba(255,200,87,.16), transparent 60%),' +
          'radial-gradient(50vmax 50vmax at 100% 110%, rgba(167,139,250,.18), transparent 60%),' +
          'var(--bg-0)',
      }}
    />
  );
}
