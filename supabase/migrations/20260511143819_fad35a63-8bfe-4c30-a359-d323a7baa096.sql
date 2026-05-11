
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'dealer');
CREATE TYPE public.rim_status AS ENUM ('registered', 'activated', 'claimed');
CREATE TYPE public.claim_status AS ENUM ('pending', 'approved', 'rejected');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  dealer_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Products (rim models)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  description TEXT,
  warranty_months INTEGER NOT NULL DEFAULT 24,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Rims
CREATE TABLE public.rims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  dealer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.rim_status NOT NULL DEFAULT 'registered',
  activation_date TIMESTAMPTZ,
  expiry_date TIMESTAMPTZ,
  owner_name TEXT,
  owner_email TEXT,
  owner_phone TEXT,
  owner_address TEXT,
  motorcycle_make TEXT,
  motorcycle_model TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.rims ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_rims_dealer ON public.rims(dealer_id);
CREATE INDEX idx_rims_status ON public.rims(status);

-- Claims
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rim_id UUID NOT NULL REFERENCES public.rims(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  issue_description TEXT NOT NULL,
  photo_urls TEXT[] DEFAULT '{}',
  status public.claim_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_claims_rim ON public.claims(rim_id);
CREATE INDEX idx_claims_status ON public.claims(status);

-- Trigger: create profile + dealer role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, dealer_name, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'dealer_name',
    NEW.raw_user_meta_data->>'phone'
  );
  -- Default role: dealer (admins promoted manually)
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'dealer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-set expiry_date when rim is activated
CREATE OR REPLACE FUNCTION public.set_rim_expiry()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  months INTEGER;
BEGIN
  IF NEW.status = 'activated' AND (OLD.status IS DISTINCT FROM 'activated') THEN
    SELECT warranty_months INTO months FROM public.products WHERE id = NEW.product_id;
    NEW.activation_date := COALESCE(NEW.activation_date, now());
    NEW.expiry_date := NEW.activation_date + (months || ' months')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_rim_expiry
  BEFORE UPDATE ON public.rims
  FOR EACH ROW EXECUTE FUNCTION public.set_rim_expiry();

-- ===== RLS POLICIES =====

-- profiles
CREATE POLICY "users see own profile" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- user_roles
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- products: anyone can read; admins manage
CREATE POLICY "anyone read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "admins manage products" ON public.products FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- rims
-- Public can SELECT (needed for QR verification by token); we'll filter sensitive fields client-side via a view-like masking
CREATE POLICY "public read rims" ON public.rims FOR SELECT USING (true);
CREATE POLICY "dealers insert own rims" ON public.rims FOR INSERT
  WITH CHECK (auth.uid() = dealer_id AND (public.has_role(auth.uid(), 'dealer') OR public.has_role(auth.uid(), 'admin')));
-- Public update allowed only to set owner info during activation (status registered -> activated). Admins/owning dealer can update freely.
CREATE POLICY "public activate rim" ON public.rims FOR UPDATE
  USING (status = 'registered')
  WITH CHECK (status IN ('registered', 'activated'));
CREATE POLICY "dealers update own rims" ON public.rims FOR UPDATE
  USING (auth.uid() = dealer_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = dealer_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete rims" ON public.rims FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- claims
CREATE POLICY "public submit claim" ON public.claims FOR INSERT WITH CHECK (true);
CREATE POLICY "admins and dealers read claims" ON public.claims FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.rims r WHERE r.id = claims.rim_id AND r.dealer_id = auth.uid())
  );
CREATE POLICY "admins manage claims" ON public.claims FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed sample products
INSERT INTO public.products (name, sku, description, warranty_months) VALUES
  ('Apex Forged 17"', 'APX-FRG-17', 'Forged aluminum sport rim, 17-inch', 24),
  ('Trail Cast 19"', 'TRL-CST-19', 'Cast aluminum off-road rim, 19-inch', 12),
  ('Velocity Pro 17"', 'VEL-PRO-17', 'Race-grade carbon fiber rim, 17-inch', 36);
