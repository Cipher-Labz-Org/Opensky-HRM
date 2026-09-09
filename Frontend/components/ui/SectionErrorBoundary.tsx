"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
};

type State = { error: Error | null };

/**
 * Keeps the rest of the app shell usable when one tab/section throws
 * (common on live when a field is null that local seed data always has).
 */
export class SectionErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(this.props.title ? `${this.props.title} failed` : "Section failed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const label = this.props.title ?? "This section";
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
        <p className="font-medium">{label} could not be shown.</p>
        <p className="mt-1 text-amber-800">
          Other pages are still available. Refresh, or open a different tab, then try again.
        </p>
        <button
          type="button"
          className="mt-3 text-xs font-semibold text-[#256aa3] hover:underline"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
