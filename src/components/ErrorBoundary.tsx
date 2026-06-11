import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { showError } from '@/utils/toast';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Show toast notification
    showError('Ein Fehler ist aufgetreten');

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error reporting service (would integrate with Sentry, etc.)
    this.logErrorToService(error, errorInfo);
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // In production, you would send this to an error tracking service
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Store in localStorage for debugging
    try {
      const errorLog = JSON.parse(localStorage.getItem('error_log') || '[]');
      errorLog.push(errorData);
      // Keep only last 10 errors
      if (errorLog.length > 10) {
        errorLog.shift();
      }
      localStorage.setItem('error_log', JSON.stringify(errorLog));
    } catch (e) {
      console.error('[ErrorBoundary] Failed to log error:', e);
    }
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-red-500/10">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">Etwas ist schiefgelaufen</CardTitle>
                  <CardDescription className="mt-1">
                    Ein unerwarteter Fehler ist aufgetreten
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error Details (in development) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="p-4 rounded-lg bg-muted/40 border">
                  <p className="text-sm font-semibold text-red-500 mb-2">Fehlerdetails:</p>
                  <p className="text-xs font-mono text-muted-foreground break-words">
                    {this.state.error.message}
                  </p>
                  {this.state.error.stack && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Stack trace
                      </summary>
                      <pre className="text-xs font-mono text-muted-foreground mt-2 whitespace-pre-wrap overflow-auto max-h-40">
                        {this.state.error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* User-friendly message */}
              <p className="text-sm text-muted-foreground">
                Die Anwendung konnte diese Anfrage nicht verarbeiten. Bitte versuche es erneut 
                oder lade die Seite neu.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={this.handleReset}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Erneut versuchen
                </Button>
                <Button 
                  onClick={this.handleReload}
                  className="flex-1"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Seite neu laden
                </Button>
              </div>
              
              <Button 
                onClick={this.handleGoHome}
                variant="ghost"
                className="w-full"
              >
                <Home className="mr-2 h-4 w-4" />
                Zur Startseite
              </Button>

              {/* Error Log Access (development only) */}
              {process.env.NODE_ENV === 'development' && (
                <div className="pt-4 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const log = localStorage.getItem('error_log');
                      if (log) {
                        console.log('Error Log:', JSON.parse(log));
                      }
                    }}
                    className="text-xs text-muted-foreground"
                  >
                    Fehler-Log in Konsole anzeigen
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional component wrapper for easier usage
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler() {
  const handleError = (error: Error) => {
    console.error('[useErrorHandler]', error);
    showError(error.message || 'Ein Fehler ist aufgetreten');
    
    // Store error in localStorage for debugging
    try {
      const errorLog = JSON.parse(localStorage.getItem('error_log') || '[]');
      errorLog.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('error_log', JSON.stringify(errorLog.slice(-10)));
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  };

  return { handleError };
}
