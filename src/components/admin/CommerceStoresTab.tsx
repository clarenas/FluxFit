import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { CommerceStore } from '../../lib/types';
import { Plus, Trash2, MapPin } from 'lucide-react';

const inp = 'w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#CC0000]';

interface Props { commerceId: string; stores: CommerceStore[]; onRefresh: () => void; }

export function CommerceStoresTab({ commerceId, stores, onRefresh }: Props) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', comuna: '', schedule: '', phone: '' });

  const add = async () => {
    if (!form.name || !form.address) return;
    await supabase.from('commerce_stores').insert({ commerce_id: commerceId, ...form });
    setForm({ name: '', address: '', comuna: '', schedule: '', phone: '' });
    setShow(false);
    onRefresh();
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar tienda?')) return;
    await supabase.from('commerce_stores').delete().eq('id', id);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {stores.length === 0 && !show && <p className="text-center py-8 text-[#999] text-sm">No hay tiendas registradas</p>}
      {stores.map(s => (
        <div key={s.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3">
          <div className="flex items-start justify-between">
            <div className="flex gap-2">
              <div className="w-8 h-8 bg-[#F5F5F5] rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPin size={14} className="text-[#CC0000]" />
              </div>
              <div>
                <p className="font-bold text-sm text-[#111]">{s.name}</p>
                <p className="text-xs text-[#666]">{s.address}</p>
                {s.comuna && <p className="text-xs text-[#999]">{s.comuna}</p>}
                {s.schedule && <p className="text-xs text-[#999]">Horario: {s.schedule}</p>}
                {s.phone && <p className="text-xs text-[#999]">{s.phone}</p>}
              </div>
            </div>
            <button onClick={() => del(s.id)} className="p-1.5"><Trash2 size={15} className="text-[#CC0000]" /></button>
          </div>
        </div>
      ))}
      {show ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
          <input placeholder="Nombre *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} />
          <input placeholder="Dirección *" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className={inp} />
          <input placeholder="Comuna" value={form.comuna} onChange={e => setForm(p => ({ ...p, comuna: e.target.value }))} className={inp} />
          <input placeholder="Horario (ej: Lun-Vie 9-18)" value={form.schedule} onChange={e => setForm(p => ({ ...p, schedule: e.target.value }))} className={inp} />
          <input placeholder="Teléfono" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className={inp} />
          <div className="flex gap-2">
            <button onClick={add} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button>
            <button onClick={() => setShow(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShow(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666] text-sm flex items-center justify-center gap-1">
          <Plus size={16} /> Agregar tienda
        </button>
      )}
    </div>
  );
}
