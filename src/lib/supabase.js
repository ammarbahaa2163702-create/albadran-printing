import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const DEFAULT_WHATSAPP = (import.meta.env.VITE_WHATSAPP_NUMBER || '201018433984').trim();

export function isSupabaseConfigured() {
  return (
    Boolean(SUPABASE_URL) &&
    Boolean(SUPABASE_ANON_KEY) &&
    !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE') &&
    SUPABASE_URL.startsWith('https://')
  );
}

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export const FALLBACK_DATA = {
  shop_info: {
    name_en: 'Al-Badran Printing',
    name_ar: 'البدران للطباعة',
    whatsapp: DEFAULT_WHATSAPP,
    phone: '01018433984',
    address_en: 'Cairo, Egypt (Update address in Admin Settings)',
    address_ar: 'القاهرة، مصر (حدّث العنوان من لوحة الأدمن)',
    hours_en: 'Sat–Thu: 9:00 AM – 10:00 PM',
    hours_ar: 'السبت – الخميس: ٩ ص – ١٠ م',
    currency: 'EGP',
  },
  print_config: {
    min_order_total: 10,
    max_file_mb: 50,
    orders_enabled: true,
  },
  print_prices: [
    { id: 'p1', paper_size: 'A4', color_mode: 'bw', sides: 'single', price_per_page: 0.5, active: true },
    { id: 'p2', paper_size: 'A4', color_mode: 'bw', sides: 'double', price_per_page: 0.85, active: true },
    { id: 'p3', paper_size: 'A4', color_mode: 'color', sides: 'single', price_per_page: 2.5, active: true },
    { id: 'p4', paper_size: 'A4', color_mode: 'color', sides: 'double', price_per_page: 4.5, active: true },
    { id: 'p5', paper_size: 'A5', color_mode: 'bw', sides: 'single', price_per_page: 0.35, active: true },
    { id: 'p6', paper_size: 'A5', color_mode: 'bw', sides: 'double', price_per_page: 0.6, active: true },
    { id: 'p7', paper_size: 'A5', color_mode: 'color', sides: 'single', price_per_page: 1.5, active: true },
    { id: 'p8', paper_size: 'A5', color_mode: 'color', sides: 'double', price_per_page: 2.75, active: true },
    { id: 'p9', paper_size: 'A3', color_mode: 'bw', sides: 'single', price_per_page: 1.25, active: true },
    { id: 'p10', paper_size: 'A3', color_mode: 'bw', sides: 'double', price_per_page: 2.0, active: true },
    { id: 'p11', paper_size: 'A3', color_mode: 'color', sides: 'single', price_per_page: 6.0, active: true },
    { id: 'p12', paper_size: 'A3', color_mode: 'color', sides: 'double', price_per_page: 10.5, active: true },
  ],
  quantity_discounts: [
    { id: 'd1', min_copies: 50, discount_percent: 5 },
    { id: 'd2', min_copies: 100, discount_percent: 10 },
    { id: 'd3', min_copies: 250, discount_percent: 15 },
    { id: 'd4', min_copies: 500, discount_percent: 20 },
  ],
  finishing_options: [
    { id: '11111111-1111-4111-8111-111111111101', name_en: 'Corner Stapling', name_ar: 'تدبيس جانبي', price: 2, price_type: 'per_copy', active: true, sort: 1 },
    { id: '11111111-1111-4111-8111-111111111102', name_en: 'Spiral Binding + Cover', name_ar: 'تغليف سبيرال + غلاف شفاف', price: 15, price_type: 'per_copy', active: true, sort: 2 },
    { id: '11111111-1111-4111-8111-111111111103', name_en: 'Thermal Lamination', name_ar: 'تغليف حراري (سلوفان)', price: 10, price_type: 'per_copy', active: true, sort: 3 },
    { id: '11111111-1111-4111-8111-111111111104', name_en: 'Precision Trimming', name_ar: 'قص وتشذيب بالماكينة', price: 20, price_type: 'flat', active: true, sort: 4 },
  ],
  categories: [
    { id: '22222222-2222-4222-8222-222222222201', name_en: 'Paper Cartons & Reams', name_ar: 'كراتين ورزم ورق', sort: 1 },
    { id: '22222222-2222-4222-8222-222222222202', name_en: 'Inks & Toners', name_ar: 'أحبار وتونر', sort: 2 },
    { id: '22222222-2222-4222-8222-222222222203', name_en: 'Binding & Supplies', name_ar: 'مستلزمات تغليف وطباعة', sort: 3 },
  ],
  products: [
    {
      id: '33333333-3333-4333-8333-333333333301',
      category_id: '22222222-2222-4222-8222-222222222201',
      name_en: 'A4 Copy Paper Box (5 Reams / 80gsm)',
      name_ar: 'كرتونة ورق تصوير A4 (٥ رزم / ٨٠ جم)',
      description_en: 'Bright white 80gsm laser & inkjet paper carton, 2500 sheets total.',
      description_ar: 'كرتونة ورق أبيض ناصع ٨٠ جرام مناسب لطابعات الليزر والإنك جيت، إجمالي ٢٥٠٠ ورقة.',
      price: 920,
      image_url: '',
      stock: 24,
      active: true,
    },
    {
      id: '33333333-3333-4333-8333-333333333302',
      category_id: '22222222-2222-4222-8222-222222222201',
      name_en: 'A4 Single Ream (500 Sheets / 80gsm)',
      name_ar: 'رزمة ورق A4 مفردة (٥٠٠ ورقة / ٨٠ جم)',
      description_en: 'Smooth jam-free 80gsm A4 paper for daily office & student printing.',
      description_ar: 'رزمة ورق ٨٠ جرام ناعم بدون انحشار للطباعة اليومية والمذكرات.',
      price: 195,
      image_url: '',
      stock: 60,
      active: true,
    },
    {
      id: '33333333-3333-4333-8333-333333333303',
      category_id: '22222222-2222-4222-8222-222222222202',
      name_en: 'CMYK Ink Bottle Set (4 x 100ml)',
      name_ar: 'طقم أحبار CMYK كامل (٤ × ١٠٠ مل)',
      description_en: 'High-yield Cyan, Magenta, Yellow & Black refill ink bottles for EcoTank printers.',
      description_ar: 'طقم أحبار إعادة تعبئة عالي الكثافة (سماوي، ماجنتا، أصفر، أسود) لطابعات التانك.',
      price: 460,
      image_url: '',
      stock: 12,
      active: true,
    },
    {
      id: '33333333-3333-4333-8333-333333333304',
      category_id: '22222222-2222-4222-8222-222222222202',
      name_en: 'Black Laser Toner Cartridge',
      name_ar: 'حبر ليزر أسود عالي الجودة',
      description_en: 'Crisp dark black toner cartridge yielding up to 2,000 sharp pages.',
      description_ar: 'كارتريدج حبر ليزر أسود داكن يطبع حتى ٢٠٠٠ صفحة بجودة عالية.',
      price: 380,
      image_url: '',
      stock: 4,
      active: true,
    },
    {
      id: '33333333-3333-4333-8333-333333333305',
      category_id: '22222222-2222-4222-8222-222222222203',
      name_en: 'Thermal Lamination Pouches A4 (100 Pack)',
      name_ar: 'أكياس تغليف حراري A4 (علبة ١٠٠ ورقة)',
      description_en: 'Crystal clear 125-micron gloss pouches for certificates and menus.',
      description_ar: 'أكياس تغليف حراري شفافة ١٢٥ ميكرون للشهادات والمنيوهات.',
      price: 240,
      image_url: '',
      stock: 18,
      active: true,
    },
    {
      id: '33333333-3333-4333-8333-333333333306',
      category_id: '22222222-2222-4222-8222-222222222203',
      name_en: 'Spiral Binding Coils Pack (50 pcs)',
      name_ar: 'عبوة سلك سبيرال للتغليف (٥٠ قطعة)',
      description_en: 'Durable 12mm binding coils for booklets, theses, and notebooks.',
      description_ar: 'سلك سبيرال متين مقاس ١٢ مم لتغليف الكتب والأبحاث والمذكرات.',
      price: 135,
      image_url: '',
      stock: 0,
      active: true,
    },
  ],
};

export async function fetchPublicBootstrap() {
  if (!supabase) {
    return { ...FALLBACK_DATA, demo: true };
  }

  const [
    settingsRes,
    pricesRes,
    discountsRes,
    finishingRes,
    categoriesRes,
    productsRes,
  ] = await Promise.all([
    supabase.from('settings').select('key, value'),
    supabase.from('print_prices').select('*').eq('active', true),
    supabase.from('quantity_discounts').select('*').order('min_copies'),
    supabase.from('finishing_options').select('*').eq('active', true).order('sort'),
    supabase.from('categories').select('*').order('sort'),
    supabase.from('products').select('*').eq('active', true).order('created_at', { ascending: false }),
  ]);

  const anyError =
    settingsRes.error ||
    pricesRes.error ||
    discountsRes.error ||
    finishingRes.error ||
    categoriesRes.error ||
    productsRes.error;

  if (anyError) {
    throw anyError;
  }

  const settingsMap = {};
  for (const row of settingsRes.data || []) {
    settingsMap[row.key] = row.value;
  }

  return {
    demo: false,
    shop_info: { ...FALLBACK_DATA.shop_info, ...(settingsMap.shop_info || {}) },
    print_config: { ...FALLBACK_DATA.print_config, ...(settingsMap.print_config || {}) },
    print_prices: pricesRes.data || [],
    quantity_discounts: discountsRes.data || [],
    finishing_options: finishingRes.data || [],
    categories: categoriesRes.data || [],
    products: productsRes.data || [],
  };
}

export async function uploadPrintFile(file) {
  if (!supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const dateFolder = new Date().toISOString().slice(0, 10);
  const path = `${dateFolder}/${uuid}.${ext}`;

  const { error } = await supabase.storage.from('print-files').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) throw error;
  return path;
}

export async function submitPrintOrder(payload) {
  if (!supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  const { data, error } = await supabase.rpc('create_print_order', {
    p_customer_name: payload.customerName,
    p_phone: payload.phone,
    p_delivery_type: payload.deliveryType,
    p_address: payload.address || '',
    p_notes: payload.notes || '',
    p_paper_size: payload.paperSize,
    p_color_mode: payload.colorMode,
    p_sides: payload.sides,
    p_pages: payload.pages,
    p_copies: payload.copies,
    p_finishing_ids: payload.finishingIds || [],
    p_file_path: payload.filePath,
    p_file_name: payload.fileName,
    p_file_type: payload.fileType,
    p_file_size: payload.fileSize,
    p_is_estimated: Boolean(payload.isEstimated),
    p_honeypot: payload.honeypot || '',
  });
  if (error) throw error;
  return data;
}

export async function submitStoreOrder(payload) {
  if (!supabase) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  const { data, error } = await supabase.rpc('create_store_order', {
    p_customer_name: payload.customerName,
    p_phone: payload.phone,
    p_delivery_type: payload.deliveryType,
    p_address: payload.address || '',
    p_notes: payload.notes || '',
    p_items: payload.items.map((i) => ({ product_id: i.id, qty: i.qty })),
    p_honeypot: payload.honeypot || '',
  });
  if (error) throw error;
  return data;
}
