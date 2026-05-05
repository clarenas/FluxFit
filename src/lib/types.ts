export type OccupancyStatus = 'tranquilo' | 'moderado' | 'lleno';
export type ServiceCategory = 'nutricion' | 'kinesiologia' | 'entrenamiento' | 'otro';
export type CommerceCategory = 'nutricion' | 'suplementos' | 'indumentaria' | 'fisioterapia' | 'otro';

export interface User {
  id: string;
  email: string;
  full_name: string;
  rut: string | null;
  is_premium: boolean;
  premium_since: string | null;
  plan: string;
  plan_price: number;
  plan_valid_until: string | null;
  is_active: boolean;
  last_expiry_notification: string | null;
  avatar_url: string;
  created_at: string;
  role: string;
}

export interface Gym {
  id: string;
  name: string;
  address: string;
  comuna: string;
  region: string;
  phone: string;
  website: string;
  description: string;
  logo_url: string;
  cover_image_url: string;
  current_count: number;
  max_capacity: number;
  occupancy_percentage: number;
  occupancy_status: OccupancyStatus;
  last_sensor_ping: string | null;
  sensor_online: boolean;
  sensor_key: string;
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  plan?: 'free' | 'light' | 'pro';
  billing_cycle?: 'monthly' | 'yearly';
  created_at: string;
}

export interface OccupancyLog {
  id: string;
  gym_id: string;
  people_count: number;
  occupancy_percentage: number;
  occupancy_status: OccupancyStatus;
  recorded_at: string;
}

export interface GymPlan {
  id: string;
  gym_id: string;
  name: string;
  regular_price: number;
  premium_price: number;
  description: string;
  features: string[];
  is_active: boolean;
  created_at: string;
}

export interface GymService {
  id: string;
  gym_id: string;
  name: string;
  description: string;
  regular_price: number;
  premium_price: number;
  category: ServiceCategory;
  is_active: boolean;
}

export interface GymDiscount {
  id: string;
  gym_id: string;
  branch_id?: string | null;
  title?: string;
  type?: 'plan_gym' | 'nutricion' | 'evaluacion_corporal' | 'personal_training' | string;
  description: string;
  discount_value?: number;
  active?: boolean;
  regular_value: string;
  premium_value: string;
  discount_percentage: number;
  is_active: boolean;
  coupon_code?: string;
  qr_payload?: string;
  created_at?: string;
}

export interface GymRecommendedHour {
  id: string;
  gym_id: string;
  day_of_week: number;
  hour_start: string;
  hour_end: string;
  label: string;
  is_active: boolean;
}

export interface WeeklyOccupancySummary {
  id: string;
  gym_id: string;
  day_of_week: number;
  hour_of_day: number;
  avg_percentage: number;
  avg_status: string;
  sample_count: number;
  last_updated: string;
}

export interface Commerce {
  id: string;
  name: string;
  category: CommerceCategory;
  description: string;
  logo_url: string;
  address: string;
  website: string;
  discount_percentage: number;
  discount_description: string;
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface CouponRedemption {
  id: string;
  user_id: string;
  commerce_id: string | null;
  gym_id: string | null;
  coupon_code: string;
  redeemed_at: string;
  validated_by: string | null;
}

export interface UserFavoriteGym {
  id: string;
  user_id: string;
  gym_id: string;
  created_at: string;
}

export interface GymAdmin {
  id: string;
  user_id: string;
  gym_id: string;
  created_at: string;
}

export interface CommerceAdmin {
  id: string;
  user_id: string;
  commerce_id: string;
  created_at: string;
}

export interface GymBranch {
  id: string;
  gym_id: string;
  name: string;
  address: string;
  comuna: string;
  phone: string;
  current_count: number;
  max_capacity: number;
  occupancy_percentage: number;
  occupancy_status: OccupancyStatus;
  last_sensor_ping: string | null;
  sensor_online: boolean;
  sensor_key: string;
  is_active: boolean;
  created_at: string;
}

export interface GymPromotion {
  id: string;
  gym_id: string;
  name: string;
  description: string;
  discount_percentage: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

/** Plan comercial del gym (oferta con vigencia y cupón). No confundir con la suscripción GoFitNow (free/light/pro). */
export type GymPlanOfferTipo = 'mensual' | 'anual' | 'personal_trainer';

/**
 * Oferta de plan con precio tachado/oferta, vigencia y sedes.
 * `plazo_inicio` / `plazo_fin`: fechas ISO (ej. 2026-05-01).
 * `codigo_cupon` y `qr_url` se rellenan al persistir (generación automática).
 */
export interface GymPlanOffer {
  nombre: string;
  descripcion: string;
  valor_normal: number;
  valor_oferta: number;
  plazo_inicio: string;
  plazo_fin: string;
  sedes_aplicables: string[];
  tipo_plan: GymPlanOfferTipo;
  codigo_cupon: string;
  qr_url: string;
}

/** Datos que ingresa el admin antes de generar cupón y QR. */
export type GymPlanOfferDraft = Omit<GymPlanOffer, 'codigo_cupon' | 'qr_url'>;

/** Fila persistida (p. ej. tabla futura `gym_plan_offers` o extensión de `gym_plans`). */
export interface GymPlanOfferRow extends GymPlanOffer {
  id: string;
  gym_id: string;
  is_active?: boolean;
  created_at?: string;
}

/** Texto fijo para UI / cupón impreso (puedes igualarlo al guardar en `instruccion`). */
export const GYM_PROMO_CUPON_INSTRUCCION_DEFAULT =
  'Descarga tu cupón y preséntalo en tu sucursal';

/**
 * Promoción tipo cupón (% o monto fijo, vigencia y sedes).
 * `porcentaje_descuento` y `valor_descuento`: usa el que aplique (el otro puede ser 0).
 * Fechas en ISO. `codigo_cupon` se genera al persistir; `instruccion` suele ser {@link GYM_PROMO_CUPON_INSTRUCCION_DEFAULT}.
 */
export interface GymPromocionCupon {
  titulo: string;
  descripcion: string;
  porcentaje_descuento: number;
  valor_descuento: number;
  validez_inicio: string;
  validez_fin: string;
  sedes_aplicables: string[];
  codigo_cupon: string;
  instruccion: string;
}

export type GymPromocionCuponDraft = Omit<GymPromocionCupon, 'codigo_cupon' | 'instruccion'>;

export interface GymPromocionCuponRow extends GymPromocionCupon {
  id: string;
  gym_id: string;
  is_active?: boolean;
  created_at?: string;
}

export interface CommerceStore {
  id: string;
  commerce_id: string;
  name: string;
  address: string;
  comuna: string;
  phone: string;
  schedule: string;
  is_active: boolean;
  created_at: string;
}

export interface CommerceProduct {
  id: string;
  commerce_id: string;
  name: string;
  description: string;
  price: number;
  premium_price: number;
  image_url: string;
  is_active: boolean;
  created_at: string;
}

export interface CommerceCoupon {
  id: string;
  commerce_id: string;
  code: string;
  description: string;
  discount_percentage: number;
  expires_at: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
}
