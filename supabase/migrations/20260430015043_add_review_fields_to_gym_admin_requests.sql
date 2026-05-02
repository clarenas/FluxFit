/*
  # Add review fields to gym_admin_requests

  Adds reviewed_at and reviewed_by columns so admins can record
  when and by whom each request was approved or rejected.

  ## Changes
  - `gym_admin_requests`
    - `reviewed_at` (timestamptz, nullable) - when the request was reviewed
    - `reviewed_by` (uuid, nullable, FK to auth.users) - admin who reviewed it

  ## Security
  - Adds a policy allowing fluxfit admins (role = 'fluxfit_admin') to update requests
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gym_admin_requests' AND column_name = 'reviewed_at'
  ) THEN
    ALTER TABLE gym_admin_requests ADD COLUMN reviewed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gym_admin_requests' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE gym_admin_requests ADD COLUMN reviewed_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE POLICY "FluxFit admins can update gym requests"
  ON gym_admin_requests FOR UPDATE
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

CREATE POLICY "FluxFit admins can read all gym requests"
  ON gym_admin_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );
