import { CircleAlert, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * One bad field from the API must never blank the whole app.
 *
 * React unmounts the entire tree when a render throws, so without a boundary a single
 * malformed block — a matrix with no rows, a null date — turns the screen white and the
 * demo is over. Each boundary keeps the failure to its own card and says what broke.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: (reset: () => void, error: Error) => ReactNode; label?: string; onError?: (error: Error) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The browser console is where we debug a contract mismatch during integration.
    console.error(`[${this.props.label ?? 'ui'}] render failed`, error, info.componentStack);
    this.props.onError?.(error);
  }

  private reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.reset, error);
    return <ErrorCard label={this.props.label} error={error} onRetry={this.reset} />;
  }
}

/** The visible stand-in for whatever could not be drawn. */
export function ErrorCard({ label, error, onRetry }: { label?: string; error: Error; onRetry?: () => void }) {
  return (
    <section className="card border-warn/45 bg-[color-mix(in_srgb,var(--warn)_6%,var(--surface))] px-4 py-3.5" role="alert">
      <div className="flex items-start gap-2.5">
        <CircleAlert size={18} className="mt-0.5 flex-none text-warn" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="display text-[14.5px] font-bold">{label ? `${label} could not be shown` : 'This part could not be shown'}</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            The rest of your page is fine. This is a display problem, not something wrong with your application.
          </p>
          <p className="mt-1.5 font-mono text-[12px] text-muted">{error.message}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] font-semibold transition-colors hover:border-ink"
            >
              <RotateCcw size={14} aria-hidden />
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
