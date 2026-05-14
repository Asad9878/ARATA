
-- =========================================================
-- 1. WIPE existing data (schema kept for products/dealers/etc rebuilt below)
-- =========================================================
DROP TABLE IF EXISTS public.claims CASCADE;
DROP TABLE IF EXISTS public.rims CASCADE;
DROP TABLE IF EXISTS public.dealers CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;
DROP TYPE IF EXISTS public.claim_status CASCADE;
DROP TYPE IF EXISTS public.rim_status CASCADE;

-- =========================================================
-- 2. ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'company_admin', 'staff');
CREATE TYPE public.company_status AS ENUM ('active', 'suspended', 'expired');
CREATE TYPE public.inventory_status AS ENUM ('unused', 'activated', 'claimed');
CREATE TYPE public.claim_status AS ENUM ('pending', 'under_review', 'approved', 'rejected');

-- =========================================================
-- 3. CORE TABLES
-- =========================================================

-- Packages (SaaS plans)
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_months INTEGER NOT NULL DEFAULT 12,
  max_products INTEGER NOT NULL DEFAULT 100,
  max_dealers INTEGER NOT NULL DEFAULT 50,
  max_qr_codes INTEGER NOT NULL DEFAULT 10000,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Companies (tenants)
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  status company_status NOT NULL DEFAULT 'active',
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  subscription_starts_at TIMESTAMPTZ DEFAULT now(),
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles (super_admin only — company users live in company_users)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Company users (membership of a user in a company with role)
CREATE TABLE public.company_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'staff',
  full_name TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

-- Profiles (user-level data, not company-scoped)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dealers (per-company)
CREATE TABLE public.dealers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  dealer_name TEXT NOT NULL,
  shop_name TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dealers_company ON public.dealers(company_id);

-- Products (per-company)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  sku TEXT,
  warranty_months INTEGER NOT NULL DEFAULT 12,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_company ON public.products(company_id);

-- Inventory (each unit/QR)
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL,
  serial_number TEXT NOT NULL,
  qr_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  status inventory_status NOT NULL DEFAULT 'unused',
  batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, serial_number),
  UNIQUE (qr_token)
);
CREATE INDEX idx_inventory_company ON public.inventory(company_id);
CREATE INDEX idx_inventory_product ON public.inventory(product_id);
CREATE INDEX idx_inventory_dealer ON public.inventory(dealer_id);

-- Activations
CREATE TABLE public.activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL UNIQUE REFERENCES public.inventory(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_city TEXT,
  purchase_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activations_company ON public.activations(company_id);

-- Claims
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  activation_id UUID REFERENCES public.activations(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  status claim_status NOT NULL DEFAULT 'pending',
  internal_remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_claims_company ON public.claims(company_id);

-- Fake scan attempts
CREATE TABLE public.fake_scan_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  attempted_serial TEXT,
  attempted_token TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- 4. SECURITY DEFINER HELPERS
-- =========================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE OR REPLACE FUNCTION public.user_company_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.company_users WHERE user_id = _user_id AND is_active = true LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_company_role(_user_id UUID)
RETURNS app_role LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.company_users WHERE user_id = _user_id AND is_active = true LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.belongs_to_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = _user_id AND company_id = _company_id AND is_active = true
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-set activation expiry from product warranty
CREATE OR REPLACE FUNCTION public.set_activation_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE months INTEGER;
BEGIN
  IF NEW.expiry_date IS NULL THEN
    SELECT p.warranty_months INTO months
    FROM public.inventory i JOIN public.products p ON p.id = i.product_id
    WHERE i.id = NEW.inventory_id;
    NEW.expiry_date := NEW.purchase_date + (months || ' months')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_activation_expiry
  BEFORE INSERT ON public.activations
  FOR EACH ROW EXECUTE FUNCTION public.set_activation_expiry();

-- Mark inventory status on activation
CREATE OR REPLACE FUNCTION public.mark_inventory_activated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.inventory SET status = 'activated' WHERE id = NEW.inventory_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_inventory_activated
  AFTER INSERT ON public.activations
  FOR EACH ROW EXECUTE FUNCTION public.mark_inventory_activated();

-- =========================================================
-- 5. RLS — enable + policies
-- =========================================================
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fake_scan_attempts ENABLE ROW LEVEL SECURITY;

-- packages
CREATE POLICY "anyone read packages" ON public.packages FOR SELECT USING (true);
CREATE POLICY "super admin manage packages" ON public.packages FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- companies
CREATE POLICY "super admin all companies" ON public.companies FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "company members read own company" ON public.companies FOR SELECT
  USING (public.belongs_to_company(auth.uid(), id));
CREATE POLICY "public read active companies basic" ON public.companies FOR SELECT
  USING (status = 'active');

-- user_roles
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "super admin manage roles" ON public.user_roles FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- company_users
CREATE POLICY "super admin all company_users" ON public.company_users FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "users see own company_users" ON public.company_users FOR SELECT
  USING (user_id = auth.uid() OR public.belongs_to_company(auth.uid(), company_id));
CREATE POLICY "company admin manage staff" ON public.company_users FOR ALL
  USING (public.belongs_to_company(auth.uid(), company_id) AND public.user_company_role(auth.uid()) = 'company_admin')
  WITH CHECK (public.belongs_to_company(auth.uid(), company_id) AND public.user_company_role(auth.uid()) = 'company_admin');

-- profiles
CREATE POLICY "users see own profile" ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_super_admin(auth.uid()));
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Generic per-company policy macro applied below
-- dealers
CREATE POLICY "super admin all dealers" ON public.dealers FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "company members manage dealers" ON public.dealers FOR ALL
  USING (public.belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.belongs_to_company(auth.uid(), company_id));

-- products
CREATE POLICY "super admin all products" ON public.products FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "company members manage products" ON public.products FOR ALL
  USING (public.belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.belongs_to_company(auth.uid(), company_id));
CREATE POLICY "public read active products" ON public.products FOR SELECT USING (is_active = true);

-- inventory
CREATE POLICY "super admin all inventory" ON public.inventory FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "company members manage inventory" ON public.inventory FOR ALL
  USING (public.belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.belongs_to_company(auth.uid(), company_id));
CREATE POLICY "public read inventory for verify" ON public.inventory FOR SELECT USING (true);

-- activations
CREATE POLICY "super admin all activations" ON public.activations FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "company members manage activations" ON public.activations FOR ALL
  USING (public.belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.belongs_to_company(auth.uid(), company_id));
CREATE POLICY "public submit activation" ON public.activations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.inventory i WHERE i.id = inventory_id AND i.status = 'unused' AND i.company_id = activations.company_id)
  );
CREATE POLICY "public read own activation" ON public.activations FOR SELECT USING (true);

-- claims
CREATE POLICY "super admin all claims" ON public.claims FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "company members manage claims" ON public.claims FOR ALL
  USING (public.belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.belongs_to_company(auth.uid(), company_id));
CREATE POLICY "public submit claim" ON public.claims FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.inventory i WHERE i.id = inventory_id AND i.company_id = claims.company_id)
  );

-- fake_scan_attempts
CREATE POLICY "public log fake scans" ON public.fake_scan_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "company members read fake scans" ON public.fake_scan_attempts FOR SELECT
  USING (company_id IS NULL OR public.belongs_to_company(auth.uid(), company_id) OR public.is_super_admin(auth.uid()));

-- =========================================================
-- 6. Seed default packages
-- =========================================================
INSERT INTO public.packages (name, price, duration_months, max_products, max_dealers, max_qr_codes, features) VALUES
  ('Starter', 49, 12, 50, 25, 5000, '["Basic analytics","Email support"]'::jsonb),
  ('Growth', 149, 12, 200, 100, 25000, '["Advanced analytics","Priority support","API access"]'::jsonb),
  ('Enterprise', 499, 12, 9999, 9999, 999999, '["Custom branding","Dedicated support","SSO","Audit logs"]'::jsonb);

NOTIFY pgrst, 'reload schema';
