import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert } from 'pingly';

interface Props {
  children: ReactNode;
  /** Changing this clears a caught error (e.g. on navigation). */
  resetKey?: unknown;
  onReset?: () => void;
}

interface State {
  error: Error | null;
  resetKey?: unknown;
}

/** Keeps one broken page from taking down the whole playground. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Playground page crashed', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <Alert
        variant="error"
        title="This page crashed"
        actions={
          <button
            className="pingly-button"
            onClick={() => {
              this.props.onReset?.();
              this.setState({ error: null });
            }}
          >
            Try again
          </button>
        }
      >
        {this.state.error.message}
      </Alert>
    );
  }
}

/** Throws while `crash` is true, to show the error boundary in action. */
export function CrashTrigger({ crash }: { crash: boolean }) {
  if (crash) throw new Error('Simulated render error from the Chaos panel.');
  return null;
}
