export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden animate-pulse">
      <div className="h-24 bg-[#E5E5E5] w-full" />
      <div className="p-3">
        <div className="h-3 bg-[#E5E5E5] rounded w-3/4 mb-2" />
        <div className="h-3 bg-[#E5E5E5] rounded w-1/2" />
      </div>
    </div>
  );
}
