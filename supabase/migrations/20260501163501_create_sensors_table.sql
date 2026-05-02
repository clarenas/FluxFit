/*
  # Create sensors table

  1. New Table: `sensors`
    - `id` (uuid, primary key)
    - `branch_id` (uuid, nullable FK to gym_branches — null means unlinked/inventory)
    - `status` (text, enum: 'online' | 'offline' | 'maintenance', default 'offline')
    - `last_heartbeat` (timestamptz, nullable)
    - `battery_level` (int, 0-100, default 0)
    - `secret_key` (text, unique — used by the physical device to authenticate)
    - `label` (text — human-friendly name, e.g. "Sensor Entrada Sur")
    - `created_at` (timestamptz)

  2. Security
    - RLS enabled
    - Only fluxfit_admin can INSERT, UPDATE, DELETE
    - fluxfit_admin and gym_admin (for their own branches) can SELECT
    - Sensor devices authenticate via secret_key through the edge function (service role), not direct RLS

  3. Notes
    - branch_id is nullable to allow "unlinked" sensors sitting in inventory
    - secret_key is generated server-side as a UUID to ensure uniqueness
*/

CREATE TABLE IF NOT EXISTS sensors (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    uuid        REFERENCES gym_branches(id) ON DELETE SET NULL,
  status       text        NOT NULL DEFAULT 'offline'
                           CHECK (status IN ('online','offline','maintenance')),
  last_heartbeat timestamptz,
  battery_level  integer   NOT NULL DEFAULT 0
                           CHECK (battery_level >= 0 AND battery_level <= 100),
  secret_key   text        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  label        text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;

-- fluxfit_admin: full access
CREATE POLICY "FluxFit admins can read sensors"
  ON sensors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

CREATE POLICY "FluxFit admins can insert sensors"
  ON sensors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

CREATE POLICY "FluxFit admins can update sensors"
  ON sensors FOR UPDATE
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

CREATE POLICY "FluxFit admins can delete sensors"
  ON sensors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

-- gym_admin: read sensors linked to their branches
CREATE POLICY "Gym admins can read sensors for their branches"
  ON sensors FOR SELECT
  TO authenticated
  USING (
    branch_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM gym_branches
      JOIN gym_admins ON gym_admins.gym_id = gym_branches.gym_id
      WHERE gym_branches.id = sensors.branch_id
        AND gym_admins.user_id = auth.uid()
    )
  );

-- Index for fast branch lookups
CREATE INDEX IF NOT EXISTS idx_sensors_branch_id ON sensors(branch_id);
