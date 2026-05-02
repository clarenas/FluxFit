import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCLP } from '../../lib/utils';
import type { CommerceProduct } from '../../lib/types';
import { Plus, Trash2, Package } from 'lucide-react';

const inp = 'w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#CC0000]';

interface Props { commerceId: string; products: CommerceProduct[]; onRefresh: () => void; }

export function CommerceProductsTab({ commerceId, products, onRefresh }: Props) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', image_url: '' });

  const add = async () => {
    if (!form.name) return;
    await supabase.from('commerce_products').insert({ commerce_id: commerceId, name: form.name, description: form.description, price: parseInt(form.price) || 0, image_url: form.image_url });
    setForm({ name: '', description: '', price: '', image_url: '' });
    setShow(false);
    onRefresh();
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar producto?')) return;
    await supabase.from('commerce_products').delete().eq('id', id);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {products.length === 0 && !show && <p className="text-center py-8 text-[#999] text-sm">No hay productos registrados</p>}
      {products.map(p => (
        <div key={p.id} className="bg-white rounded-xl border border-[#E5E5E5] p-3">
          <div className="flex items-start gap-3">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-12 h-12 bg-[#F5F5F5] rounded-lg flex items-center justify-center flex-shrink-0"><Package size={18} className="text-[#CCC]" /></div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-sm text-[#111]">{p.name}</p>
                  {p.description && <p className="text-xs text-[#666] mt-0.5 line-clamp-2">{p.description}</p>}
                </div>
                <button onClick={() => del(p.id)} className="p-1 ml-2 flex-shrink-0"><Trash2 size={15} className="text-[#CC0000]" /></button>
              </div>
              <p className="font-bold text-[#CC0000] text-sm mt-1">{formatCLP(p.price)}</p>
            </div>
          </div>
        </div>
      ))}
      {show ? (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-2">
          <input placeholder="Nombre *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inp} />
          <input placeholder="Descripción" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className={inp} />
          <input placeholder="Precio" type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className={inp} />
          <input placeholder="URL de imagen (opcional)" value={form.image_url} onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))} className={inp} />
          <div className="flex gap-2">
            <button onClick={add} className="flex-1 py-2 bg-[#CC0000] text-white font-bold rounded-lg text-sm">Guardar</button>
            <button onClick={() => setShow(false)} className="flex-1 py-2 border border-[#E5E5E5] rounded-lg text-sm">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShow(true)} className="w-full py-2 border-2 border-dashed border-[#E5E5E5] rounded-xl text-[#666] text-sm flex items-center justify-center gap-1">
          <Plus size={16} /> Agregar producto
        </button>
      )}
    </div>
  );
}
