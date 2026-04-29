import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getCommerceCategoryEmoji, getCommerceCategoryLabel } from '../lib/utils';
import type { Commerce } from '../lib/types';

export function CommerceAdminPage() {
  const { user } = useAuth();
  const [commerce, setCommerce] = useState<Commerce | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: 'nutricion' as string, address: '', website: '', discount_percentage: '', discount_description: '', is_active: true });

  const fetchCommerce = useCallback(async () => {
    if (!user) return;
    const { data: adminData } = await supabase.from('commerce_admins').select('commerce_id').eq('user_id', user.id).maybeSingle();
    if (!adminData) return;
    const { data } = await supabase.from('commerces').select('*').eq('id', adminData.commerce_id).maybeSingle();
    if (data) { setCommerce(data); setForm({ name: data.name, description: data.description, category: data.category, address: data.address, website: data.website, discount_percentage: String(data.discount_percentage), discount_description: data.discount_description, is_active: data.is_active }); }
  }, [user]);

  useEffect(() => { fetchCommerce(); }, [fetchCommerce]);

  const saveChanges = async () => {
    if (!commerce) return;
    await supabase.from('commerces').update({ name: form.name, description: form.description, category: form.category, address: form.address, website: form.website, discount_percentage: parseInt(form.discount_percentage) || 0, discount_description: form.discount_description, is_active: form.is_active }).eq('id', commerce.id);
    setEditMode(false); fetchCommerce();
  };

  const toggleActive = async () => {
    if (!commerce) return;
    const newVal = !form.is_active;
    setForm(f => ({ ...f, is_active: newVal }));
    await supabase.from('commerces').update({ is_active: newVal }).eq('id', commerce.id);
    fetchCommerce();
  };

  if (!commerce) return <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center text-[#666]">Cargando panel de administración...</div>;

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-8">
      <div className="bg-[#111111] px-4 pt-8 pb-4"><p className="text-white/60 text-xs">FluxFit Admin</p><h1 className="text-white font-bold text-lg">{commerce.name}</h1></div>
      <div className="px-4 pt-4 space-y-4">
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <h3 className="text-xs text-[#666666] mb-2">Vista previa (como la ven los usuarios)</h3>
          <div className="flex items-center gap-3"><span className="text-2xl">{getCommerceCategoryEmoji(commerce.category)}</span><div className="flex-1"><p className="font-bold text-[#111111]">{commerce.name}</p><p className="text-xs text-[#666666]">{getCommerceCategoryLabel(commerce.category)}</p></div><span className="bg-[#CC0000] text-white text-xs font-bold px-2 py-0.5 rounded-full">−{commerce.discount_percentage}%</span></div>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-[#111111]">Comercio activo</span>
          <button onClick={toggleActive} className={`w-12 h-7 rounded-full transition-colors relative ${form.is_active ? 'bg-[#16A34A]' : 'bg-[#E5E5E5]'}`}><span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.is_active ? 'left-[22px]' : 'left-0.5'}`} /></button>
        </div>
        {editMode ? (
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 space-y-3">
            <div><label className="text-xs text-[#666666] mb-1 block">Nombre</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /></div>
            <div><label className="text-xs text-[#666666] mb-1 block">Categoría</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm"><option value="nutricion">Nutrición</option><option value="suplementos">Suplementos</option><option value="indumentaria">Indumentaria</option><option value="fisioterapia">Fisioterapia</option><option value="otro">Otro</option></select></div>
            <div><label className="text-xs text-[#666666] mb-1 block">Descripción</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" rows={3} /></div>
            <div><label className="text-xs text-[#666666] mb-1 block">Dirección</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /></div>
            <div><label className="text-xs text-[#666666] mb-1 block">Sitio web</label><input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /></div>
            <div><label className="text-xs text-[#666666] mb-1 block">% Descuento</label><input type="number" value={form.discount_percentage} onChange={e => setForm(f => ({ ...f, discount_percentage: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /></div>
            <div><label className="text-xs text-[#666666] mb-1 block">Descripción del descuento</label><input value={form.discount_description} onChange={e => setForm(f => ({ ...f, discount_description: e.target.value }))} className="w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm" /></div>
            <div className="flex gap-2"><button onClick={saveChanges} className="flex-1 py-2.5 bg-[#CC0000] text-white font-bold rounded-xl text-sm">Guardar</button><button onClick={() => setEditMode(false)} className="flex-1 py-2.5 border border-[#E5E5E5] rounded-xl text-sm">Cancelar</button></div>
          </div>
        ) : <button onClick={() => setEditMode(true)} className="w-full py-3 bg-[#111111] text-white font-bold rounded-xl text-sm active:scale-[0.98] transition-transform">Editar información</button>}
      </div>
    </div>
  );
}
