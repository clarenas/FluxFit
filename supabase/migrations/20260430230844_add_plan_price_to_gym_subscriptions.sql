/*
  # Add plan_price to gym_subscriptions + FluxFit admin RLS

  1. Changes
    - `gym_subscriptions`: add `plan_price` integer column (monthly price in CLP)
    - `gyms`: `max_branches` already exists — no change needed

  2. Security
    - Add UPDATE policy so fluxfit_admin role can update gym_subscriptions
    - Add UPDATE policy so fluxfit_admin role can update gyms.max_branches
*/

-- Add plan_price column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gym_subscriptions' AND column_name = 'plan_price'
  ) THEN
    ALTER TABLE gym_subscriptions ADD COLUMN plan_price integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Backfill existing rows with correct prices
UPDATE gym_subscriptions SET plan_price = CASE
  WHEN plan = 'light'  THEN 89900
  WHEN plan = 'pro'    THEN 149900
  WHEN plan = 'full'   THEN 149900
  WHEN plan = 'basico' THEN 59900
  ELSE 0
END
WHERE plan_price = 0;

-- Allow fluxfit_admin to update gym_subscriptions
CREATE POLICY "FluxFit admins can manage gym subscriptions"
  ON gym_subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

-- Allow fluxfit_admin to insert gym_subscriptions (for gyms that have none)
CREATE POLICY "FluxFit admins can insert gym subscriptions"
  ON gym_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

-- Allow fluxfit_admin to read all gym_subscriptions
CREATE POLICY "FluxFit admins can read gym subscriptions"
  ON gym_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

-- Allow fluxfit_admin to update gyms (for max_branches)
CREATE POLICY "FluxFit admins can update gyms"
  ON gyms FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );
