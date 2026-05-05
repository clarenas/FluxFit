/*
  # Gym registration approval requests (FluxFit admin)

  Tracks new gyms created from the admin panel until they are approved.
*/

CREATE TABLE IF NOT EXISTS gym_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id uuid NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  requester_email text NOT NULL DEFAULT '',
  gym_name text NOT NULL DEFAULT '',
  address text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  admin_notes text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_gym_requests_status ON gym_requests(status);
CREATE INDEX IF NOT EXISTS idx_gym_requests_gym_id ON gym_requests(gym_id);

ALTER TABLE gym_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FluxFit admins can read gym_requests" ON gym_requests;
CREATE POLICY "FluxFit admins can read gym_requests"
  ON gym_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

DROP POLICY IF EXISTS "FluxFit admins can insert gym_requests" ON gym_requests;
CREATE POLICY "FluxFit admins can insert gym_requests"
  ON gym_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

DROP POLICY IF EXISTS "FluxFit admins can update gym_requests" ON gym_requests;
CREATE POLICY "FluxFit admins can update gym_requests"
  ON gym_requests FOR UPDATE
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
