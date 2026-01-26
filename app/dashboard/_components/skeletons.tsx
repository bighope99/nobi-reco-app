export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm animate-pulse">
          <div className="h-3 w-24 bg-gray-200 rounded mb-2"></div>
          <div className="h-8 w-16 bg-gray-200 rounded"></div>
        </div>
      ))}
    </div>
  );
}

export function AlertSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 w-48 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AttendanceListSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
      </div>
      <div className="divide-y divide-gray-100">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
                <div className="h-3 w-16 bg-gray-200 rounded"></div>
              </div>
              <div className="h-6 w-16 bg-gray-200 rounded"></div>
              <div className="h-8 w-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecordSupportSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-5 py-4 border-b border-gray-100 bg-indigo-50/30">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
      </div>
      <div className="p-2 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-4 w-20 bg-gray-200 rounded mb-1"></div>
                <div className="h-3 w-16 bg-gray-200 rounded"></div>
              </div>
              <div className="h-4 w-4 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FullPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-slate-600">読み込み中...</p>
      </div>
    </div>
  );
}
