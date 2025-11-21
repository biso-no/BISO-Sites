export default function Loading() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Header Skeleton */}
      <div className="relative h-[30vh] bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90 animate-pulse" />

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-xl p-8 animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-6" />
          <div className="space-y-4">
            <div className="h-12 bg-gray-200 rounded" />
            <div className="h-12 bg-gray-200 rounded" />
            <div className="h-12 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

