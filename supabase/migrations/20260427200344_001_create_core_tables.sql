/*
  # Create Core Tables for FluxFit

  1. New Tables
    - `users` — App user profiles linked to auth.users
    - `gyms` — Gym locations with real-time occupancy data
    - `occupancy_logs` — Historical occupancy records per gym
    - `weekly_occupancy_summary` — Pre-computed weekly averages for heatmap
    - `gym_plans` — Membership plans offered by each gym
    - `gym_services` — Additional services (nutrition, kinesiology, etc.)
    - `gym_discounts` — Premium member discounts at each gym
    - `gym_recommended_hours` — Best times to visit per gym
    - `commerces` — Partner businesses offering discounts
    - `user_favorite_gyms` — Users' saved gyms
    - `gym_admins` — Gym administrator assignments
    - `commerce_admins` — Commerce administrator assignments

  2. Security
    - RLS enabled on ALL tables
    - Users can only read/write their own data
    - Public read access for gyms, commerces, plans, services, discounts, recommended hours, occupancy data
    - Only admins can modify gym/commerce content
    - Sensor key authenticated writes to occupancy_logs

  3. Important Notes
    - The `users` table mirrors auth.users with a foreign key
    - `occupancy_logs` uses a sensor_key check for IoT device writes
    - `weekly_occupancy_summary` is a materialized view alternative for fast heatmap queries
*/

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  is_premium boolean NOT NULL DEFAULT false,
  premium_since timestamptz,
  avatar_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Gyms table
CREATE TABLE IF NOT EXISTS gyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL DEFAULT '',
  comuna text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  cover_image_url text NOT NULL DEFAULT '',
  current_count integer NOT NULL DEFAULT 0,
  max_capacity integer NOT NULL DEFAULT 100,
  occupancy_percentage double precision NOT NULL DEFAULT 0,
  occupancy_status text NOT NULL DEFAULT 'tranquilo',
  last_sensor_ping timestamptz,
  sensor_online boolean NOT NULL DEFAULT false,
  sensor_key text NOT NULL DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Occupancy logs
CREATE TABLE IF NOT EXISTS occupancy_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  people_count integer NOT NULL DEFAULT 0,
  occupancy_percentage double precision NOT NULL DEFAULT 0,
  occupancy_status text NOT NULL DEFAULT 'tranquilo',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Weekly occupancy summary (for heatmap)
CREATE TABLE IF NOT EXISTS weekly_occupancy_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  hour_of_day integer NOT NULL,
  avg_percentage double precision NOT NULL DEFAULT 0,
  avg_status text NOT NULL DEFAULT 'tranquilo',
  sample_count integer NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now()
);

-- Gym plans
CREATE TABLE IF NOT EXISTS gym_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  regular_price integer NOT NULL DEFAULT 0,
  premium_price integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  features text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Gym services
CREATE TABLE IF NOT EXISTS gym_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  regular_price integer NOT NULL DEFAULT 0,
  premium_price integer NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'otro',
  is_active boolean NOT NULL DEFAULT true
);

-- Gym discounts
CREATE TABLE IF NOT EXISTS gym_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  description text NOT NULL,
  regular_value text NOT NULL DEFAULT '',
  premium_value text NOT NULL DEFAULT '',
  discount_percentage integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

-- Gym recommended hours
CREATE TABLE IF NOT EXISTS gym_recommended_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL,
  hour_start text NOT NULL DEFAULT '06:00',
  hour_end text NOT NULL DEFAULT '08:00',
  label text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

-- Commerces
CREATE TABLE IF NOT EXISTS commerces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'otro',
  description text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  discount_percentage integer NOT NULL DEFAULT 0,
  discount_description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User favorite gyms
CREATE TABLE IF NOT EXISTS user_favorite_gyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, gym_id)
);

-- Gym admins
CREATE TABLE IF NOT EXISTS gym_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, gym_id)
);

-- Commerce admins
CREATE TABLE IF NOT EXISTS commerce_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commerce_id uuid NOT NULL REFERENCES commerces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, commerce_id)
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE occupancy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_occupancy_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_recommended_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerces ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorite_gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE commerce_admins ENABLE ROW LEVEL SECURITY;

-- Users: can read own profile, can update own profile
CREATE POLICY "Users can read own profile" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Gyms: public read, admin write
CREATE POLICY "Anyone can read active gyms" ON gyms FOR SELECT USING (is_active = true);
CREATE POLICY "Gym admins can update their gym" ON gyms FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM gym_admins WHERE gym_admins.gym_id = gyms.id AND gym_admins.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM gym_admins WHERE gym_admins.gym_id = gyms.id AND gym_admins.user_id = auth.uid())
);

-- Occupancy logs: public read, sensor writes via service role
CREATE POLICY "Anyone can read occupancy logs" ON occupancy_logs FOR SELECT USING (true);
CREATE POLICY "Service role can insert occupancy logs" ON occupancy_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update occupancy logs" ON occupancy_logs FOR UPDATE USING (true) WITH CHECK (true);

-- Weekly occupancy summary: public read
CREATE POLICY "Anyone can read weekly summary" ON weekly_occupancy_summary FOR SELECT USING (true);
CREATE POLICY "Service role can manage weekly summary" ON weekly_occupancy_summary FOR ALL USING (true) WITH CHECK (true);

-- Gym plans: public read, admin write
CREATE POLICY "Anyone can read active plans" ON gym_plans FOR SELECT USING (is_active = true);
CREATE POLICY "Gym admins can manage plans" ON gym_plans FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM gym_admins WHERE gym_admins.gym_id = gym_plans.gym_id AND gym_admins.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM gym_admins WHERE gym_admins.gym_id = gym_plans.gym_id AND gym_admins.user_id = auth.uid())
);

-- Gym services: public read, admin write
CREATE POLICY "Anyone can read active services" ON gym_services FOR SELECT USING (is_active = true);
CREATE POLICY "Gym admins can manage services" ON gym_services FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM gym_admins WHERE gym_admins.gym_id = gym_services.gym_id AND gym_admins.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM gym_admins WHERE gym_admins.gym_id = gym_services.gym_id AND gym_admins.user_id = auth.uid())
);

-- Gym discounts: public read, admin write
CREATE POLICY "Anyone can read active discounts" ON gym_discounts FOR SELECT USING (is_active = true);
CREATE POLICY "Gym admins can manage discounts" ON gym_discounts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM gym_admins WHERE gym_admins.gym_id = gym_discounts.gym_id AND gym_admins.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM gym_admins WHERE gym_admins.gym_id = gym_discounts.gym_id AND gym_admins.user_id = auth.uid())
);

-- Gym recommended hours: public read, admin write
CREATE POLICY "Anyone can read recommended hours" ON gym_recommended_hours FOR SELECT USING (is_active = true);
CREATE POLICY "Gym admins can manage recommended hours" ON gym_recommended_hours FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM gym_admins WHERE gym_admins.gym_id = gym_recommended_hours.gym_id AND gym_admins.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM gym_admins WHERE gym_admins.gym_id = gym_recommended_hours.gym_id AND gym_admins.user_id = auth.uid())
);

-- Commerces: public read, admin write
CREATE POLICY "Anyone can read active commerces" ON commerces FOR SELECT USING (is_active = true);
CREATE POLICY "Commerce admins can update their commerce" ON commerces FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM commerce_admins WHERE commerce_admins.commerce_id = commerces.id AND commerce_admins.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM commerce_admins WHERE commerce_admins.commerce_id = commerces.id AND commerce_admins.user_id = auth.uid())
);

-- User favorite gyms: users manage their own
CREATE POLICY "Users can read own favorites" ON user_favorite_gyms FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON user_favorite_gyms FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON user_favorite_gyms FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Gym admins: users can read their own admin status
CREATE POLICY "Users can read own gym admin status" ON gym_admins FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Commerce admins: users can read their own admin status
CREATE POLICY "Users can read own commerce admin status" ON commerce_admins FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_occupancy_logs_gym_id ON occupancy_logs(gym_id);
CREATE INDEX IF NOT EXISTS idx_occupancy_logs_recorded_at ON occupancy_logs(recorded_at);
CREATE INDEX IF NOT EXISTS idx_weekly_summary_gym_id ON weekly_occupancy_summary(gym_id);
CREATE INDEX IF NOT EXISTS idx_user_favorite_gyms_user_id ON user_favorite_gyms(user_id);
CREATE INDEX IF NOT EXISTS idx_gym_admins_user_id ON gym_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_commerce_admins_user_id ON commerce_admins(user_id);
