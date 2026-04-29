import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getCommerceCategoryEmoji, getCommerceCategoryLabel } from '../lib/utils';
import type { Commerce, CommerceStore, CommerceProduct, CommerceCoupon } from '../lib/types';
import { CommerceStoresTab } from '../components/admin/CommerceStoresTab';
import { CommerceProductsTab } from '../components/admin/CommerceProductsTab';
import { CommerceCouponsTab } from '../components/admin/CommerceCouponsTab';
import { Store, Package, Ticket, Settings, LayoutDashboard } from 'lucide-react';

type Tab = 'dashboard' | 'tiendas' | 'productos' | 'cupones';

const inp = 'w-full px-3 py-2 border border-[#E5E5E5] rounded-lg text-sm focus:outline-none focus:border-[#CC0000]';

export function CommerceAdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [commerce, setCommerce] = useState<Commerce | null>(null);
  const [stores, setStores] = useState<CommerceStore[]>([]);
  const [products, setProducts] = useState<CommerceProduct[]>([]);
  const [coupons, setCoupons] = useState<CommerceCoupon[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: 'nutricion', address: '', website: '', discount_percentage: '', discount_description: '', is_active: true });

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const { data: adminData } = await supabase.from('commerce_admins').select('commerce_id').eq('user_id', user.id).maybeSingle();
    if (!adminData) return;
    const cid = adminData.commerce_id;
    const [{ data: c }, { data: st }, { data: pr }, { data: cp }] = await Promise.all([
      supabase.from('commerces').select('*').eq('id', cid).maybeSingle(),
      supabase.from('commerce_stores').select('*').eq('commerce_id', cid).order('created_at'),
      supabase.from('commerce_products').select('*').eq('commerce_id', cid).order('created_at'),
      supabase.from('commerce_coupons').select('*').eq('commerce_id', cid).order('created_at'),
    ]);
    if (c) {
      setCommerce(c);
      setForm({ name: c.name, description: c.description, category: c.category, address: c.address, website: c.website, discount_percentage: String(c.discount_percentage), discount_description: c.discount_description, is_active: c.is_active });
    }
    setStores(st ?? []);
    setProducts(pr ?? []);
    setCoupons(cp ?? []);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async () => {
    if (!commerce) return;
    await supabase.from('commerces').update({ name: form.name, description: form.description, category: form.category, address: form.address, website: form.website, discount_percentage: parseInt(form.discount_percentage) || 0, discount_description: form.discount_description, is_active: form.is_active }).eq('id', commerce.id);
    setEditMode(false);
    fetchAll();
  };

  const toggleActive = async () => {
    if (!commerce) return;
    const v = !form.is_active;
    setForm(f => ({ ...f, is_active: v }));
    await supabase.from('commerces').update({ is_active: v }).eq('id', commerce.id);
    fetchAll();
  };

  if (!commerce) return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center text-[#666] text-sm">
      Cargando panel de administración...
    </div>
  );

  const tabs: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Panel', Icon: LayoutDashboard },
    { id: 'tiendas', label: 'Tiendas', Icon: Store },
    { id: 'productos', label: 'Productos', Icon: Package },
    { id: 'cupones', label: 'Cupones', Icon: Ticket },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-24">
      <div className="bg-[#111111] px-4 pt-10 pb-4">
        <p className="text-white/50 text-xs mb-0.5">FluxFit Admin</p>
        <h1 className="text-white font-bold text-xl">{commerce.name}</h1>
        <p className="text-white/60 text-xs mt-0.5">{getCommerceCategoryEmoji(commerce.category)} {getCommerceCategoryLabel(commerce.category)}</p>
      </div>

      <div className="flex border-b border-[#E5E5E5] bg-white sticky top-0 z-10 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1 px-3 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-[#CC0000] text-[#CC0000]' : 'border-transparent text-[#999]'}`}>
            <t.Icon size={13} />{t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Tiendas', value: stores.length },
                { label: 'Productos', value: products.length },
                { label: 'Cupones', value: coupons.length },
              ].map(k => (
                <div key={k.label} className="bg-white rounded-xl border border-[#E5E5E5] p-3 text-center">
                  <p className="text-xl font-bold text-[#111]">{k.value}</p>
                  <p className="text-[10px] text-[#999] mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-[#111]">Comercio activo</p>
                <p className="text-xs text-[#999]">{form.is_active ? 'Visible para usuarios' : 'Oculto para usuarios'}</p>
              </div>
              <button onClick={toggleActive} className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${form.is_active ? 'bg-[#16A34A]' : 'bg-[#E5E5E5]'}`}>
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${form.is_active ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#111]">Información del comercio</h3>
                <button onClick={() => setEditMode(!editMode)} className="flex items-center gap-1 text-xs text-[#CC0000] font-bold">
                  <Settings size={12} />{editMode ? 'Cancelar' : 'Editar'}
                </button>
              </div>
              {editMode ? (
                <div className="space-y-2">
                  <input placeholder="Nombre" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} />
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
                    <option value="nutricion">Nutrición</option>
                    <option value="suplementos">Suplementos</option>
                    <option value="indumentaria">Indumentaria</option>
                    <option value="fisioterapia">Fisioterapia</option>
                    <option value="otro">Otro</option>
                  </select>
                  <textarea placeholder="Descripción" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} rows={3} />
                  <input placeholder="Dirección" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inp} />
                  <input placeholder="Sitio web" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className={inp} />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="% descuento" type="number" value={form.discount_percentage} onChange={e => setForm(f => ({ ...f, discount_percentage: e.target.value }))} className={inp} />
                    <input placeholder="Descripción descuento" value={form.discount_description} onChange={e => setForm(f => ({ ...f, discount_description: e.target.value }))} className={inp} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={save} className="flex-1 py-2.5 bg-[#CC0000] text-white font-bold rounded-xl text-sm">Guardar</button>
                    <button onClick={() => setEditMode(false)} className="flex-1 py-2.5 border border-[#E5E5E5] rounded-xl text-sm">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: 'Categoría', value: getCommerceCategoryLabel(commerce.category) },
                    { label: 'Descripción', value: commerce.description || '—' },
                    { label: 'Dirección', value: commerce.address || '—' },
                    { label: 'Sitio web', value: commerce.website || '—' },
                    { label: 'Descuento', value: `${commerce.discount_percentage}% — ${commerce.discount_description || '—'}` },
                  ].map(r => (
                    <div key={r.label}>
                      <p className="text-[10px] text-[#999]">{r.label}</p>
                      <p className="text-sm text-[#111]">{r.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'tiendas' && <CommerceStoresTab commerceId={commerce.id} stores={stores} onRefresh={fetchAll} />}
        {tab === 'productos' && <CommerceProductsTab commerceId={commerce.id} products={products} onRefresh={fetchAll} />}
        {tab === 'cupones' && <CommerceCouponsTab commerceId={commerce.id} coupons={coupons} onRefresh={fetchAll} />}
      </div>
    </div>
  );
}
