import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { GymPromotion } from '../../lib/types';
import { Plus, Trash2, Tag } from 'lucide-react';

const inp = 'w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#CC0000]';

interface Props { gymId: string; promotions: GymPromotion[]; onRefresh: () => void; }

export function GymPromotionsTab({ gymId, promotions, onRefresh }: Props) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', discount_percentage: '', starts_at: '', ends_at: '' });

  const add = async () => {
    if (!form.name) return;
    await supabase.from('gym_promotions').insert({
      gym_id: gymId,
      name: form.name,
      description: form.description,
      discount_percentage: parseInt(form.discount_percentage) || 0,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    });
    setForm({ name: '', description: '', discount_percentage: '', starts_at: '', ends_at: '' });
    setShow(false);
    onRefresh();
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar promoción?')) return;
    await supabase.from('gym_promotions').delete().eq('id', id);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {promotions.length === 0 && !show && <p className="text-center py-8 text-[#999] text-sm">No hay promociones creadas</p>}
      {promotions.map(p => (
        <div key={p.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3">
          <div className="flex items-start justify-between">
            <div className="flex gap-2 flex-1">
              <div className="w-8 h-8 bg-[#CC0000]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <Tag size={14} className="text-[#CC0000]" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm text-[#111]">{p.name}</p>
                  <span className="bg-[#CC0000] text-white text-xs font-bold px-2 py-0.5 rounded-full ml-2">−{p.discount_percentage}%</span>
                </div>
                {p.description && <p className="text-xs text-[#666] mt-0.5">{p.description}</p>}
                {(p.starts_at || p.ends_at) && (
                  <p className="text-xs text-[#999] mt-1">
                    {p.starts_at && `Desde ${new Date(p.starts_at).toLocaleDateString('es-CL')}`}
                    {p.starts_at && p.ends_at && ' · '}
                    {p.ends_at && `Hasta ${new Date(p.ends_at).toLocaleDateString('es-CL')}`}
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => del(p.id)} className="p-1.5 ml-2"><Trash2 size={15} className="text-[#CC0000]" /></button>
          </div>
        </div>
      ))}
      {show ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
          <input placeholder="Nombre *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} />
          <input placeholder="Descripción" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inp} />
          <input placeholder="% descuento" type="number" value={form.discount_percentage} onChange={e => setForm(p => ({ ...p, discount_percentage: e.target.value }))} className={inp} />
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-[#666] mb-1 block">Inicio</label><input type="date" value={form.starts_at} onChange={e => setForm(p => ({ ...p, starts_at: e.target.value }))} className={inp} /></div>
            <div><label className="text-[10px] text-[#666] mb-1 block">Fin</label><input type="date" value={form.ends_at} onChange={e => setForm(p => ({ ...p, ends_at: e.target.value }))} className={inp} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={add} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button>
            <button onClick={() => setShow(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShow(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666] text-sm flex items-center justify-center gap-1">
          <Plus size={16} /> Agregar promoción
        </button>
      )}
    </div>
  );
}
