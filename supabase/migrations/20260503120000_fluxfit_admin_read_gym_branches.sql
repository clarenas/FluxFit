/*
  # FluxFit admin can read all gym branches

  Sensor inventory registration lists branches per gym; without this policy
  fluxfit_admin may get an empty result from gym_branches depending on existing RLS.
*/

DROP POLICY IF EXISTS "FluxFit admins can read all gym_branches" ON gym_branches;

CREATE POLICY "FluxFit admins can read all gym_branches"
  ON gym_branches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );
