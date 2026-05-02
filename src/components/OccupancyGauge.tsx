import { getOccupancyColor, getOccupancyMessage } from '../lib/utils';
import type { OccupancyStatus } from '../lib/types';

interface Props {
  percentage: number;
  status: OccupancyStatus;
  peopleCount: number;
  sensorOnline: boolean;
  lastSensorPing: string | null;
  compact?: boolean;
}

export function OccupancyGauge({ percentage, status, peopleCount, sensorOnline, lastSensorPing, compact }: Props) {
  const color = getOccupancyColor(status);
  const message = getOccupancyMessage(status);
  const clampedPct = Math.min(Math.max(percentage, 0), 100);
  const radius = compact ? 60 : 80;
  const cx = compact ? 70 : 90;
  const cy = compact ? 70 : 90;
  const strokeWidth = compact ? 12 : 16;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy - radius * Math.sin(rad) };
  };

  const startAngle = 180;
  const endAngle = 180 - (clampedPct / 100) * 180;
  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const largeArc = clampedPct > 50 ? 1 : 0;
  const bgStart = polarToCartesian(180);
  const bgEnd = polarToCartesian(0);

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] border-t-[3px] p-4" style={{ borderTopColor: color }}>
      <h3 className="text-[#111111] font-bold text-base mb-3">¿Qué tan lleno está ahora?</h3>
      <div className="flex justify-center">
        <svg width={compact ? 140 : 180} height={compact ? 80 : 100} viewBox={`0 0 ${compact ? 140 : 180} ${compact ? 80 : 100}`}>
          <path d={`M ${bgStart.x} ${bgStart.y} A ${radius} ${radius} 0 0 1 ${bgEnd.x} ${bgEnd.y}`} fill="none" stroke="#E5E5E5" strokeWidth={strokeWidth} strokeLinecap="round" />
          {clampedPct > 0 && (
            <path d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" className="transition-all duration-500 ease-out" />
          )}
        </svg>
      </div>
      <div className="text-center -mt-2">
        <span className="text-3xl font-bold transition-colors duration-500" style={{ color }}>{Math.round(clampedPct)}%</span>
        <p className="text-[#666666] text-sm mt-1">{peopleCount} personas ahora mismo</p>
      </div>
      <div className="mt-3 text-center">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color }}>
          {status === 'tranquilo' && '🟢'}{status === 'moderado' && '🟡'}{status === 'lleno' && '🔴'}{message}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#666666]">
        {sensorOnline ? (
          <><span className="inline-block w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />Datos en tiempo real</>
        ) : (
          <><span className="inline-block w-2 h-2 rounded-full bg-gray-400" />Sin conexión — último dato {lastSensorPing ? new Date(lastSensorPing).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : 'desconocido'}</>
        )}
      </div>
    </div>
  );
}
