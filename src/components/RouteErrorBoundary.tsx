import { Component, type ReactNode } from "react";
import { isRecoverableDynamicImportError, reloadForFreshAssets } from "@/lib/lazyWithRetry";

interface Props {
  children: ReactNode;
  /** Changing this value resets the boundary (e.g. the current pathname). */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches errors thrown while a route renders — most commonly a failed dynamic
 * chunk import after a new deploy, which otherwise leaves a blank white page
 * until the user manually refreshes.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error) {
    console.error("Route render failed:", error);
    if (isRecoverableDynamicImportError(error)) {
      // Stale cached bundle — pull fresh assets automatically.
      reloadForFreshAssets("__route_chunk_reloaded_at");
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-lg font-bold text-foreground">This page didn't load</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            Something went wrong loading this page. Reloading usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
