import { useState, useEffect, useCallback } from 'react';
import { Cpu, Wifi, WifiOff, Wrench, Plus, X, Unlink, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';

interface Sensor {
  id: string;
  label: string;
  branch_id: string | null;
  status: 'online' | 'offline' | 'maintenance';
  last_heartbeat: string | null;
  battery_level: number;
  secret_key: string;
  created_at: string;
  gym_branches?: { name: string; gyms?: { name: string } } | null;
}

interface Branch {
  id: string;
  name: string;
  gym_id: string;
  gyms?: { name: string } | null;
}

const STATUS_META = {
  online:      { label: 'Online',         color: 'text-[#16A34A] bg-[#16A34A]/10', Icon: Wifi },
  offline:     { label: 'Offline',        color: 'text-[#CC0000] bg-[#CC0000]/10', Icon: WifiOff },
  maintenance: { label: 'Mantenimiento',  color: 'text-amber-600 bg-amber-50',      Icon: Wrench },
};

const inp = 'w-full px-3 py-2.5 border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#CC0000] bg-white';

export function SensorInventoryPage() {
  const { toast, showToast } = useToast();
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '', branch_id: '' });
  const [saving, setSaving] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [sensorsRes, branchesRes] = await Promise.all([
      supabase
        .from('sensors')
        .select('*, gym_branches(name, gyms(name))')
        .order('created_at', { ascending: false }),
      supabase
        .from('gym_branches')
        .select('id, name, gym_id, gyms(name)')
        .order('name'),
    ]);
    setSensors(sensorsRes.data ?? []);
    setBranches(branchesRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createSensor = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('sensors').insert({
        label: form.label.trim(),
        branch_id: form.branch_id || null,
        status: 'offline',
      });
      if (error) throw error;
      setForm({ label: '', branch_id: '' });
      setShowForm(false);
      await fetchData();
      showToast('Sensor registrado correctamente', 'success');
    } catch (err: any) {
      showToast('Error al registrar: ' + (err?.message ?? ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const linkSensor = async (sensorId: string, branchId: string | null) => {
    setLinkingId(sensorId);
    const { error } = await supabase.from('sensors').update({ branch_id: branchId }).eq('id', sensorId);
    if (error) { showToast('Error al vincular', 'error'); setLinkingId(null); return; }
    await fetchData();
    showToast(branchId ? 'Sensor vinculado' : 'Sensor desvinculado', 'success');
    setLinkingId(null);
  };

  const deleteSensor = async (id: string) => {
    if (!confirm('¿Eliminar este sensor del inventario?')) return;
    const { error } = await supabase.from('sensors').delete().eq('id', id);
    if (error) { showToast('Error al eliminar', 'error'); return; }
    await fetchData();
    showToast('Sensor eliminado', 'success');
  };

  const copyKey = (key: string) =>
    navigator.clipboard.writeText(key).then(() => showToast('Clave copiada', 'success'));

  const online = sensors.filter(s => s.status === 'online').length;
  const offline = sensors.filter(s => s.status === 'offline').length;
  const maintenance = sensors.filter(s => s.status === 'maintenance').length;

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-24">
      <Toast {...toast} />

      {/* Header */}
      <div className="bg-[#111111] px-4 pt-10 pb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Cpu size={22} className="text-[#CC0000]" />
            <div>
              <p className="text-white/50 text-xs">FluxFit Admin</p>
              <h1 className="text-white font-bold text-xl">Inventario de Sensores</h1>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={15} className="text-white" />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            { label: 'Online',        count: online,      color: 'text-[#4ADE80]' },
            { label: 'Offline',       count: offline,     color: 'text-[#F87171]' },
            { label: 'Mantenimiento', count: maintenance, color: 'text-amber-300' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[10px] text-white/60 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Register button */}
        <button
          onClick={() => { setShowForm(v => !v); setForm({ label: '', branch_id: '' }); }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#CC0000] text-white font-bold rounded-xl text-sm active:scale-[0.98] transition-transform"
        >
          <Plus size={16} />
          {showForm ? 'Cancelar registro' : 'Registrar nuevo sensor'}
        </button>

        {/* New sensor form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 space-y-3 shadow-sm">
            <p className="font-bold text-[#111] text-sm">Datos del sensor</p>
            <input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Etiqueta (ej: Sensor Entrada Principal)"
              className={inp}
            />
            <select
              value={form.branch_id}
              onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}
              className={inp}
            >
              <option value="">— Sin sucursal (solo inventario) —</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  {b.gyms?.name ?? 'Gym'} · {b.name}
                </option>
              ))}
            </select>
            <button
              onClick={createSensor}
              disabled={saving || !form.label.trim()}
              className="w-full py-3 bg-[#111] text-white font-bold rounded-xl text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {saving ? 'Registrando...' : 'Confirmar registro'}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#CC0000] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && sensors.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-10 text-center">
            <Cpu size={32} className="text-[#E5E5E5] mx-auto mb-3" />
            <p className="font-bold text-[#111] text-sm">Sin sensores registrados</p>
            <p className="text-xs text-[#999] mt-1">Usa el botón de arriba para registrar el primer sensor.</p>
          </div>
        )}

        {/* Sensor cards */}
        {!loading && sensors.map(s => {
          const meta = STATUS_META[s.status] ?? STATUS_META.offline;
          const StatusIcon = meta.Icon;
          const branch = s.gym_branches;
          const gymName = branch?.gyms?.name ?? null;
          const lastSeen = s.last_heartbeat
            ? new Date(s.last_heartbeat).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
            : 'Nunca';
          const isLinking = linkingId === s.id;

          return (
            <div key={s.id} className="bg-white rounded-2xl border border-[#E5E5E5] p-4 space-y-3 shadow-sm">
              {/* Identity row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-[#999] flex-shrink-0" />
                    <p className="font-bold text-[#111] text-sm truncate">{s.label || 'Sin etiqueta'}</p>
                  </div>
                  <p className="text-xs mt-0.5 ml-[22px]">
                    {gymName
                      ? <span className="text-[#444]">{gymName} · <span className="text-[#999]">{branch?.name}</span></span>
                      : <span className="text-[#bbb] italic">Sin sucursal asignada</span>
                    }
                  </p>
                </div>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${meta.color}`}>
                  <StatusIcon size={10} />
                  {meta.label}
                </span>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-5 px-1">
                <div className="text-center">
                  <p className="text-xs font-bold text-[#111]">{s.battery_level}%</p>
                  <p className="text-[10px] text-[#999]">Batería</p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-[#111]">{lastSeen}</p>
                  <p className="text-[10px] text-[#999]">Último ping</p>
                </div>
              </div>

              {/* Secret key */}
              <div className="bg-[#F5F5F5] rounded-lg px-3 py-2 flex items-center gap-2">
                <code className="text-[10px] text-[#666] font-mono flex-1 truncate">{s.secret_key}</code>
                <button
                  onClick={() => copyKey(s.secret_key)}
                  className="text-[10px] font-bold text-[#CC0000] flex-shrink-0 hover:underline"
                >
                  Copiar
                </button>
              </div>

              {/* Link controls */}
              <div className="flex gap-2">
                <select
                  key={s.branch_id ?? 'none'}
                  defaultValue={s.branch_id ?? ''}
                  onChange={e => linkSensor(s.id, e.target.value || null)}
                  disabled={isLinking}
                  className="flex-1 px-3 py-2 border border-[#E5E5E5] rounded-xl text-xs focus:outline-none focus:border-[#CC0000] bg-white disabled:opacity-50"
                >
                  <option value="">— Inventario (sin sucursal) —</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.gyms?.name ?? 'Gym'} · {b.name}
                    </option>
                  ))}
                </select>
                {s.branch_id && (
                  <button
                    onClick={() => linkSensor(s.id, null)}
                    disabled={isLinking}
                    title="Desvincular"
                    className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-[#CC0000] hover:bg-[#CC0000]/5 disabled:opacity-50 transition-colors"
                  >
                    <Unlink size={14} />
                  </button>
                )}
                <button
                  onClick={() => deleteSensor(s.id)}
                  title="Eliminar"
                  className="px-3 py-2 border border-[#E5E5E5] rounded-xl text-[#999] hover:border-[#CC0000] hover:text-[#CC0000] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              {isLinking && (
                <p className="text-[10px] text-[#999] text-center">Actualizando...</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
