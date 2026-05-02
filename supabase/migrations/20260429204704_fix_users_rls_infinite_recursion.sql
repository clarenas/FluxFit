/*
  # Fix infinite recursion in users RLS policies

  ## Problem
  The SELECT and UPDATE policies on the `users` table check admin role by doing:
    EXISTS (SELECT 1 FROM users u2 WHERE u2.id = auth.uid() AND u2.role = 'fluxfit_admin')
  This causes infinite recursion because the policy fires every time `users` is queried,
  including the subquery inside the policy itself.

  ## Solution
  1. Create a SECURITY DEFINER function `is_fluxfit_admin()` that reads the role without
     triggering RLS, breaking the recursion.
  2. Drop and recreate the affected SELECT and UPDATE policies to use this function.
*/

-- Helper function that checks admin role without triggering RLS (SECURITY DEFINER bypasses it)
CREATE OR REPLACE FUNCTION is_fluxfit_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'fluxfit_admin'
  );
$$;

-- Recreate SELECT policy using the safe helper
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR is_fluxfit_admin());

-- Recreate UPDATE policy using the safe helper
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR is_fluxfit_admin())
  WITH CHECK (auth.uid() = id OR is_fluxfit_admin());
