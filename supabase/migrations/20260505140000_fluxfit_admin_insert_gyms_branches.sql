/*
  # FluxFit admin: create gyms and branches from dashboard

  Allows fluxfit_admin to insert rows into gyms and gym_branches (e.g. cadena + sucursal).
*/

CREATE POLICY "FluxFit admins can insert gyms"
  ON gyms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

CREATE POLICY "FluxFit admins can insert gym_branches"
  ON gym_branches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );
