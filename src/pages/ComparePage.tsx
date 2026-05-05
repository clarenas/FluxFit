import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCLP } from '../lib/utils';

type CompareTab = 'planes' | 'ocupacion';

type GymLite = { id: string; name: string; comuna?: string | null };
type PlanLite = { id: string; gym_id: string; name: string; regular_price: number; premium_price: number; features: string[] | null };
type BranchLite = { id: string; gym_id: string; name: string; occupancy_status: 'tranquilo' | 'moderado' | 'lleno' | string; occupancy_percentage: number };

export function ComparePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<CompareTab>('planes');
  const [loading, setLoading] = useState(true);
  const [gyms, setGyms] = useState<GymLite[]>([]);
  const [plans, setPlans] = useState<PlanLite[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [selectedGyms, setSelectedGyms] = useState<string[]>([]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedComuna, setSelectedComuna] = useState<string>('Todas');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todas');
  const [sortBy, setSortBy] = useState<'best_price' | 'name'>('best_price');
  const [occupancyComuna, setOccupancyComuna] = useState<string>('Todas');
  const [occupancyEstado, setOccupancyEstado] = useState<'todos' | 'tranquilo' | 'moderado' | 'lleno'>('todos');

  const isPremium = user?.plan === 'premium';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [gymsRes, plansRes, branchesRes] = await Promise.all([
        supabase.from('gyms').select('id, name, comuna').eq('is_active', true).eq('approval_status', 'approved').order('name'),
        supabase.from('gym_plans').select('id, gym_id, name, regular_price, premium_price, features'),
        supabase.from('gym_branches').select('id, gym_id, name, occupancy_status, occupancy_percentage'),
      ]);
      setGyms((gymsRes.data ?? []) as GymLite[]);
      setPlans((plansRes.data ?? []) as PlanLite[]);
      setBranches((branchesRes.data ?? []) as BranchLite[]);
      setLoading(false);
    };
    fetchData();
  }, []);

  const gymNameById = useMemo(() => new Map(gyms.map((g) => [g.id, g.name])), [gyms]);

  const comparedPlans = useMemo(
    () => {
      const gymComunaById = new Map(gyms.map((g) => [g.id, g.comuna ?? '']));
      const base = plans.filter((p) => selectedGyms.includes(p.gym_id)).filter((p) => {
        const comuna = gymComunaById.get(p.gym_id) ?? '';
        const matchesComuna = selectedComuna === 'Todas' || comuna === selectedComuna;
        const matchesCategoria =
          selectedCategoria === 'Todas' || p.name.toLowerCase().includes(selectedCategoria.toLowerCase());
        return matchesComuna && matchesCategoria;
      });

      return [...base].sort((a, b) => {
        if (sortBy === 'best_price') {
          const aPrice = a.premium_price || a.regular_price;
          const bPrice = b.premium_price || b.regular_price;
          return aPrice - bPrice;
        }
        return a.name.localeCompare(b.name);
      });
    },
    [plans, selectedGyms, gyms, selectedComuna, selectedCategoria, sortBy]
  );

  const comparedBranches = useMemo(() => {
    const gymComunaById = new Map(gyms.map((g) => [g.id, g.comuna ?? '']));
    return branches
      .filter((b) => selectedBranches.includes(b.id))
      .filter((b) => {
        const comuna = gymComunaById.get(b.gym_id) ?? '';
        const matchesComuna = occupancyComuna === 'Todas' || comuna === occupancyComuna;
        const matchesEstado = occupancyEstado === 'todos' || b.occupancy_status === occupancyEstado;
        return matchesComuna && matchesEstado;
      });
  }, [branches, selectedBranches, gyms, occupancyComuna, occupancyEstado]);

  const comunas = useMemo(
    () => ['Todas', ...Array.from(new Set(gyms.map((g) => g.comuna).filter(Boolean) as string[])).sort()],
    [gyms]
  );

  const categorias = useMemo(() => {
    const normalized = new Set<string>();
    plans.forEach((plan) => {
      const name = plan.name.toLowerCase();
      if (name.includes('full')) normalized.add('full');
      else if (name.includes('premium')) normalized.add('premium');
      else if (name.includes('basico') || name.includes('básico')) normalized.add('basico');
      else if (name.includes('pro')) normalized.add('pro');
    });
    return ['Todas', ...Array.from(normalized)];
  }, [plans]);

  const toggleGym = (gymId: string) => {
    setSelectedGyms((prev) => prev.includes(gymId) ? prev.filter((id) => id !== gymId) : [...prev, gymId]);
  };

  const toggleBranch = (branchId: string) => {
    setSelectedBranches((prev) => prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]);
  };

  const occupancyStyle = (status: string) => {
    if (status === 'tranquilo') return 'bg-green-100 text-green-700';
    if (status === 'moderado') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const occupancyLabel = (status: string) => {
    if (status === 'tranquilo') return 'Bajo';
    if (status === 'moderado') return 'Medio';
    return 'Alto';
  };

  if (!isPremium) {
    return (
      <div className="space-y-4">
        <div className="bg-[#111111] px-4 pt-6 pb-4">
          <p className="text-white/50 text-xs mb-0.5">GoFitNow</p>
          <h1 className="text-white font-bold text-xl">Comparar</h1>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 text-sm text-[#666]">
          Disponible en plan premium.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#111111] px-4 pt-6 pb-4">
        <p className="text-white/50 text-xs mb-0.5">GoFitNow</p>
        <h1 className="text-white font-bold text-xl">Comparar</h1>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] p-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('planes')}
            className={`px-4 py-2 text-sm font-bold rounded-full transition-colors ${
              activeTab === 'planes'
                ? 'bg-[#CC0000] text-white'
                : 'bg-white border border-[#E5E5E5] text-[#666] hover:border-[#CC0000] hover:text-[#CC0000]'
            }`}
          >
            Comparar Planes
          </button>
          <button
            onClick={() => setActiveTab('ocupacion')}
            className={`px-4 py-2 text-sm font-bold rounded-full transition-colors ${
              activeTab === 'ocupacion'
                ? 'bg-[#CC0000] text-white'
                : 'bg-white border border-[#E5E5E5] text-[#666] hover:border-[#CC0000] hover:text-[#CC0000]'
            }`}
          >
            Comparar Ocupacion
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 text-sm text-[#666]">Cargando comparador...</div>
      )}

      {!loading && activeTab === 'planes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
            <p className="text-sm font-bold text-[#111]">Selecciona 2 o mas gimnasios</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                value={selectedComuna}
                onChange={(e) => setSelectedComuna(e.target.value)}
                className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm text-[#111] bg-white"
              >
                {comunas.map((comuna) => (
                  <option key={comuna} value={comuna}>{comuna}</option>
                ))}
              </select>
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm text-[#111] bg-white"
              >
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria}>{categoria === 'Todas' ? 'Todas las categorias' : `Categoria: ${categoria}`}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'best_price' | 'name')}
                className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm text-[#111] bg-white"
              >
                <option value="best_price">Orden: mejor precio premium</option>
                <option value="name">Orden: nombre plan</option>
              </select>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {gyms.map((gym) => (
                <label key={gym.id} className="flex items-center gap-2 border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm text-[#111]">
                  <input type="checkbox" checked={selectedGyms.includes(gym.id)} onChange={() => toggleGym(gym.id)} />
                  {gym.name}
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 overflow-x-auto">
            {selectedGyms.length < 2 ? (
              <p className="text-sm text-[#666]">Debes seleccionar al menos 2 gimnasios para comparar planes.</p>
            ) : comparedPlans.length === 0 ? (
              <p className="text-sm text-[#666]">No hay planes para los gimnasios seleccionados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5E5E5] text-left">
                    <th className="py-2 pr-3 font-bold text-[#111]">Gym</th>
                    <th className="py-2 pr-3 font-bold text-[#111]">Nombre plan</th>
                    <th className="py-2 pr-3 font-bold text-[#111]">Precio</th>
                    <th className="py-2 font-bold text-[#111]">Beneficios</th>
                  </tr>
                </thead>
                <tbody>
                  {comparedPlans.map((plan) => (
                    <tr key={plan.id} className="border-b border-[#F3F3F3] align-top">
                      <td className="py-2 pr-3 text-[#111]">{gymNameById.get(plan.gym_id) ?? 'Gym'}</td>
                      <td className="py-2 pr-3 text-[#111]">{plan.name}</td>
                      <td className="py-2 pr-3 text-[#16A34A] font-bold">{formatCLP(plan.premium_price || plan.regular_price)}</td>
                      <td className="py-2 text-[#666]">{plan.features?.length ? plan.features.join(', ') : 'Sin beneficios especificados'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {!loading && activeTab === 'ocupacion' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
            <p className="text-sm font-bold text-[#111]">Selecciona sucursales (mismo gym o distintos gyms)</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                value={occupancyComuna}
                onChange={(e) => setOccupancyComuna(e.target.value)}
                className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm text-[#111] bg-white"
              >
                {comunas.map((comuna) => (
                  <option key={comuna} value={comuna}>{comuna}</option>
                ))}
              </select>
              <select
                value={occupancyEstado}
                onChange={(e) => setOccupancyEstado(e.target.value as 'todos' | 'tranquilo' | 'moderado' | 'lleno')}
                className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm text-[#111] bg-white"
              >
                <option value="todos">Estado: todos</option>
                <option value="tranquilo">Estado: bajo</option>
                <option value="moderado">Estado: medio</option>
                <option value="lleno">Estado: alto</option>
              </select>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {branches.map((branch) => (
                <label key={branch.id} className="flex items-center gap-2 border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm text-[#111]">
                  <input type="checkbox" checked={selectedBranches.includes(branch.id)} onChange={() => toggleBranch(branch.id)} />
                  {gymNameById.get(branch.gym_id) ?? 'Gym'} - {branch.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedBranches.length < 2 ? (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-sm text-[#666]">
                Debes seleccionar al menos 2 sucursales para comparar ocupacion.
              </div>
            ) : comparedBranches.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-4 text-sm text-[#666]">
                No hay sucursales que coincidan con los filtros seleccionados.
              </div>
            ) : (
              comparedBranches.map((branch) => (
                <div key={branch.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4">
                  <p className="text-sm font-bold text-[#111]">{gymNameById.get(branch.gym_id) ?? 'Gym'}</p>
                  <p className="text-xs text-[#666] mt-1">{branch.name}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${occupancyStyle(branch.occupancy_status)}`}>
                      {occupancyLabel(branch.occupancy_status)}
                    </span>
                    <span className="text-sm font-bold text-[#111]">{Math.round(branch.occupancy_percentage)}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
