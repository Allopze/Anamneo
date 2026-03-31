export default function Loading() {
  return (
    <div className="loading-shell">
      <div className="status-card max-w-sm">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        <p className="mt-4 text-sm text-ink-muted">Cargando aplicación...</p>
      </div>
    </div>
  );
}
