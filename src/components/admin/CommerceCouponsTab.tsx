import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { CommerceCoupon } from '../../lib/types';
import { Plus, Trash2, Ticket } from 'lucide-react';

const inp = 'w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#CC0000]';

interface Props { commerceId: string; coupons: CommerceCoupon[]; onRefresh: () => void; }

export function CommerceCouponsTab({ commerceId, coupons, onRefresh }: Props) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', discount_percentage: '', max_uses: '100', expires_at: '' });

  const add = async () => {
    if (!form.code) return;
    await supabase.from('commerce_coupons').insert({ commerce_id: commerceId, code: form.code.toUpperCase(), description: form.description, discount_percentage: parseInt(form.discount_percentage) || 0, max_uses: parseInt(form.max_uses) || 100, expires_at: form.expires_at || null });
    setForm({ code: '', description: '', discount_percentage: '', max_uses: '100', expires_at: '' });
    setShow(false);
    onRefresh();
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar cupón?')) return;
    await supabase.from('commerce_coupons').delete().eq('id', id);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {coupons.length === 0 && !show && <p className="text-center py-8 text-[#999] text-sm">No hay cupones creados</p>}
      {coupons.map(c => (
        <div key={c.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3">
          <div className="flex items-start justify-between">
            <div className="flex gap-2 flex-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.is_active ? 'bg-[#CC0000]/10' : 'bg-[#F5F5F5]'}`}>
                <Ticket size={14} className={c.is_active ? 'text-[#CC0000]' : 'text-[#999]'} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <code className="font-bold text-sm text-[#111] bg-[#F5F5F5] px-2 py-0.5 rounded">{c.code}</code>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${c.is_active ? 'bg-[#CC0000] text-white' : 'bg-[#E5E5E5] text-[#999]'}`}>−{c.discount_percentage}%</span>
                </div>
                {c.description && <p className="text-xs text-[#666] mt-0.5">{c.description}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-xs text-[#999]">{c.current_uses}/{c.max_uses} usos</p>
                  {c.expires_at && <p className="text-xs text-[#999]">Vence: {new Date(c.expires_at).toLocaleDateString('es-CL')}</p>}
                </div>
              </div>
            </div>
            <button onClick={() => del(c.id)} className="p-1.5 ml-2"><Trash2 size={15} className="text-[#CC0000]" /></button>
          </div>
        </div>
      ))}
      {show ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
          <input placeholder="Código * (ej: FLASH20)" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} className={inp} />
          <input placeholder="Descripción" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inp} />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="% descuento" type="number" value={form.discount_percentage} onChange={e => setForm(p => ({ ...p, discount_percentage: e.target.value }))} className={inp} />
            <input placeholder="Max usos" type="number" value={form.max_uses} onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))} className={inp} />
          </div>
          <div><label className="text-[10px] text-[#666] mb-1 block">Fecha de expiración</label><input type="date" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} className={inp} /></div>
          <div className="flex gap-2">
            <button onClick={add} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Crear cupón</button>
            <button onClick={() => setShow(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShow(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666] text-sm flex items-center justify-center gap-1">
          <Plus size={16} /> Crear cupón
        </button>
      )}
    </div>
  );
}
