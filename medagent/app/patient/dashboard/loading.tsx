export default function DashboardLoading() {
  return (
    <main className="min-h-[calc(100vh-3.5rem)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-6 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded bg-slate-200" />
            <div className="h-4 w-64 rounded bg-slate-100" />
          </div>
          <div className="h-4 w-16 rounded bg-slate-100" />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-3 shadow-sm sm:p-4">
              <div className="h-3 w-24 rounded bg-slate-100" />
              <div className="mt-2 h-8 w-16 rounded bg-slate-200" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3">
              <div className="h-4 w-36 rounded bg-slate-200" />
            </div>
            <div className="divide-y">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-4">
                  <div className="space-y-2">
                    <div className="h-4 w-48 rounded bg-slate-200" />
                    <div className="h-3 w-72 rounded bg-slate-100" />
                    <div className="h-3 w-40 rounded bg-slate-100" />
                  </div>
                  <div className="h-6 w-28 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="mt-2 h-3 w-full rounded bg-slate-100" />
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="h-4 w-20 rounded bg-slate-200" />
              <div className="mt-4 h-48 w-48 rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
