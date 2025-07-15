'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryState>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to monitoring service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return <FallbackComponent {...this.state} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({ error, errorInfo }: ErrorBoundaryState) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full border border-gray-700">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          
          <h1 className="text-2xl font-mtg text-white mb-4">
            Something went wrong
          </h1>
          
          <p className="text-gray-400 mb-6 font-mtg-body">
            We encountered an unexpected error. Please try refreshing the page.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-mtg-blue hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Refresh Page
            </button>
            
            <button
              onClick={() => (window.location.href = '/')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Go Home
            </button>
          </div>
          
          {isDevelopment && error && (
            <details className="mt-6 text-left">
              <summary className="text-gray-400 cursor-pointer mb-2">
                Error Details (Development)
              </summary>
              <div className="bg-gray-900 rounded-lg p-4 text-sm font-mono">
                <div className="text-red-400 mb-2">
                  {error.name}: {error.message}
                </div>
                <pre className="text-gray-400 whitespace-pre-wrap text-xs">
                  {error.stack}
                </pre>
                {errorInfo && (
                  <pre className="text-gray-500 whitespace-pre-wrap text-xs mt-4">
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook for error handling in functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    console.error('useErrorHandler:', error, errorInfo);
    
    // In a real app, you might want to send this to a monitoring service
    // like Sentry, LogRocket, etc.
  };
}

export default ErrorBoundary;
