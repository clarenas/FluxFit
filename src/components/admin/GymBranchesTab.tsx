import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { GymBranch } from '../../lib/types';
import { Plus, Trash2, MapPin } from 'lucide-react';

const inp = 'w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#CC0000]';

interface Props { gymId: string; branches: GymBranch[]; onRefresh: () => void; }

export function GymBranchesTab({ gymId, branches, onRefresh }: Props) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', comuna: '', phone: '' });

  const add = async () => {
    if (!form.name || !form.address) return;
    await supabase.from('gym_branches').insert({ gym_id: gymId, ...form });
    setForm({ name: '', address: '', comuna: '', phone: '' });
    setShow(false);
    onRefresh();
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar sucursal?')) return;
    await supabase.from('gym_branches').delete().eq('id', id);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {branches.length === 0 && !show && <p className="text-center py-8 text-[#999] text-sm">No hay sucursales registradas</p>}
      {branches.map(b => (
        <div key={b.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3">
          <div className="flex items-start justify-between">
            <div className="flex gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${b.is_active ? 'bg-[#CC0000]/10' : 'bg-[#F5F5F5]'}`}>
                <MapPin size={14} className={b.is_active ? 'text-[#CC0000]' : 'text-[#999]'} />
              </div>
              <div>
                <p className="font-bold text-sm text-[#111]">{b.name}</p>
                <p className="text-xs text-[#666]">{b.address}</p>
                {b.comuna && <p className="text-xs text-[#999]">{b.comuna}</p>}
                {b.phone && <p className="text-xs text-[#999]">{b.phone}</p>}
              </div>
            </div>
            <button onClick={() => del(b.id)} className="p-1.5"><Trash2 size={15} className="text-[#CC0000]" /></button>
          </div>
        </div>
      ))}
      {show ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
          <input placeholder="Nombre *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} />
          <input placeholder="Dirección *" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inp} />
          <input placeholder="Comuna" value={form.comuna} onChange={e => setForm(p => ({ ...p, comuna: e.target.value }))} className={inp} />
          <input placeholder="Teléfono" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inp} />
          <div className="flex gap-2">
            <button onClick={add} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button>
            <button onClick={() => setShow(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShow(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666] text-sm flex items-center justify-center gap-1">
          <Plus size={16} /> Agregar sucursal
        </button>
      )}
    </div>
  );
}
