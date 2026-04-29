import { Heart } from 'lucide-react';
import type { Gym } from '../lib/types';
import { getOccupancyColor, getOccupancyLabel } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface Props { gym: Gym; isFavorite: boolean; onToggleFavorite: (gymId: string) => void; onClick: (gymId: string) => void; }

export function GymCard({ gym, isFavorite, onToggleFavorite, onClick }: Props) {
  const { user } = useAuth();
  const statusColor = gym.sensor_online ? getOccupancyColor(gym.occupancy_status) : '#999';
  const statusLabel = gym.sensor_online ? getOccupancyLabel(gym.occupancy_status) : 'Sin datos';
  const showFree = gym.sensor_online && gym.occupancy_status === 'tranquilo';

  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-[#E5E5E5] overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={() => onClick(gym.id)}>
      <div className="relative h-28 bg-gradient-to-br from-[#CC0000] to-[#111111]">
        {user !== null && (
          <button
            className="absolute top-2 left-2 z-10 w-7 h-7 flex items-center justify-center bg-black/20 rounded-full backdrop-blur-sm"
            onClick={e => { e.stopPropagation(); onToggleFavorite(gym.id); }}
          >
            <Heart size={14} className={isFavorite ? 'fill-[#CC0000] text-[#CC0000]' : 'text-white'} />
          </button>
        )}
        {showFree ? (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#16A34A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Ahora libre
          </div>
        ) : (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: statusColor }}>
            {statusLabel}
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-bold text-[#111111] text-sm leading-tight truncate">{gym.name}</h3>
        <p className="text-[#666666] text-xs mt-0.5">{gym.comuna}</p>
        {!gym.sensor_online && <p className="text-[#999] text-xs mt-1">Sin datos de ocupación</p>}
      </div>
    </div>
  );
}
