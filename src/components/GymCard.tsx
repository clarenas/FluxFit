import { Heart } from 'lucide-react';
import type { Gym } from '../lib/types';
import { getOccupancyColor, getOccupancyLabel } from '../lib/utils';

interface Props { gym: Gym; isFavorite: boolean; onToggleFavorite: (gymId: string) => void; onClick: (gymId: string) => void; }

export function GymCard({ gym, isFavorite, onToggleFavorite, onClick }: Props) {
  const statusColor = gym.sensor_online ? getOccupancyColor(gym.occupancy_status) : '#999';
  const statusLabel = gym.sensor_online ? getOccupancyLabel(gym.occupancy_status) : 'Sin datos';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E5E5E5] overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={() => onClick(gym.id)}>
      <div className="relative h-28 bg-gradient-to-br from-[#CC0000] to-[#111111]">
        <button className="absolute top-2 left-2 z-10 min-w-[32px] min-h-[32px] flex items-center justify-center" onClick={e => { e.stopPropagation(); onToggleFavorite(gym.id); }}>
          <Heart size={20} className={isFavorite ? 'text-[#CC0000] fill-[#CC0000]' : 'text-white/80'} />
        </button>
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: statusColor }}>{statusLabel}</div>
      </div>
      <div className="p-3">
        <h3 className="font-bold text-[#111111] text-sm leading-tight truncate">{gym.name}</h3>
        <p className="text-[#666666] text-xs mt-0.5">{gym.comuna}</p>
      </div>
    </div>
  );
}
