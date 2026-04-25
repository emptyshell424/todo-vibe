'use client';

import { useEffect } from 'react';

function describeUnknownError(value: unknown) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (value instanceof Event) {
    const target = value.target;
    return {
      type: value.type,
      constructor: value.constructor.name,
      target:
        target instanceof HTMLElement
          ? {
              tagName: target.tagName,
              id: target.id,
              className: target.className,
            }
          : String(target),
    };
  }

  return {
    type: typeof value,
    value: String(value),
  };
}

export default function ClientErrorDiagnostics() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const handleError = (event: ErrorEvent) => {
      console.error('[Client error diagnostics]', describeUnknownError(event.error ?? event));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[Unhandled rejection diagnostics]', describeUnknownError(event.reason));
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
