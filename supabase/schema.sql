-- =============================================================================
-- Al-Badran Printing (البدران للطباعة) — Complete Supabase Schema, RLS & RPCs
-- Paste this entire file into Supabase Dashboard -> SQL Editor and run it.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABLES
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.print_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_size text NOT NULL CHECK (paper_size IN ('A5', 'A4', 'A3')),
  color_mode text NOT NULL CHECK (color_mode IN ('bw', 'color')),
  sides text NOT NULL CHECK (sides IN ('single', 'double')),
  price_per_page numeric(10, 2) NOT NULL CHECK (price_per_page >= 0),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (paper_size, color_mode, sides)
);

CREATE TABLE IF NOT EXISTS public.quantity_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_copies integer NOT NULL UNIQUE CHECK (min_copies >= 2),
  discount_percent numeric(5, 2) NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 90)
);

CREATE TABLE IF NOT EXISTS public.finishing_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  price_type text NOT NULL CHECK (price_type IN ('per_copy', 'flat')),
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_ar text NOT NULL,
  sort integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  description_en text NOT NULL DEFAULT '',
  description_ar text NOT NULL DEFAULT '',
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  image_url text NOT NULL DEFAULT '',
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('print', 'store')),
  customer_name text NOT NULL,
  phone text NOT NULL,
  delivery_type text NOT NULL CHECK (delivery_type IN ('pickup', 'delivery')),
  address text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  total numeric(10, 2) NOT NULL CHECK (total >= 0),
  status text NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Confirmed', 'Printing', 'Ready', 'Delivered', 'Cancelled')),
  print_job jsonb,
  file_path text,
  items jsonb,
  admin_note text NOT NULL DEFAULT '',
  payment_method text NOT NULL DEFAULT 'cash',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id);

-- 2. ADMIN CHECK HELPER
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
$$;

-- 3. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quantity_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finishing_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- admins: user can only see their own admin row
DROP POLICY IF EXISTS "admins_self_select" ON public.admins;
CREATE POLICY "admins_self_select" ON public.admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- settings: public read for public keys, admin full access
DROP POLICY IF EXISTS "settings_public_read" ON public.settings;
CREATE POLICY "settings_public_read" ON public.settings
  FOR SELECT TO anon, authenticated
  USING (is_public = true OR public.is_admin());

DROP POLICY IF EXISTS "settings_admin_write" ON public.settings;
CREATE POLICY "settings_admin_write" ON public.settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- print_prices: public read active, admin full access
DROP POLICY IF EXISTS "print_prices_public_read" ON public.print_prices;
CREATE POLICY "print_prices_public_read" ON public.print_prices
  FOR SELECT TO anon, authenticated
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "print_prices_admin_write" ON public.print_prices;
CREATE POLICY "print_prices_admin_write" ON public.print_prices
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- quantity_discounts: public read, admin full access
DROP POLICY IF EXISTS "discounts_public_read" ON public.quantity_discounts;
CREATE POLICY "discounts_public_read" ON public.quantity_discounts
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "discounts_admin_write" ON public.quantity_discounts;
CREATE POLICY "discounts_admin_write" ON public.quantity_discounts
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- finishing_options: public read active, admin full access
DROP POLICY IF EXISTS "finishing_public_read" ON public.finishing_options;
CREATE POLICY "finishing_public_read" ON public.finishing_options
  FOR SELECT TO anon, authenticated
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "finishing_admin_write" ON public.finishing_options;
CREATE POLICY "finishing_admin_write" ON public.finishing_options
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- categories: public read, admin full access
DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read" ON public.categories
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "categories_admin_write" ON public.categories;
CREATE POLICY "categories_admin_write" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- products: public read active, admin full access
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
  FOR SELECT TO anon, authenticated
  USING (active = true OR public.is_admin());

DROP POLICY IF EXISTS "products_admin_write" ON public.products;
CREATE POLICY "products_admin_write" ON public.products
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- orders: NO public SELECT/INSERT/UPDATE/DELETE! Visitors use RPCs only. Admin has full access.
DROP POLICY IF EXISTS "orders_admin_all" ON public.orders;
CREATE POLICY "orders_admin_all" ON public.orders
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4. SERVER-SIDE ORDER RPC FUNCTIONS (SECURITY DEFINER)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_print_order(
  p_customer_name text,
  p_phone text,
  p_delivery_type text,
  p_address text,
  p_notes text,
  p_paper_size text,
  p_color_mode text,
  p_sides text,
  p_pages integer,
  p_copies integer,
  p_finishing_ids uuid[],
  p_file_path text,
  p_file_name text,
  p_file_type text,
  p_file_size bigint,
  p_is_estimated boolean DEFAULT false,
  p_honeypot text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_orders_enabled boolean;
  v_min_order numeric(10, 2);
  v_max_file_mb integer;
  v_price_per_page numeric(10, 2);
  v_pages_cost numeric(10, 2);
  v_discount_pct numeric(5, 2);
  v_subtotal numeric(10, 2);
  v_finishing_total numeric(10, 2) := 0;
  v_finishing_items jsonb := '[]'::jsonb;
  v_total numeric(10, 2);
  v_order_code text;
  v_order_id uuid;
  v_fin record;
  v_fin_amount numeric(10, 2);
BEGIN
  -- Honeypot anti-spam check
  IF coalesce(trim(p_honeypot), '') <> '' THEN
    RAISE EXCEPTION 'Invalid submission';
  END IF;

  -- Check shop settings
  SELECT value INTO v_config FROM public.settings WHERE key = 'print_config';
  v_orders_enabled := coalesce((v_config->>'orders_enabled')::boolean, true);
  v_min_order := coalesce((v_config->>'min_order_total')::numeric, 10);
  v_max_file_mb := coalesce((v_config->>'max_file_mb')::integer, 50);

  IF NOT v_orders_enabled THEN
    RAISE EXCEPTION 'ORDERS_PAUSED';
  END IF;

  -- Input validation
  IF length(trim(coalesce(p_customer_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF length(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')) < 8 THEN
    RAISE EXCEPTION 'Valid phone number is required';
  END IF;
  IF p_delivery_type NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Invalid delivery type';
  END IF;
  IF p_delivery_type = 'delivery' AND length(trim(coalesce(p_address, ''))) < 4 THEN
    RAISE EXCEPTION 'Delivery address is required';
  END IF;
  IF p_pages IS NULL OR p_pages < 1 OR p_pages > 10000 THEN
    RAISE EXCEPTION 'Invalid page count';
  END IF;
  IF p_copies IS NULL OR p_copies < 1 OR p_copies > 100000 THEN
    RAISE EXCEPTION 'Invalid copies count';
  END IF;
  IF length(trim(coalesce(p_file_path, ''))) < 3 THEN
    RAISE EXCEPTION 'File path is required';
  END IF;
  IF p_file_size IS NOT NULL AND p_file_size > (v_max_file_mb::bigint * 1024 * 1024) THEN
    RAISE EXCEPTION 'File exceeds maximum allowed size';
  END IF;

  -- Lookup unit price from DB (never trust client price)
  SELECT price_per_page INTO v_price_per_page
  FROM public.print_prices
  WHERE paper_size = p_paper_size
    AND color_mode = p_color_mode
    AND sides = p_sides
    AND active = true;

  IF v_price_per_page IS NULL THEN
    RAISE EXCEPTION 'Selected print configuration is unavailable';
  END IF;

  v_pages_cost := round((p_pages::numeric * p_copies::numeric * v_price_per_page), 2);

  SELECT coalesce(max(discount_percent), 0) INTO v_discount_pct
  FROM public.quantity_discounts
  WHERE min_copies <= p_copies;

  v_subtotal := round(v_pages_cost * (1.0 - (v_discount_pct / 100.0)), 2);

  -- Calculate finishing options from DB
  IF p_finishing_ids IS NOT NULL AND array_length(p_finishing_ids, 1) > 0 THEN
    FOR v_fin IN
      SELECT id, name_en, name_ar, price, price_type
      FROM public.finishing_options
      WHERE id = ANY(p_finishing_ids) AND active = true
      ORDER BY sort, name_en
    LOOP
      IF v_fin.price_type = 'per_copy' THEN
        v_fin_amount := round(v_fin.price * p_copies, 2);
      ELSE
        v_fin_amount := round(v_fin.price, 2);
      END IF;
      v_finishing_total := v_finishing_total + v_fin_amount;
      v_finishing_items := v_finishing_items || jsonb_build_array(
        jsonb_build_object(
          'id', v_fin.id,
          'name_en', v_fin.name_en,
          'name_ar', v_fin.name_ar,
          'price', v_fin.price,
          'price_type', v_fin.price_type,
          'amount', v_fin_amount
        )
      );
    END LOOP;
  END IF;

  v_total := round(greatest(v_subtotal + v_finishing_total, v_min_order), 2);
  v_order_code := 'BP-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  INSERT INTO public.orders (
    order_code,
    kind,
    customer_name,
    phone,
    delivery_type,
    address,
    notes,
    total,
    status,
    print_job,
    file_path
  ) VALUES (
    v_order_code,
    'print',
    left(trim(p_customer_name), 120),
    left(trim(p_phone), 40),
    p_delivery_type,
    left(trim(coalesce(p_address, '')), 400),
    left(trim(coalesce(p_notes, '')), 1000),
    v_total,
    'New',
    jsonb_build_object(
      'paper_size', p_paper_size,
      'color_mode', p_color_mode,
      'sides', p_sides,
      'pages', p_pages,
      'copies', p_copies,
      'price_per_page', v_price_per_page,
      'pages_cost', v_pages_cost,
      'discount_percent', v_discount_pct,
      'subtotal', v_subtotal,
      'finishing', v_finishing_items,
      'finishing_total', v_finishing_total,
      'min_order_total', v_min_order,
      'file_name', left(coalesce(p_file_name, ''), 200),
      'file_type', left(coalesce(p_file_type, ''), 80),
      'file_size', coalesce(p_file_size, 0),
      'is_estimated', coalesce(p_is_estimated, false)
    ),
    p_file_path
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_code', v_order_code,
    'total', v_total,
    'subtotal', v_subtotal,
    'discount_percent', v_discount_pct,
    'finishing_total', v_finishing_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_store_order(
  p_customer_name text,
  p_phone text,
  p_delivery_type text,
  p_address text,
  p_notes text,
  p_items jsonb,
  p_honeypot text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
  v_orders_enabled boolean;
  v_item jsonb;
  v_prod record;
  v_qty integer;
  v_line_total numeric(10, 2);
  v_total numeric(10, 2) := 0;
  v_items_snapshot jsonb := '[]'::jsonb;
  v_order_code text;
  v_order_id uuid;
BEGIN
  -- Honeypot anti-spam check
  IF coalesce(trim(p_honeypot), '') <> '' THEN
    RAISE EXCEPTION 'Invalid submission';
  END IF;

  SELECT value INTO v_config FROM public.settings WHERE key = 'print_config';
  v_orders_enabled := coalesce((v_config->>'orders_enabled')::boolean, true);

  IF NOT v_orders_enabled THEN
    RAISE EXCEPTION 'ORDERS_PAUSED';
  END IF;

  IF length(trim(coalesce(p_customer_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF length(regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g')) < 8 THEN
    RAISE EXCEPTION 'Valid phone number is required';
  END IF;
  IF p_delivery_type NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Invalid delivery type';
  END IF;
  IF p_delivery_type = 'delivery' AND length(trim(coalesce(p_address, ''))) < 4 THEN
    RAISE EXCEPTION 'Delivery address is required';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := (v_item->>'qty')::integer;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 1000 THEN
      RAISE EXCEPTION 'Invalid item quantity';
    END IF;

    SELECT id, name_en, name_ar, price, stock, active
    INTO v_prod
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid
    FOR UPDATE;

    IF v_prod.id IS NULL OR NOT v_prod.active THEN
      RAISE EXCEPTION 'Product unavailable';
    END IF;
    IF v_prod.stock < v_qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%', v_prod.name_en;
    END IF;

    UPDATE public.products
    SET stock = stock - v_qty
    WHERE id = v_prod.id;

    v_line_total := round(v_prod.price * v_qty, 2);
    v_total := v_total + v_line_total;

    v_items_snapshot := v_items_snapshot || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_prod.id,
        'name_en', v_prod.name_en,
        'name_ar', v_prod.name_ar,
        'unit_price', v_prod.price,
        'qty', v_qty,
        'line_total', v_line_total
      )
    );
  END LOOP;

  v_order_code := 'BP-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  INSERT INTO public.orders (
    order_code,
    kind,
    customer_name,
    phone,
    delivery_type,
    address,
    notes,
    total,
    status,
    items
  ) VALUES (
    v_order_code,
    'store',
    left(trim(p_customer_name), 120),
    left(trim(p_phone), 40),
    p_delivery_type,
    left(trim(coalesce(p_address, '')), 400),
    left(trim(coalesce(p_notes, '')), 1000),
    v_total,
    'New',
    v_items_snapshot
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'id', v_order_id,
    'order_code', v_order_code,
    'total', v_total,
    'items', v_items_snapshot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_print_order(text, text, text, text, text, text, text, text, integer, integer, uuid[], text, text, text, bigint, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_print_order(text, text, text, text, text, text, text, text, integer, integer, uuid[], text, text, text, bigint, boolean, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_store_order(text, text, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_store_order(text, text, text, text, text, jsonb, text) TO anon, authenticated;

-- 5. STORAGE BUCKETS & POLICIES
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'print-files',
  'print-files',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880;

-- print-files: visitors can ONLY insert; ONLY admins can select/read/delete
DROP POLICY IF EXISTS "print_files_anon_insert" ON storage.objects;
CREATE POLICY "print_files_anon_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'print-files'
    AND lower(storage.extension(name)) IN ('pdf', 'jpg', 'jpeg', 'png', 'docx', 'pptx')
  );

DROP POLICY IF EXISTS "print_files_admin_select" ON storage.objects;
CREATE POLICY "print_files_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'print-files' AND public.is_admin());

DROP POLICY IF EXISTS "print_files_admin_delete" ON storage.objects;
CREATE POLICY "print_files_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'print-files' AND public.is_admin());

-- product-images: public read, admin write
DROP POLICY IF EXISTS "product_images_public_read" ON storage.objects;
CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_admin_insert" ON storage.objects;
CREATE POLICY "product_images_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_update" ON storage.objects;
CREATE POLICY "product_images_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "product_images_admin_delete" ON storage.objects;
CREATE POLICY "product_images_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- 6. SEED DATA (Safe defaults; editable anytime from Admin Panel)
-- -----------------------------------------------------------------------------

INSERT INTO public.settings (key, value, is_public) VALUES
(
  'shop_info',
  '{
    "name_en": "Al-Badran Printing",
    "name_ar": "البدران للطباعة",
    "whatsapp": "201018433984",
    "phone": "01018433984",
    "address_en": "Cairo, Egypt (Update address in Admin Settings)",
    "address_ar": "القاهرة، مصر (حدّث العنوان من لوحة الأدمن)",
    "hours_en": "Sat–Thu: 9:00 AM – 10:00 PM",
    "hours_ar": "السبت – الخميس: ٩ ص – ١٠ م",
    "currency": "EGP"
  }'::jsonb,
  true
),
(
  'print_config',
  '{
    "min_order_total": 10,
    "max_file_mb": 50,
    "orders_enabled": true
  }'::jsonb,
  true
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.print_prices (paper_size, color_mode, sides, price_per_page, active) VALUES
  ('A4', 'bw',     'single', 0.50, true),
  ('A4', 'bw',     'double', 0.85, true),
  ('A4', 'color',  'single', 2.50, true),
  ('A4', 'color',  'double', 4.50, true),
  ('A5', 'bw',     'single', 0.35, true),
  ('A5', 'bw',     'double', 0.60, true),
  ('A5', 'color',  'single', 1.50, true),
  ('A5', 'color',  'double', 2.75, true),
  ('A3', 'bw',     'single', 1.25, true),
  ('A3', 'bw',     'double', 2.00, true),
  ('A3', 'color',  'single', 6.00, true),
  ('A3', 'color',  'double', 10.50, true)
ON CONFLICT (paper_size, color_mode, sides) DO NOTHING;

INSERT INTO public.quantity_discounts (min_copies, discount_percent) VALUES
  (50,  5),
  (100, 10),
  (250, 15),
  (500, 20)
ON CONFLICT (min_copies) DO NOTHING;

INSERT INTO public.finishing_options (id, name_en, name_ar, price, price_type, active, sort) VALUES
  ('11111111-1111-4111-8111-111111111101', 'Corner Stapling', 'تدبيس جانبي', 2.00, 'per_copy', true, 1),
  ('11111111-1111-4111-8111-111111111102', 'Spiral Binding + Cover', 'تغليف سبيرال + غلاف شفاف', 15.00, 'per_copy', true, 2),
  ('11111111-1111-4111-8111-111111111103', 'Thermal Lamination', 'تغليف حراري (سلوفان)', 10.00, 'per_copy', true, 3),
  ('11111111-1111-4111-8111-111111111104', 'Precision Trimming', 'قص وتشذيب بالماكينة', 20.00, 'flat', true, 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categories (id, name_en, name_ar, sort) VALUES
  ('22222222-2222-4222-8222-222222222201', 'Paper Cartons & Reams', 'كراتين ورزم ورق', 1),
  ('22222222-2222-4222-8222-222222222202', 'Inks & Toners', 'أحبار وتونر', 2),
  ('22222222-2222-4222-8222-222222222203', 'Binding & Supplies', 'مستلزمات تغليف وطباعة', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (id, category_id, name_en, name_ar, description_en, description_ar, price, image_url, stock, active) VALUES
  (
    '33333333-3333-4333-8333-333333333301',
    '22222222-2222-4222-8222-222222222201',
    'A4 Copy Paper Box (5 Reams / 80gsm)',
    'كرتونة ورق تصوير A4 (٥ رزم / ٨٠ جم)',
    'Bright white 80gsm laser & inkjet paper carton, 2500 sheets total.',
    'كرتونة ورق أبيض ناصع ٨٠ جرام مناسب لطابعات الليزر والإنك جيت، إجمالي ٢٥٠٠ ورقة.',
    920.00,
    '',
    24,
    true
  ),
  (
    '33333333-3333-4333-8333-333333333302',
    '22222222-2222-4222-8222-222222222201',
    'A4 Single Ream (500 Sheets / 80gsm)',
    'رزمة ورق A4 مفردة (٥٠٠ ورقة / ٨٠ جم)',
    'Smooth jam-free 80gsm A4 paper for daily office & student printing.',
    'رزمة ورق ٨٠ جرام ناعم بدون انحشار للطباعة اليومية والمذكرات.',
    195.00,
    '',
    60,
    true
  ),
  (
    '33333333-3333-4333-8333-333333333303',
    '22222222-2222-4222-8222-222222222202',
    'CMYK Ink Bottle Set (4 x 100ml)',
    'طقم أحبار CMYK كامل (٤ × ١٠٠ مل)',
    'High-yield Cyan, Magenta, Yellow & Black refill ink bottles for EcoTank printers.',
    'طقم أحبار إعادة تعبئة عالي الكثافة (سماوي، ماجنتا، أصفر، أسود) لطابعات التانك.',
    460.00,
    '',
    12,
    true
  ),
  (
    '33333333-3333-4333-8333-333333333304',
    '22222222-2222-4222-8222-222222222202',
    'Black Laser Toner Cartridge',
    'حبر ليزر أسود عالي الجودة',
    'Crisp dark black toner cartridge yielding up to 2,000 sharp pages.',
    'كارتريدج حبر ليزر أسود داكن يطبع حتى ٢٠٠٠ صفحة بجودة عالية.',
    380.00,
    '',
    4,
    true
  ),
  (
    '33333333-3333-4333-8333-333333333305',
    '22222222-2222-4222-8222-222222222203',
    'Thermal Lamination Pouches A4 (100 Pack)',
    'أكياس تغليف حراري A4 (علبة ١٠٠ ورقة)',
    'Crystal clear 125-micron gloss pouches for certificates and menus.',
    'أكياس تغليف حراري شفافة ١٢٥ ميكرون للشهادات والمنيوهات.',
    240.00,
    '',
    18,
    true
  ),
  (
    '33333333-3333-4333-8333-333333333306',
    '22222222-2222-4222-8222-222222222203',
    'Spiral Binding Coils Pack (50 pcs)',
    'عبوة سلك سبيرال للتغليف (٥٠ قطعة)',
    'Durable 12mm binding coils for booklets, theses, and notebooks.',
    'سلك سبيرال متين مقاس ١٢ مم لتغليف الكتب والأبحاث والمذكرات.',
    135.00,
    '',
    0,
    true
  )
ON CONFLICT (id) DO NOTHING;
