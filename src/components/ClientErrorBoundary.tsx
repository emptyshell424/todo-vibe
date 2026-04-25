'use client';

import React from 'react';

type ClientErrorBoundaryState = {
  error: unknown;
  info: React.ErrorInfo | null;
};

function formatUnknownError(value: unknown) {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}\n${value.stack ?? ''}`.trim();
  }

  if (typeof Event !== 'undefined' && value instanceof Event) {
    const target = value.target;
    const targetLabel =
      target instanceof HTMLElement
        ? `${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}`
        : String(target);

    return `Non-Error Event thrown: type=${value.type}, constructor=${value.constructor.name}, target=${targetLabel}`;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default class ClientErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ClientErrorBoundaryState
> {
  state: ClientErrorBoundaryState = {
    error: null,
    info: null,
  };

  static getDerivedStateFromError(error: unknown) {
    return { error, info: null };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[React error boundary]', formatUnknownError(error), info.componentStack);
    this.setState({ error, info });
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h1>Client render failed</h1>
          <p>The app caught a client-side render error. Check the details below before continuing.</p>
          <pre style={{ whiteSpace: 'pre-wrap', padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
            {formatUnknownError(this.state.error)}
            {this.state.info?.componentStack ? `\n\nComponent stack:${this.state.info.componentStack}` : ''}
          </pre>
        </main>
      );
    }

    return this.props.children;
  }
}
