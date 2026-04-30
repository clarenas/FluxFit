/*
  # Three-sided marketplace: pending status + coupon redemptions

  1. Changes to existing tables
    - `gyms`: add `approval_status` column ('pending' | 'approved' | 'rejected'), default 'approved' for existing rows
    - `commerces`: add `approval_status` column ('pending' | 'approved' | 'rejected'), default 'approved' for existing rows

  2. New Tables
    - `coupon_redemptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, fk users)
      - `commerce_id` (uuid, fk commerces, nullable)
      - `gym_id` (uuid, fk gyms, nullable)
      - `coupon_code` (text)
      - `redeemed_at` (timestamptz)
      - `validated_by` (uuid, fk users)

  3. Security
    - RLS enabled on coupon_redemptions
    - Role-based access for gym admins, commerce admins, and users
*/

-- Add approval_status to gyms
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gyms' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE gyms ADD COLUMN approval_status text NOT NULL DEFAULT 'approved';
  END IF;
END $$;

-- Add approval_status to commerces
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'commerces' AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE commerces ADD COLUMN approval_status text NOT NULL DEFAULT 'approved';
  END IF;
END $$;

-- Create coupon_redemptions table
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commerce_id uuid REFERENCES commerces(id) ON DELETE SET NULL,
  gym_id uuid REFERENCES gyms(id) ON DELETE SET NULL,
  coupon_code text NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  validated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own redemptions
CREATE POLICY "Users can view own redemptions"
  ON coupon_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Gym admins can insert redemptions for their gym
CREATE POLICY "Gym admins can insert gym redemptions"
  ON coupon_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (
    gym_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM gym_admins
      WHERE gym_admins.gym_id = coupon_redemptions.gym_id
        AND gym_admins.user_id = auth.uid()
    )
  );

-- Commerce admins can insert redemptions for their commerce
CREATE POLICY "Commerce admins can insert commerce redemptions"
  ON coupon_redemptions FOR INSERT
  TO authenticated
  WITH CHECK (
    commerce_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM commerce_admins
      WHERE commerce_admins.commerce_id = coupon_redemptions.commerce_id
        AND commerce_admins.user_id = auth.uid()
    )
  );

-- Gym admins can view their gym's redemptions
CREATE POLICY "Gym admins can view gym redemptions"
  ON coupon_redemptions FOR SELECT
  TO authenticated
  USING (
    gym_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM gym_admins
      WHERE gym_admins.gym_id = coupon_redemptions.gym_id
        AND gym_admins.user_id = auth.uid()
    )
  );

-- Commerce admins can view their commerce's redemptions
CREATE POLICY "Commerce admins can view commerce redemptions"
  ON coupon_redemptions FOR SELECT
  TO authenticated
  USING (
    commerce_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM commerce_admins
      WHERE commerce_admins.commerce_id = coupon_redemptions.commerce_id
        AND commerce_admins.user_id = auth.uid()
    )
  );

-- FluxFit admins can view all redemptions (via subquery to avoid function dependency)
CREATE POLICY "FluxFit admins can view all redemptions"
  ON coupon_redemptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_gym_id ON coupon_redemptions(gym_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_commerce_id ON coupon_redemptions(commerce_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_id ON coupon_redemptions(user_id);
