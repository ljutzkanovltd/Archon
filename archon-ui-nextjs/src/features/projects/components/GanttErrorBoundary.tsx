'use client';

import React, { Component, ReactNode } from 'react';
import { HiExclamationCircle } from 'react-icons/hi2';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class GanttErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GanttErrorBoundary] Gantt chart initialization failed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
          <HiExclamationCircle className="mb-4 h-16 w-16 text-red-500 dark:text-red-400" />
          <h3 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-100">
            Timeline Chart Error
          </h3>
          <p className="mb-4 max-w-md text-sm text-red-700 dark:text-red-300">
            The timeline chart encountered an error while rendering. This might be due to invalid data format or missing required fields.
          </p>
          {this.state.error && (
            <details className="mt-2 max-w-lg text-left">
              <summary className="cursor-pointer text-sm font-medium text-red-800 dark:text-red-200">
                Error Details
              </summary>
              <pre className="mt-2 overflow-auto rounded bg-red-100 p-2 text-xs text-red-900 dark:bg-red-900/40 dark:text-red-100">
                {this.state.error.message}
              </pre>
            </details>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
