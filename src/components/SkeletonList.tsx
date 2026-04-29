import { SkeletonCard } from './SkeletonCard';

export function SkeletonList() {
  return (
    <div className="grid grid-cols-2 gap-3 mt-3">
      {Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
