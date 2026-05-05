import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatCLP } from '../lib/utils';
import type { Commerce, GymDiscount, GymPlan, GymService } from '../lib/types';

type DiscountsTab = 'gym' | 'comercios';

type CouponCard = {
  id: string;
  titulo: string;
  descripcion: string;
  descuento: string;
};

type CommerceWithCoupons = {
  id: string;
  local: string;
  cupones: CouponCard[];
};

const mockGymCoupons: CouponCard[] = [
  {
    id: 'gym-1',
    titulo: 'Plan Full Mensual',
    descripcion: 'Acceso completo a sala, maquinas y clases dirigidas.',
    descuento: '20% OFF',
  },
  {
    id: 'gym-2',
    titulo: 'Pack Entrenamiento + Nutricion',
    descripcion: 'Incluye evaluacion inicial y seguimiento de 4 semanas.',
    descuento: '$15.000 de descuento',
  },
  {
    id: 'gym-3',
    titulo: 'Membresia Premium Nuevo Socio',
    descripcion: 'Beneficio aplicable durante el primer mes.',
    descuento: '30% OFF',
  },
];

const mockCommerceCoupons: CommerceWithCoupons[] = [
  {
    id: 'commerce-1',
    local: 'NutriMarket Providencia',
    cupones: [
      {
        id: 'commerce-1-coupon-1',
        titulo: 'Proteina Whey 1kg',
        descripcion: 'Valido para productos seleccionados en tienda.',
        descuento: '15% OFF',
      },
      {
        id: 'commerce-1-coupon-2',
        titulo: 'Combo Snack Fitness',
        descripcion: 'Barra + bebida isotonic + frutos secos.',
        descuento: '2x1',
      },
    ],
  },
  {
    id: 'commerce-2',
    local: 'MoveWear Las Condes',
    cupones: [
      {
        id: 'commerce-2-coupon-1',
        titulo: 'Calzas deportivas',
        descripcion: 'Descuento aplicable en segunda unidad.',
        descuento: '25% OFF',
      },
    ],
  },
];

const DISCOUNTS_DATA_SOURCE: 'mock' | 'backend' = 'mock';

export function DiscountsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<DiscountsTab>('gym');
  const [gymCoupons, setGymCoupons] = useState<CouponCard[]>(mockGymCoupons);
  const [commerceCoupons, setCommerceCoupons] = useState<CommerceWithCoupons[]>(mockCommerceCoupons);
  const isPremium = user?.plan === 'premium';

  useEffect(() => {
    if (DISCOUNTS_DATA_SOURCE === 'mock') return;

    const fetchBackendData = async () => {
      const { data: gyms } = await supabase
        .from('gyms')
        .select('id, name')
        .eq('is_active', true)
        .eq('approval_status', 'approved');

      const gymIds = (gyms ?? []).map((g) => g.id);
      const gymNameById = new Map((gyms ?? []).map((g) => [g.id, g.name]));

      if (gymIds.length > 0) {
        const [{ data: plans }, { data: services }, { data: discounts }] = await Promise.all([
          supabase
            .from('gym_plans')
            .select('id, gym_id, name, regular_price, premium_price')
            .in('gym_id', gymIds),
          supabase
            .from('gym_services')
            .select('id, gym_id, name, regular_price, premium_price')
            .in('gym_id', gymIds),
          supabase
            .from('gym_discounts')
            .select('id, gym_id, description, discount_percentage')
            .in('gym_id', gymIds),
        ]);

        const planCards: CouponCard[] = ((plans ?? []) as GymPlan[])
          .filter((p) => p.premium_price < p.regular_price)
          .map((p) => ({
            id: `plan-${p.id}`,
            titulo: `${gymNameById.get(p.gym_id) ?? 'Gym'} - ${p.name}`,
            descripcion: 'Precio exclusivo Fluxfit para plan.',
            descuento: `${formatCLP(p.regular_price)} -> ${formatCLP(p.premium_price)}`,
          }));

        const serviceCards: CouponCard[] = ((services ?? []) as GymService[])
          .filter((s) => s.premium_price < s.regular_price)
          .map((s) => ({
            id: `service-${s.id}`,
            titulo: `${gymNameById.get(s.gym_id) ?? 'Gym'} - ${s.name}`,
            descripcion: 'Precio exclusivo Fluxfit para servicio.',
            descuento: `${formatCLP(s.regular_price)} -> ${formatCLP(s.premium_price)}`,
          }));

        const discountCards: CouponCard[] = ((discounts ?? []) as GymDiscount[]).map((d) => ({
          id: `discount-${d.id}`,
          titulo: gymNameById.get(d.gym_id) ?? 'Gym',
          descripcion: d.description,
          descuento: `-${d.discount_percentage}%`,
        }));

        setGymCoupons([...planCards, ...serviceCards, ...discountCards]);
      }

      const { data: commerces } = await supabase
        .from('commerces')
        .select('*')
        .eq('is_active', true)
        .eq('approval_status', 'approved');

      const mappedCommerceCoupons: CommerceWithCoupons[] = ((commerces ?? []) as Commerce[]).map((c) => ({
        id: c.id,
        local: c.name,
        cupones: [
          {
            id: `commerce-${c.id}-discount`,
            titulo: 'Descuento Fluxfit',
            descripcion: c.discount_description || 'Beneficio disponible para usuarios premium.',
            descuento: `-${c.discount_percentage}%`,
          },
        ],
      }));

      setCommerceCoupons(mappedCommerceCoupons);
    };

    fetchBackendData();
  }, []);

  if (!isPremium) {
    return (
      <div className="space-y-4">
        <div className="bg-[#111111] px-4 pt-6 pb-4">
          <p className="text-white/50 text-xs mb-0.5">GoFitNow</p>
          <h1 className="text-white font-bold text-xl">Descuentos Fluxfit</h1>
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
        <h1 className="text-white font-bold text-xl">Descuentos Fluxfit</h1>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] p-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('gym')}
            className={`px-4 py-2 text-sm font-bold rounded-full transition-colors ${
              activeTab === 'gym'
                ? 'bg-[#CC0000] text-white'
                : 'bg-white border border-[#E5E5E5] text-[#666] hover:border-[#CC0000] hover:text-[#CC0000]'
            }`}
          >
            Descuentos Gym
          </button>
          <button
            onClick={() => setActiveTab('comercios')}
            className={`px-4 py-2 text-sm font-bold rounded-full transition-colors ${
              activeTab === 'comercios'
                ? 'bg-[#CC0000] text-white'
                : 'bg-white border border-[#E5E5E5] text-[#666] hover:border-[#CC0000] hover:text-[#CC0000]'
            }`}
          >
            Descuentos Comercios
          </button>
        </div>
      </div>

      {activeTab === 'gym' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {gymCoupons.map((coupon) => (
            <div key={coupon.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4">
              <p className="text-sm font-bold text-[#111]">{coupon.titulo}</p>
              <p className="text-sm text-[#666] mt-1.5">{coupon.descripcion}</p>
              <p className="text-sm font-bold text-[#16A34A] mt-3">{coupon.descuento}</p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'comercios' && (
        <div className="space-y-4">
          {commerceCoupons.map((local) => (
            <div key={local.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4">
              <h2 className="text-[#111] font-bold text-base">{local.local}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {local.cupones.map((coupon) => (
                  <div key={coupon.id} className="bg-[#FAFAFA] rounded-xl border border-[#EDEDED] p-4">
                    <p className="text-sm font-bold text-[#111]">{coupon.titulo}</p>
                    <p className="text-sm text-[#666] mt-1.5">{coupon.descripcion}</p>
                    <p className="text-sm font-bold text-[#16A34A] mt-3">{coupon.descuento}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
