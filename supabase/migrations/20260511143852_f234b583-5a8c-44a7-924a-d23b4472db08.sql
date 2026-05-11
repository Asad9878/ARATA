
-- Fix search_path on set_rim_expiry
CREATE OR REPLACE FUNCTION public.set_rim_expiry()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE months INTEGER;
BEGIN
  IF NEW.status = 'activated' AND (OLD.status IS DISTINCT FROM 'activated') THEN
    SELECT warranty_months INTO months FROM public.products WHERE id = NEW.product_id;
    NEW.activation_date := COALESCE(NEW.activation_date, now());
    NEW.expiry_date := NEW.activation_date + (months || ' months')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$;

-- Lock down SECURITY DEFINER functions used only by triggers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_rim_expiry() FROM PUBLIC, anon, authenticated;

-- Tighten "public submit claim" — require existing rim
DROP POLICY "public submit claim" ON public.claims;
CREATE POLICY "public submit claim" ON public.claims FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.rims r WHERE r.id = rim_id));

-- Tighten "public activate rim" — only allow setting status to 'activated' and only owner fields
-- (RLS check above already requires status was 'registered'; we narrow the allowed new status)
DROP POLICY "public activate rim" ON public.rims;
CREATE POLICY "public activate rim" ON public.rims FOR UPDATE
  USING (status = 'registered')
  WITH CHECK (status = 'activated' AND owner_email IS NOT NULL AND owner_name IS NOT NULL);
