/*
  # FluxFit admin can read all gyms and commerces (including pending/inactive)

  The existing public read policy filters on is_active = true, so pending gyms
  and commerces are invisible to the admin dashboard. This adds unrestricted
  read access for the fluxfit_admin role.
*/

-- FluxFit admin can read all gyms regardless of is_active or approval_status
CREATE POLICY "FluxFit admins can read all gyms"
  ON gyms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

-- FluxFit admin can read all commerces regardless of is_active or approval_status
CREATE POLICY "FluxFit admins can read all commerces"
  ON commerces FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'fluxfit_admin'
    )
  );

-- FluxFit admin can update commerces (approval)
CREATE POLICY "FluxFit admins can update commerces"
  ON commerces FOR UPDATE
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
