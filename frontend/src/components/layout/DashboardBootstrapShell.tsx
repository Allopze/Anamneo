export function DashboardBootstrapShell() {
  return (
    <div className="min-h-screen bg-surface-base">
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden w-[252px] flex-shrink-0 p-4 lg:block">
          <div className="h-full rounded-shell bg-frame p-5">
            <div className="mb-8 h-10 w-32 rounded-card bg-white/10" />
            <div className="mb-6 flex items-center gap-3 rounded-card bg-white/10 p-3">
              <div className="h-10 w-10 rounded-full bg-white/15" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-white/15" />
                <div className="h-2.5 w-16 rounded bg-white/10" />
              </div>
            </div>
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="h-11 rounded-card bg-white/10" />
              ))}
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="px-3 pt-4 lg:px-6">
            <div className="h-14 rounded-card bg-surface-elevated shadow-soft">
              <div className="flex h-full items-center gap-3 px-4">
                <div className="h-8 w-8 rounded-full bg-surface-muted/50" />
                <div className="h-4 w-40 rounded bg-surface-muted/50" />
                <div className="ml-auto h-8 w-24 rounded bg-surface-muted/40" />
              </div>
            </div>
          </div>
          <main className="flex-1 px-3 py-6 lg:px-6">
            <div className="grid gap-3 md:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-28 rounded-card bg-surface-elevated shadow-soft" />
              ))}
            </div>
            <div className="mt-5 h-72 rounded-card bg-surface-elevated shadow-soft" />
          </main>
        </div>
      </div>
    </div>
  );
}
