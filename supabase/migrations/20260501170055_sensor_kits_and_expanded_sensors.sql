/*
  # Sensor Kits & Expanded Sensors Schema

  ## Summary
  Introduces the concept of a "Kit de Acceso" — a paired entry/exit sensor
  installed at a single access point of a gym branch.

  ## New Tables

  ### sensor_kits
  Groups an entry sensor + exit sensor into a logical unit called a Kit.
  - id (uuid, pk)
  - branch_id (uuid, FK → gym_branches) — the branch this kit is installed at
  - name (text) — human-friendly name for the access point (e.g. "Entrada Principal")
  - created_at (timestamptz)

  ### sensor_history
  Tracks every sensor that has ever been installed at a kit position.
  Used for "replace hardware" traceability — old sensor records are moved here.
  - id (uuid, pk)
  - kit_id (uuid, FK → sensor_kits)
  - position ('entry' | 'exit')
  - brand, model, serial_number (text)
  - installed_at, retired_at (timestamptz)
  - retired_reason (text — "replaced", "failed", "decommissioned")
  - created_at (timestamptz)

  ## Modified Tables

  ### sensors
  Expanded columns:
  - kit_id (uuid, nullable FK → sensor_kits) — which kit this sensor belongs to
  - position (text, 'entry' | 'exit') — which side of the access point
  - brand, model, serial_number (text) — hardware identification
  - installation_date (timestamptz) — when it was physically installed
  - status changed enum to: 'active', 'maintenance', 'retired'
  - label column kept for backwards compatibility

  ## Security
  - RLS enabled on both new tables
  - Only fluxfit_admin can INSERT/UPDATE/DELETE
  - fluxfit_admin can SELECT all; gym_admin can SELECT for their own branches

  ## Notes
  - serial_number has a UNIQUE constraint to prevent duplicate hardware registration
  - branch_id on sensors is kept alongside kit_id for direct queries
  - Existing sensors data is preserved (new columns are nullable or have defaults)
*/

-- ── sensor_kits ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sensor_kits (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id  uuid        NOT NULL REFERENCES gym_branches(id) ON DELETE CASCADE,
  name       text        NOT NULL DEFAULT 'Acceso Principal',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sensor_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FluxFit admins can select sensor_kits"
  ON sensor_kits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'));

CREATE POLICY "FluxFit admins can insert sensor_kits"
  ON sensor_kits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'));

CREATE POLICY "FluxFit admins can update sensor_kits"
  ON sensor_kits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'));

CREATE POLICY "FluxFit admins can delete sensor_kits"
  ON sensor_kits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'));

CREATE POLICY "Gym admins can select sensor_kits for their branches"
  ON sensor_kits FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM gym_admins
    WHERE gym_admins.user_id = auth.uid()
      AND gym_admins.gym_id = (SELECT gym_id FROM gym_branches WHERE id = sensor_kits.branch_id)
  ));

CREATE INDEX IF NOT EXISTS idx_sensor_kits_branch_id ON sensor_kits(branch_id);

-- ── sensor_history ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sensor_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id          uuid        NOT NULL REFERENCES sensor_kits(id) ON DELETE CASCADE,
  position        text        NOT NULL CHECK (position IN ('entry', 'exit')),
  brand           text        NOT NULL DEFAULT '',
  model           text        NOT NULL DEFAULT '',
  serial_number   text        NOT NULL DEFAULT '',
  installed_at    timestamptz,
  retired_at      timestamptz NOT NULL DEFAULT now(),
  retired_reason  text        NOT NULL DEFAULT 'replaced'
                              CHECK (retired_reason IN ('replaced', 'failed', 'decommissioned')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sensor_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FluxFit admins can select sensor_history"
  ON sensor_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'));

CREATE POLICY "FluxFit admins can insert sensor_history"
  ON sensor_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'));

CREATE INDEX IF NOT EXISTS idx_sensor_history_kit_id ON sensor_history(kit_id);

-- ── Expand sensors table ─────────────────────────────────────────────────────

DO $$
BEGIN
  -- kit_id: links sensor to a kit
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensors' AND column_name = 'kit_id') THEN
    ALTER TABLE sensors ADD COLUMN kit_id uuid REFERENCES sensor_kits(id) ON DELETE SET NULL;
  END IF;

  -- position: 'entry' or 'exit'
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensors' AND column_name = 'position') THEN
    ALTER TABLE sensors ADD COLUMN position text CHECK (position IN ('entry', 'exit'));
  END IF;

  -- brand
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensors' AND column_name = 'brand') THEN
    ALTER TABLE sensors ADD COLUMN brand text NOT NULL DEFAULT '';
  END IF;

  -- model
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensors' AND column_name = 'model') THEN
    ALTER TABLE sensors ADD COLUMN model text NOT NULL DEFAULT '';
  END IF;

  -- serial_number (unique to prevent duplicate hardware)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensors' AND column_name = 'serial_number') THEN
    ALTER TABLE sensors ADD COLUMN serial_number text NOT NULL DEFAULT '';
  END IF;

  -- installation_date
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sensors' AND column_name = 'installation_date') THEN
    ALTER TABLE sensors ADD COLUMN installation_date timestamptz;
  END IF;
END $$;

-- Change status values from (online/offline/maintenance) to (active/maintenance/retired)
-- We keep the CHECK constraint flexible so existing data isn't broken,
-- then add the new values
ALTER TABLE sensors DROP CONSTRAINT IF EXISTS sensors_status_check;
ALTER TABLE sensors ADD CONSTRAINT sensors_status_check
  CHECK (status IN ('online', 'offline', 'maintenance', 'active', 'retired'));

-- Unique serial number (only enforce on non-empty values to protect existing rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sensors_serial_number
  ON sensors(serial_number)
  WHERE serial_number <> '';

CREATE INDEX IF NOT EXISTS idx_sensors_kit_id ON sensors(kit_id);
