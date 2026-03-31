export default function DashboardLoading() {
  return (
    <div className="animate-fade-in">
      <div className="loading-card">
        <div className="h-8 bg-surface-muted rounded w-48 mb-6 animate-pulse" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-surface-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
