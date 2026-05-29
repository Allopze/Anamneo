export default function Loading() {
  return (
    <div className="loading-shell">
      <div className="status-card status-card-quiet max-w-md text-left">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-surface-muted/80" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton h-2.5 w-40" />
          </div>
        </div>
        <div className="space-y-3" aria-label="Cargando aplicación">
          <div className="skeleton h-10 w-full rounded-lg" />
          <div className="skeleton h-10 w-11/12 rounded-lg" />
          <div className="skeleton h-10 w-4/5 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
