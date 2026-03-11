import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: '#f8fafc',
            padding: 24,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: '100%',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 16,
              padding: 24,
              textAlign: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Something went wrong.</h2>
            <p style={{ color: '#6b7280' }}>
              The app hit an unexpected error. Reload to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid #111827',
                background: '#111827',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}