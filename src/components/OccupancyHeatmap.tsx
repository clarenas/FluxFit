import { useMemo } from 'react';
import { getDayLabel, getOccupancyColor } from '../lib/utils';
import type { WeeklyOccupancySummary } from '../lib/types';

interface Props { data: WeeklyOccupancySummary[]; }

export function OccupancyHeatmap({ data }: Props) {
  const days = [1, 2, 3, 4, 5, 6, 0];
  const hours = Array.from({ length: 17 }, (_, i) => i + 6);

  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of data) {
      map.set(`${entry.day_of_week}-${entry.hour_of_day}`, getOccupancyColor(entry.avg_status));
    }
    return map;
  }, [data]);

  const getCellColor = (day: number, hour: number): string =>
    colorMap.get(`${day}-${hour}`) ?? '#E5E5E5';

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
      <h3 className="text-[#111111] font-bold text-base mb-1">¿Cuándo suele estar más tranquilo?</h3>
      <p className="text-[#666666] text-xs mb-3">Últimas semanas</p>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: `36px repeat(7, 1fr)` }}>
          <div />
          {days.map(d => <div key={d} className="text-[10px] text-[#666666] text-center pb-1">{getDayLabel(d)}</div>)}
          {hours.map(hour => (
            <div key={hour} className="contents">
              <div className="text-[10px] text-[#666666] pr-1 flex items-center justify-end">{hour.toString().padStart(2, '0')}:00</div>
              {days.map(day => (
                <div key={`${day}-${hour}`} className="w-full aspect-square rounded-[2px] min-w-[14px] min-h-[14px]" style={{ backgroundColor: getCellColor(day, hour) }} title={`${getDayLabel(day)} ${hour}:00`} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-[#666666]">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[2px] bg-[#16A34A]" /> Tranquilo</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[2px] bg-[#EAB308]" /> Moderado</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-[2px] bg-[#CC0000]" /> Lleno</span>
      </div>
      <p className="text-[10px] text-[#999999] mt-2">Estimación basada en historial. Puede variar.</p>
    </div>
  );
}
