/**
 * ErrorBoundary - Catches React errors and displays a fallback UI
 *
 * Prevents the entire app from crashing when a component throws.
 * Each route is wrapped in its own ErrorBoundary so errors are contained.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/atoms/Button'
import { Typography } from '@/components/atoms/Typography'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-surface p-6 gap-4">
          <Typography variant="headline" className="text-center text-destructive">
            Algo salió mal
          </Typography>
          <Typography variant="body" className="text-center text-muted-foreground max-w-md">
            Ocurrió un error inesperado. Intentá recargar la página.
          </Typography>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs bg-surface-low p-3 rounded max-w-lg overflow-auto max-h-48 text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}
          <Button variant="primary" onClick={this.handleReset}>
            Recargar
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
