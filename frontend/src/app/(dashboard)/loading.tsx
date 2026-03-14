export default function DashboardLoading() {
  return (
    <div className="animate-fade-in">
      <div className="h-8 bg-slate-200 rounded w-48 mb-6 animate-pulse" />
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
