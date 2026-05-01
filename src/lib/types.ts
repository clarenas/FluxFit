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
  description: string;
  regular_value: string;
  premium_value: string;
  discount_percentage: number;
  is_active: boolean;
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
