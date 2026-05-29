export default function DashboardLoading() {
  return (
    <div className="animate-fade-in">
      <div className="loading-card">
        <div className="mb-6 space-y-2">
          <div className="skeleton h-5 w-44 rounded" />
          <div className="skeleton h-3 w-64 max-w-full rounded" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="skeleton h-24 rounded-lg" />
          <div className="skeleton h-24 rounded-lg" />
        </div>
        <div className="mt-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
