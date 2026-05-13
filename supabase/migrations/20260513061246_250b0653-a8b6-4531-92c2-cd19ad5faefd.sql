-- Dealers as data, not auth users
CREATE TABLE IF NOT EXISTS public.dealers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone read dealers" ON public.dealers FOR SELECT USING (true);
CREATE POLICY "admins manage dealers" ON public.dealers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Rims now reference dealers table (was previously auth user id). Keep column name dealer_id.
-- Drop old dealer-user-based policies
DROP POLICY IF EXISTS "dealers insert own rims" ON public.rims;
DROP POLICY IF EXISTS "dealers update own rims" ON public.rims;

-- Admin-only management of rims
CREATE POLICY "admins insert rims" ON public.rims
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins update rims" ON public.rims
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Keep existing "public activate rim" policy so customers can still activate via QR.

-- New signups become admin (single-admin system)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, dealer_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NULL,
    NEW.raw_user_meta_data->>'phone'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$;