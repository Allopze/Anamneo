export function LoginFallback() {
  return (
    <div className="auth-shell auth-shell-login-compact" aria-busy="true">
      <aside className="auth-hero" aria-hidden="true">
        <div className="auth-hero-panel">
          <div className="auth-skeleton auth-skeleton-kicker" />
          <div className="auth-skeleton auth-skeleton-hero-title" />
          <div className="auth-skeleton auth-skeleton-hero-copy" />
        </div>
      </aside>

      <main className="auth-panel">
        <div
          className="auth-card auth-login-skeleton"
          role="status"
          aria-live="polite"
          aria-label="Preparando acceso"
        >
          <div className="auth-skeleton auth-skeleton-logo" />
          <div className="auth-skeleton auth-skeleton-card-kicker" />
          <div className="auth-skeleton auth-skeleton-card-title" />
          <div className="auth-skeleton auth-skeleton-card-copy" />
          <div className="auth-skeleton auth-skeleton-input" />
          <div className="auth-skeleton auth-skeleton-input" />
          <div className="auth-skeleton auth-skeleton-button" />
          <span className="sr-only">Preparando acceso…</span>
        </div>
      </main>
    </div>
  );
}
