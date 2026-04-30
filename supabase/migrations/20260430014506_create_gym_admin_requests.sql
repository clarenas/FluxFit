/*
  # Create gym_admin_requests table

  ## Summary
  Adds a table to track gym registration requests submitted during sign-up.
  Admins can review and approve/reject these requests before activating the gym panel.

  ## New Tables
  - `gym_admin_requests`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users)
    - `gym_name` (text) - name of the gym or chain
    - `comunas` (text[]) - array of comunas where the gym operates
    - `phone` (text) - contact phone
    - `plan_interest` (text) - selected plan tier
    - `status` (text) - 'pending' | 'approved' | 'rejected'
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can insert their own requests
  - Authenticated users can read their own requests
*/

CREATE TABLE IF NOT EXISTS gym_admin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gym_name text NOT NULL DEFAULT '',
  comunas text[] NOT NULL DEFAULT '{}',
  phone text NOT NULL DEFAULT '',
  plan_interest text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE gym_admin_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own gym requests"
  ON gym_admin_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own gym requests"
  ON gym_admin_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
