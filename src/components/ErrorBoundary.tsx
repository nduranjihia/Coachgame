import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered instead of the default panel, if provided. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Without this, any throw during render or in an effect unmounts the whole
 * tree and leaves the bare `body` background on screen - which, on a dark
 * themed app, is indistinguishable from a black television. A crash must always
 * be a message with a way out, never a blank screen.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[couch-clash] render crashed', error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return <CrashScreen error={error} onRetry={this.reset} />;
  }
}

function CrashScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: 'var(--bg-0)', color: 'var(--ink)' }}
    >
      <h1 className="font-display" style={{ fontSize: 28 }}>
        Something broke
      </h1>
      <p className="font-body" style={{ fontSize: 15, color: 'var(--ink-dim)', maxWidth: '46ch' }}>
        This is a bug in the app, not something you did.
      </p>
      <pre
        className="font-body max-w-full overflow-auto rounded-lg p-3 text-left"
        style={{ fontSize: 12, color: 'var(--ink-dim)', background: 'var(--bg-2)', maxWidth: '60ch' }}
      >
        {error.message}
      </pre>
      <button
        type="button"
        onClick={onRetry}
        className="font-body"
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--bg-0)',
          background: 'var(--sun)',
          border: 0,
          borderRadius: 'var(--radius-sm)',
          padding: '10px 20px',
        }}
      >
        Try again
      </button>
    </div>
  );
}
