/*
  # Create contact_messages table

  1. New Tables
    - `contact_messages`
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable FK to users)
      - `name` (text)
      - `email` (text)
      - `type` (text) — query category
      - `message` (text)
      - `created_at` (timestamptz)
      - `is_read` (boolean, default false)
  2. Security
    - Enable RLS
    - Anyone (including unauthenticated) can insert
    - Authenticated users can read (for admin use)
*/

CREATE TABLE IF NOT EXISTS contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_read boolean NOT NULL DEFAULT false
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert contact messages"
  ON contact_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read contact messages"
  ON contact_messages FOR SELECT
  TO authenticated
  USING (true);
