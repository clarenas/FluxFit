import { useState, useEffect, useCallback } from 'react';
import {
  Cpu, Wifi, WifiOff, Wrench, Plus, X, RefreshCw,
  ChevronDown, ChevronUp, AlertTriangle, Clock, History,
  ArrowRightLeft, CheckCircle, Radio,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { Toast } from '../components/Toast';

// ── Types ────────────────────────────────────────────────────────────────────

interface Sensor {
  id: string;
  kit_id: string | null;
  branch_id: string | null;
  position: 'entry' | 'exit' | null;
  label: string;
  brand: string;
  model: string;
  serial_number: string;
  installation_date: string | null;
  status: 'active' | 'online' | 'offline' | 'maintenance' | 'retired';
  last_heartbeat: string | null;
  secret_key: string;
  created_at: string;
}

interface SensorKit {
  id: string;
  branch_id: string;
  name: string;
  created_at: string;
  gym_branches?: {
    id: string;
    name: string;
    gyms?: { id: string; name: string } | null;
  } | null;
  sensors?: Sensor[];
}

interface SensorHistory {
  id: string;
  kit_id: string;
  position: 'entry' | 'exit';
  brand: string;
  model: string;
  serial_number: string;
  installed_at: string | null;
  retired_at: string;
  retired_reason: string;
}

interface Branch {
  id: string;
  name: string;
  gym_id: string;
  gyms?: { id: string; name: string } | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const FIVE_MIN_MS = 5 * 60 * 1000;

function isOnline(heartbeat: string | null): boolean {
  if (!heartbeat) return false;
  return Date.now() - new Date(heartbeat).getTime() < FIVE_MIN_MS;
}

function fmtDate(ts: string | null): string {
  if (!ts) return 'Nunca';
  return new Date(ts).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const inp = 'w-full px-3 py-2.5 border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#CC0000] bg-white';
const label = (t: string) => <label className="block text-xs font-bold text-[#666] mb-1">{t}</label>;

// Status badge based on 5-min heartbeat window
function SensorPill({ sensor }: { sensor: Sensor | undefined }) {
  if (!sensor) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-dashed border-[#E5E5E5]">
        <div className="w-2 h-2 rounded-full bg-[#E5E5E5]" />
        <span className="text-[11px] font-bold text-[#999]">Sin sensor</span>
      </div>
    );
  }
  const online = isOnline(sensor.last_heartbeat);
  const retired = sensor.status === 'retired';
  const maintenance = sensor.status === 'maintenance';

  const dot = retired ? 'bg-[#666]'
    : maintenance ? 'bg-amber-400'
    : online ? 'bg-[#16A34A] animate-pulse'
    : 'bg-[#CC0000]';
  const ring = retired ? 'border-[#E5E5E5] bg-[#F5F5F5]'
    : maintenance ? 'border-amber-200 bg-amber-50'
    : online ? 'border-[#16A34A]/30 bg-[#16A34A]/5'
    : 'border-[#CC0000]/30 bg-[#CC0000]/5';
  const text = retired ? 'text-[#666]'
    : maintenance ? 'text-amber-700'
    : online ? 'text-[#16A34A]'
    : 'text-[#CC0000]';
  const statusLabel = retired ? 'Retirado'
    : maintenance ? 'Mantenimiento'
    : online ? 'Online'
    : 'Offline';

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border ${ring}`}>
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      <div className="min-w-0">
        <p className={`text-[10px] font-bold ${text}`}>{statusLabel}</p>
        <p className="text-[9px] text-[#999] truncate max-w-[90px]">{sensor.serial_number || 'S/N —'}</p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

type View = 'kits' | 'register' | 'replace' | 'history';

export function SensorInventoryPage() {
  const { toast, showToast } = useToast();
  const [kits, setKits] = useState<SensorKit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [gyms, setGyms] = useState<{ id: string; name: string }[]>([]);
  const [history, setHistory] = useState<SensorHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('kits');
  const [expandedKit, setExpandedKit] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Registration form
  const [regForm, setRegForm] = useState({
    gym_id: '',
    branch_id: '',
    kit_name: 'Acceso Principal',
    brand: '',
    model: '',
    sn_entry: '',
    sn_exit: '',
    activation_date: new Date().toISOString().split('T')[0],
    status: 'operativo',
    observations: '',
  });
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  // Replacement form
  const [replaceTarget, setReplaceTarget] = useState<{ kit: SensorKit; sensor: Sensor; position: 'entry' | 'exit' } | null>(null);
  const [replaceForm, setReplaceForm] = useState({ serial_number: '', brand: '', model: '', reason: 'replaced' as string });
  const [replaceErrors, setReplaceErrors] = useState<Record<string, string>>({});

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [kitsRes, branchesRes, gymsRes, histRes] = await Promise.all([
      supabase
        .from('sensor_kits')
        .select(`
          id, branch_id, name, created_at,
          gym_branches ( id, name, gyms ( id, name ) ),
          sensors ( id, kit_id, branch_id, position, label, brand, model, serial_number, installation_date, status, last_heartbeat, secret_key, created_at )
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('gym_branches')
        .select('id, name, gym_id, gyms(id, name)')
        .order('gym_id')
        .order('name'),
      supabase.from('gyms').select('id, name').eq('is_active', true).order('name'),
      supabase
        .from('sensor_history')
        .select('*')
        .order('retired_at', { ascending: false })
        .limit(100),
    ]);
    setKits(kitsRes.data ?? []);
    setBranches(branchesRes.data ?? []);
    setGyms(gymsRes.data ?? []);
    setHistory(histRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Kit registration ───────────────────────────────────────────────────────

  const validateReg = (): boolean => {
    const errs: Record<string, string> = {};
    if (!regForm.gym_id) errs.gym_id = 'Selecciona una cadena';
    if (!regForm.branch_id) errs.branch_id = 'Selecciona una sucursal';
    if (!regForm.kit_name.trim()) errs.kit_name = 'Ingresa un nombre para el acceso';
    if (!regForm.brand.trim()) errs.brand = 'Ingresa la marca';
    if (!regForm.model.trim()) errs.model = 'Ingresa el modelo';
    if (!regForm.sn_entry.trim()) errs.sn_entry = 'Ingresa el S/N de entrada';
    if (!regForm.sn_exit.trim()) errs.sn_exit = 'Ingresa el S/N de salida';
    if (regForm.sn_entry.trim() === regForm.sn_exit.trim() && regForm.sn_entry.trim())
      errs.sn_exit = 'El S/N de salida no puede ser igual al de entrada';
    setRegErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitRegistration = async () => {
    if (!validateReg()) return;
    setSaving(true);
    try {
      // Check serial numbers aren't already in use
      const { data: existing } = await supabase
        .from('sensors')
        .select('serial_number')
        .in('serial_number', [regForm.sn_entry.trim(), regForm.sn_exit.trim()])
        .neq('status', 'retired');

      if (existing && existing.length > 0) {
        const dupes = existing.map((s: any) => s.serial_number).join(', ');
        setRegErrors({ sn_entry: `S/N ya registrado: ${dupes}` });
        return;
      }

      // Create the kit
      const { data: newKit, error: kitErr } = await supabase
        .from('sensor_kits')
        .insert({ branch_id: regForm.branch_id, name: regForm.kit_name.trim(), activation_date: regForm.activation_date || null, status: regForm.status, observations: regForm.observations.trim() || null })
        .select('id')
        .single();
      if (kitErr) throw kitErr;

      const now = new Date().toISOString();

      // Create both sensors
      const { error: sensorsErr } = await supabase.from('sensors').insert([
        {
          kit_id: newKit.id,
          branch_id: regForm.branch_id,
          position: 'entry',
          label: `${regForm.kit_name.trim()} — Entrada`,
          brand: regForm.brand.trim(),
          model: regForm.model.trim(),
          serial_number: regForm.sn_entry.trim(),
          installation_date: now,
          status: 'active',
        },
        {
          kit_id: newKit.id,
          branch_id: regForm.branch_id,
          position: 'exit',
          label: `${regForm.kit_name.trim()} — Salida`,
          brand: regForm.brand.trim(),
          model: regForm.model.trim(),
          serial_number: regForm.sn_exit.trim(),
          installation_date: now,
          status: 'active',
        },
      ]);
      if (sensorsErr) throw sensorsErr;

      setRegForm({ gym_id: '', branch_id: '', kit_name: 'Acceso Principal', brand: '', model: '', sn_entry: '', sn_exit: '', activation_date: new Date().toISOString().split('T')[0], status: 'operativo', observations: '' });
      setRegErrors({});
      setView('kits');
      await fetchData();
      showToast('Kit registrado correctamente', 'success');
    } catch (err: any) {
      showToast('Error al registrar: ' + (err?.message ?? ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Hardware replacement ───────────────────────────────────────────────────

  const openReplace = (kit: SensorKit, position: 'entry' | 'exit') => {
    const sensor = kit.sensors?.find(s => s.position === position);
    if (!sensor) return;
    setReplaceTarget({ kit, sensor, position });
    setReplaceForm({ serial_number: '', brand: sensor.brand, model: sensor.model, reason: 'replaced' });
    setReplaceErrors({});
    setView('replace');
  };

  const validateReplace = (): boolean => {
    const errs: Record<string, string> = {};
    if (!replaceForm.serial_number.trim()) errs.serial_number = 'Ingresa el S/N del nuevo sensor';
    if (!replaceForm.brand.trim()) errs.brand = 'Ingresa la marca';
    if (!replaceForm.model.trim()) errs.model = 'Ingresa el modelo';
    setReplaceErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitReplacement = async () => {
    if (!validateReplace() || !replaceTarget) return;
    setSaving(true);
    try {
      const { sensor, kit } = replaceTarget;

      // Check new S/N isn't already in use
      const { data: existing } = await supabase
        .from('sensors')
        .select('id')
        .eq('serial_number', replaceForm.serial_number.trim())
        .neq('status', 'retired')
        .neq('id', sensor.id)
        .maybeSingle();
      if (existing) {
        setReplaceErrors({ serial_number: 'Este S/N ya está registrado en otro sensor activo' });
        return;
      }

      // Archive old sensor to history
      await supabase.from('sensor_history').insert({
        kit_id: kit.id,
        position: sensor.position,
        brand: sensor.brand,
        model: sensor.model,
        serial_number: sensor.serial_number,
        installed_at: sensor.installation_date,
        retired_at: new Date().toISOString(),
        retired_reason: replaceForm.reason,
      });

      // Update sensor record with new hardware info
      await supabase.from('sensors').update({
        serial_number: replaceForm.serial_number.trim(),
        brand: replaceForm.brand.trim(),
        model: replaceForm.model.trim(),
        installation_date: new Date().toISOString(),
        status: 'active',
        last_heartbeat: null,
      }).eq('id', sensor.id);

      setReplaceTarget(null);
      setView('kits');
      await fetchData();
      showToast('Hardware reemplazado. Historial actualizado.', 'success');
    } catch (err: any) {
      showToast('Error al reemplazar: ' + (err?.message ?? ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Simulate ping (dev tool) ───────────────────────────────────────────────

  const simulatePing = async (sensorId: string) => {
    const { error } = await supabase
      .from('sensors')
      .update({ last_heartbeat: new Date().toISOString(), status: 'active' })
      .eq('id', sensorId);
    if (error) { showToast('Error al simular ping', 'error'); return; }
    await fetchData();
    showToast('Ping simulado — sensor marcado Online', 'success');
  };

  // ── Kit deletion ───────────────────────────────────────────────────────────

  const deleteKit = async (kitId: string) => {
    if (!confirm('¿Eliminar este kit y sus sensores? Esta acción no se puede deshacer.')) return;
    await supabase.from('sensors').delete().eq('kit_id', kitId);
    await supabase.from('sensor_kits').delete().eq('id', kitId);
    await fetchData();
    showToast('Kit eliminado', 'info');
  };

  // ── Derived stats ──────────────────────────────────────────────────────────

  const allSensors = kits.flatMap(k => k.sensors ?? []);
  const totalKits = kits.length;
  const onlineCount = allSensors.filter(s => isOnline(s.last_heartbeat) && s.status !== 'retired').length;
  const offlineCount = allSensors.filter(s => !isOnline(s.last_heartbeat) && s.status === 'active').length;
  const maintenanceCount = allSensors.filter(s => s.status === 'maintenance').length;

  // ── Register view ──────────────────────────────────────────────────────────

  if (view === 'register') {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-24">
        <Toast {...toast} />
        <div className="bg-[#111] px-4 pt-10 pb-5">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => setView('kits')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
              <X size={16} className="text-white" />
            </button>
            <div>
              <p className="text-white/50 text-xs">Inventario</p>
              <h1 className="text-white font-bold text-lg">Registrar Kit de Acceso</h1>
            </div>
          </div>
        </div>

        <div className="px-4 pt-5 space-y-5 max-w-[600px] mx-auto">
          {/* Step 1: Location */}
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#F5F5F5] pb-3">
              <div className="w-6 h-6 rounded-full bg-[#CC0000] text-white text-xs font-bold flex items-center justify-center">1</div>
              <p className="font-bold text-[#111] text-sm">Ubicación</p>
            </div>
            <div>
              {label('Cadena de gimnasio')}
              <select
                value={regForm.gym_id}
                onChange={e => setRegForm(f => ({ ...f, gym_id: e.target.value, branch_id: '' }))}
                className={inp}
              >
                <option value="">— Seleccionar cadena —</option>
                {gyms.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              {regErrors.gym_id && <p className="text-xs text-[#CC0000] mt-1">{regErrors.gym_id}</p>}
            </div>
            <div>
              {label('Sucursal')}
              <select
                value={regForm.branch_id}
                onChange={e => setRegForm(f => ({ ...f, branch_id: e.target.value }))}
                disabled={!regForm.gym_id}
                className={`${inp} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <option value="">— Seleccionar sucursal —</option>
                {branches.filter(b => b.gym_id === regForm.gym_id).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {regErrors.branch_id && <p className="text-xs text-[#CC0000] mt-1">{regErrors.branch_id}</p>}
            </div>
            <div>
              {label('Nombre del punto de acceso')}
              <input
                value={regForm.kit_name}
                onChange={e => setRegForm(f => ({ ...f, kit_name: e.target.value }))}
                placeholder="ej: Entrada Principal, Acceso Norte..."
                className={inp}
              />
              {regErrors.kit_name && <p className="text-xs text-[#CC0000] mt-1">{regErrors.kit_name}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-[#111] mb-1.5">Fecha de activación</label>
              <input
                type="date"
                value={regForm.activation_date}
                onChange={e => setRegForm(f => ({ ...f, activation_date: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] text-sm focus:outline-none focus:border-[#CC0000] bg-white text-[#111]"
              />
              <p className="text-xs text-[#666] mt-1">Fecha en que el sensor se puso en funcionamiento</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#111] mb-1.5">Estado del sensor</label>
              <select
                value={regForm.status}
                onChange={e => setRegForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] text-sm focus:outline-none focus:border-[#CC0000] bg-white text-[#111]"
              >
                <option value="operativo">🟢 Operativo</option>
                <option value="mantencion">🟡 En mantención</option>
                <option value="baja">🔴 De baja</option>
              </select>
            </div>
          </div>

          {/* Step 2: Hardware */}
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#F5F5F5] pb-3">
              <div className="w-6 h-6 rounded-full bg-[#CC0000] text-white text-xs font-bold flex items-center justify-center">2</div>
              <p className="font-bold text-[#111] text-sm">Hardware del kit</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                {label('Marca')}
                <input value={regForm.brand} onChange={e => setRegForm(f => ({ ...f, brand: e.target.value }))} placeholder="ej: FluxFit" className={inp} />
                {regErrors.brand && <p className="text-xs text-[#CC0000] mt-1">{regErrors.brand}</p>}
              </div>
              <div>
                {label('Modelo')}
                <input value={regForm.model} onChange={e => setRegForm(f => ({ ...f, model: e.target.value }))} placeholder="ej: IR-400" className={inp} />
                {regErrors.model && <p className="text-xs text-[#CC0000] mt-1">{regErrors.model}</p>}
              </div>
            </div>

            <div className="bg-[#F5F5F5] rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
                <p className="text-xs font-bold text-[#444]">Sensor de Entrada</p>
              </div>
              <div>
                {label('Número de serie (S/N)')}
                <input
                  value={regForm.sn_entry}
                  onChange={e => setRegForm(f => ({ ...f, sn_entry: e.target.value }))}
                  placeholder="SN-ENTRADA-001"
                  className={inp}
                />
                {regErrors.sn_entry && <p className="text-xs text-[#CC0000] mt-1">{regErrors.sn_entry}</p>}
              </div>
            </div>

            <div className="bg-[#F5F5F5] rounded-xl p-3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#CC0000]" />
                <p className="text-xs font-bold text-[#444]">Sensor de Salida</p>
              </div>
              <div>
                {label('Número de serie (S/N)')}
                <input
                  value={regForm.sn_exit}
                  onChange={e => setRegForm(f => ({ ...f, sn_exit: e.target.value }))}
                  placeholder="SN-SALIDA-001"
                  className={inp}
                />
                {regErrors.sn_exit && <p className="text-xs text-[#CC0000] mt-1">{regErrors.sn_exit}</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#111] mb-1.5">Observaciones (opcional)</label>
            <textarea
              value={regForm.observations}
              onChange={e => setRegForm(f => ({ ...f, observations: e.target.value }))}
              placeholder="Notas sobre instalación, problemas, configuración especial, etc."
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] text-sm focus:outline-none focus:border-[#CC0000] bg-white text-[#111] resize-none"
            />
            <p className="text-xs text-[#666] mt-1">Máximo 500 caracteres</p>
          </div>

          {(() => {
            const canSubmit =
              !!regForm.gym_id &&
              !!regForm.branch_id &&
              !!regForm.sn_entry.trim() &&
              !!regForm.sn_exit.trim() &&
              !!regForm.brand.trim() &&
              !!regForm.model.trim();
            return (
              <button
                onClick={submitRegistration}
                disabled={saving || !canSubmit}
                className="w-full py-4 bg-[#CC0000] text-white font-bold rounded-2xl text-sm disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Registrando...</>
                ) : (
                  <><CheckCircle size={16} /> Confirmar registro del kit</>
                )}
              </button>
            );
          })()}
        </div>
      </div>
    );
  }

  // ── Replace view ───────────────────────────────────────────────────────────

  if (view === 'replace' && replaceTarget) {
    const { sensor, kit, position } = replaceTarget;
    const posLabel = position === 'entry' ? 'Entrada' : 'Salida';
    const posColor = position === 'entry' ? 'text-[#16A34A]' : 'text-[#CC0000]';
    const gymName = kit.gym_branches?.gyms?.name ?? 'Gym';
    const branchName = kit.gym_branches?.name ?? '';

    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-24">
        <Toast {...toast} />
        <div className="bg-[#111] px-4 pt-10 pb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('kits')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
              <X size={16} className="text-white" />
            </button>
            <div>
              <p className="text-white/50 text-xs">Inventario</p>
              <h1 className="text-white font-bold text-lg">Sustituir Hardware</h1>
            </div>
          </div>
        </div>

        <div className="px-4 pt-5 space-y-4 max-w-[600px] mx-auto">
          {/* Outgoing sensor summary */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-600" />
              <p className="text-xs font-bold text-amber-700">Sensor siendo retirado</p>
            </div>
            <p className="text-sm font-bold text-[#111]">{gymName} · {branchName} · {kit.name}</p>
            <p className={`text-xs font-bold ${posColor}`}>Posición: {posLabel}</p>
            <div className="text-xs text-[#666] space-y-0.5">
              <p>{sensor.brand} {sensor.model}</p>
              <p className="font-mono">S/N: {sensor.serial_number || '—'}</p>
              <p>Instalado: {fmtDate(sensor.installation_date)}</p>
            </div>
          </div>

          {/* New sensor form */}
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 space-y-4">
            <p className="font-bold text-[#111] text-sm">Datos del nuevo sensor</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                {label('Marca')}
                <input value={replaceForm.brand} onChange={e => setReplaceForm(f => ({ ...f, brand: e.target.value }))} className={inp} placeholder="ej: FluxFit" />
                {replaceErrors.brand && <p className="text-xs text-[#CC0000] mt-1">{replaceErrors.brand}</p>}
              </div>
              <div>
                {label('Modelo')}
                <input value={replaceForm.model} onChange={e => setReplaceForm(f => ({ ...f, model: e.target.value }))} className={inp} placeholder="ej: IR-400" />
                {replaceErrors.model && <p className="text-xs text-[#CC0000] mt-1">{replaceErrors.model}</p>}
              </div>
            </div>
            <div>
              {label('Nuevo número de serie (S/N)')}
              <input
                value={replaceForm.serial_number}
                onChange={e => setReplaceForm(f => ({ ...f, serial_number: e.target.value }))}
                placeholder="SN-NUEVO-001"
                className={inp}
              />
              {replaceErrors.serial_number && <p className="text-xs text-[#CC0000] mt-1">{replaceErrors.serial_number}</p>}
            </div>
            <div>
              {label('Motivo del reemplazo')}
              <select value={replaceForm.reason} onChange={e => setReplaceForm(f => ({ ...f, reason: e.target.value }))} className={inp}>
                <option value="replaced">Reemplazo preventivo</option>
                <option value="failed">Fallo de hardware</option>
                <option value="decommissioned">Baja definitiva</option>
              </select>
            </div>
          </div>

          <button
            onClick={submitReplacement}
            disabled={saving}
            className="w-full py-4 bg-[#CC0000] text-white font-bold rounded-2xl text-sm disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Procesando...</>
            ) : (
              <><ArrowRightLeft size={16} /> Confirmar sustitución</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── History view ───────────────────────────────────────────────────────────

  if (view === 'history') {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-24">
        <Toast {...toast} />
        <div className="bg-[#111] px-4 pt-10 pb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('kits')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
              <X size={16} className="text-white" />
            </button>
            <div>
              <p className="text-white/50 text-xs">Inventario</p>
              <h1 className="text-white font-bold text-lg">Historial de Mantenimiento</h1>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-3 max-w-[600px] mx-auto">
          {history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-10 text-center">
              <History size={28} className="text-[#E5E5E5] mx-auto mb-3" />
              <p className="font-bold text-[#111] text-sm">Sin historial</p>
              <p className="text-xs text-[#999] mt-1">Aquí aparecerán los sensores reemplazados.</p>
            </div>
          ) : history.map(h => {
            // Find kit name for context
            const kit = kits.find(k => k.id === h.kit_id);
            const gymName = kit?.gym_branches?.gyms?.name ?? '—';
            const branchName = kit?.gym_branches?.name ?? '—';
            const posColor = h.position === 'entry' ? 'text-[#16A34A]' : 'text-[#CC0000]';
            const reasonMap: Record<string, string> = { replaced: 'Reemplazo preventivo', failed: 'Fallo de hardware', decommissioned: 'Baja definitiva' };

            return (
              <div key={h.id} className="bg-white rounded-2xl border border-[#E5E5E5] p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#111] text-sm">{gymName} · {branchName}</p>
                    <p className="text-xs text-[#666]">{kit?.name ?? '—'}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F5F5F5] ${posColor}`}>
                    {h.position === 'entry' ? 'Entrada' : 'Salida'}
                  </span>
                </div>
                <div className="bg-[#F5F5F5] rounded-lg p-2.5 text-xs space-y-0.5">
                  <p className="font-bold text-[#111]">{h.brand} {h.model}</p>
                  <p className="font-mono text-[#666]">S/N: {h.serial_number || '—'}</p>
                  <p className="text-[#999]">Instalado: {fmtDate(h.installed_at)}</p>
                  <p className="text-[#999]">Retirado: {fmtDate(h.retired_at)}</p>
                  <p className="text-amber-600 font-bold">{reasonMap[h.retired_reason] ?? h.retired_reason}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Main kits view ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-24">
      <Toast {...toast} />

      {/* Header */}
      <div className="bg-[#111] px-4 pt-10 pb-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <Cpu size={20} className="text-[#CC0000]" />
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

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Kits',          count: totalKits,      color: 'text-white' },
            { label: 'Online',        count: onlineCount,    color: 'text-[#4ADE80]' },
            { label: 'Offline',       count: offlineCount,   color: 'text-[#F87171]' },
            { label: 'Mantenim.',     count: maintenanceCount, color: 'text-amber-300' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-2.5 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
              <p className="text-[9px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-[600px] mx-auto">
        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setView('register')}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#CC0000] text-white font-bold rounded-xl text-sm active:scale-[0.98] transition-transform"
          >
            <Plus size={15} /> Registrar Kit
          </button>
          <button
            onClick={() => setView('history')}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-[#E5E5E5] text-[#666] font-bold rounded-xl text-sm active:scale-[0.98] transition-transform"
          >
            <History size={15} />
            <span className="hidden sm:inline">Historial</span>
            {history.length > 0 && (
              <span className="bg-[#111] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{history.length}</span>
            )}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#CC0000] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && kits.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-10 text-center">
            <Cpu size={32} className="text-[#E5E5E5] mx-auto mb-3" />
            <p className="font-bold text-[#111] text-sm">Sin kits registrados</p>
            <p className="text-xs text-[#999] mt-1">Registra el primer kit de acceso para comenzar el inventario.</p>
          </div>
        )}

        {/* Kit cards */}
        {!loading && kits.map(kit => {
          const entrySensor = kit.sensors?.find(s => s.position === 'entry');
          const exitSensor = kit.sensors?.find(s => s.position === 'exit');
          const gymName = kit.gym_branches?.gyms?.name ?? '—';
          const branchName = kit.gym_branches?.name ?? '—';
          const isExpanded = expandedKit === kit.id;

          const kitOnline = [entrySensor, exitSensor].filter(Boolean).every(s => s && isOnline(s.last_heartbeat) && s.status !== 'retired');
          const kitPartial = [entrySensor, exitSensor].some(s => s && isOnline(s.last_heartbeat) && s?.status !== 'retired');
          const kitBadgeColor = kitOnline ? 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/20'
            : kitPartial ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-[#CC0000]/5 text-[#CC0000] border-[#CC0000]/20';
          const kitBadgeLabel = kitOnline ? 'Par activo' : kitPartial ? 'Parcial' : 'Sin señal';

          return (
            <div key={kit.id} className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden shadow-sm">
              {/* Kit header */}
              <button
                className="w-full p-4 text-left"
                onClick={() => setExpandedKit(isExpanded ? null : kit.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1 flex-wrap mb-1">
                      <span className="text-[10px] font-bold text-[#CC0000] uppercase tracking-wide">{gymName}</span>
                      <span className="text-[10px] text-[#CCC]">›</span>
                      <span className="text-[10px] text-[#666]">{branchName}</span>
                    </div>
                    <p className="font-bold text-[#111] text-sm">{kit.name}</p>
                    <p className="text-[10px] text-[#999] mt-0.5">
                      Registrado {fmtDate(kit.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${kitBadgeColor}`}>
                      {kitBadgeLabel}
                    </span>
                    {isExpanded ? <ChevronUp size={14} className="text-[#999]" /> : <ChevronDown size={14} className="text-[#999]" />}
                  </div>
                </div>

                {/* Sensor pair preview */}
                <div className="flex gap-2 mt-3">
                  <div className="flex-1">
                    <p className="text-[9px] font-bold text-[#999] uppercase mb-1">Entrada</p>
                    <SensorPill sensor={entrySensor} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-bold text-[#999] uppercase mb-1">Salida</p>
                    <SensorPill sensor={exitSensor} />
                  </div>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-[#F5F5F5] p-4 space-y-4 bg-[#FAFAFA]">
                  {([['entry', 'Entrada', entrySensor], ['exit', 'Salida', exitSensor]] as const).map(([pos, posLabel, sensor]) => (
                    <div key={pos} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-[#444]">
                          <span className={pos === 'entry' ? 'text-[#16A34A]' : 'text-[#CC0000]'}>● </span>
                          Sensor de {posLabel}
                        </p>
                        {sensor && (
                          <button
                            onClick={() => openReplace(kit, pos)}
                            className="flex items-center gap-1 text-[10px] font-bold text-[#CC0000] hover:underline"
                          >
                            <ArrowRightLeft size={10} /> Sustituir
                          </button>
                        )}
                      </div>
                      {sensor ? (
                        <div className="bg-white rounded-xl border border-[#E5E5E5] p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-[#111]">{sensor.brand} {sensor.model}</p>
                            <SensorPill sensor={sensor} />
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                            <div>
                              <p className="text-[#999]">Número de serie</p>
                              <p className="font-mono font-bold text-[#444]">{sensor.serial_number || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[#999]">Instalado</p>
                              <p className="font-bold text-[#444]">{fmtDate(sensor.installation_date)}</p>
                            </div>
                            <div>
                              <p className="text-[#999]">Último ping</p>
                              <p className="font-bold text-[#444] flex items-center gap-1">
                                <Clock size={9} /> {fmtDate(sensor.last_heartbeat)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[#999]">Secret key</p>
                              <button
                                onClick={() => navigator.clipboard.writeText(sensor.secret_key).then(() => showToast('Clave copiada', 'success'))}
                                className="font-mono font-bold text-[#CC0000] hover:underline truncate max-w-[80px] block"
                              >
                                {sensor.secret_key.slice(0, 8)}… Copiar
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => simulatePing(sensor.id)}
                            className="mt-1 flex items-center gap-1.5 px-3 py-1.5 bg-[#F0FDF4] border border-[#16A34A]/30 text-[#16A34A] text-[10px] font-bold rounded-lg hover:bg-[#16A34A]/10 transition-colors"
                          >
                            <Radio size={10} /> Simular Ping
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border-2 border-dashed border-[#E5E5E5] p-4 text-center">
                          <p className="text-xs text-[#999]">Sin sensor en posición {posLabel.toLowerCase()}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={() => deleteKit(kit.id)}
                    className="w-full py-2 border border-[#E5E5E5] rounded-xl text-xs font-bold text-[#CC0000] hover:bg-[#CC0000]/5 transition-colors"
                  >
                    Eliminar kit
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
