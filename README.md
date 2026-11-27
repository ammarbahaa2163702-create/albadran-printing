# Al-Badran Printing (البدران للطباعة)

Lightweight, mobile-first online print calculator, supplies shop, and admin dashboard built with **Vite + Vanilla JS (ES Modules)**, **Supabase**, and **GitHub Pages**.

## Features
- **Online Print Calculator (`#/print`)**:
  - Client-side PDF page counting & thumbnail preview via lazy-loaded `pdfjs-dist` (not loaded on initial page visit).
  - Supports PDF, JPG/PNG (1 page per image), and DOCX/PPTX (manual page count with estimated notice).
  - Live breakdown of unit rate, quantity discounts, finishing options, and minimum order floor.
  - Server-side price recalculation & verification via `create_print_order()` Postgres RPC (`SECURITY DEFINER`).
  - Direct WhatsApp quote/order sharing in English or Arabic.
- **Supplies Shop (`#/shop` & `#/cart`)**:
  - Category filtering, search, stock badges, product detail modal, persistent `localStorage` cart.
  - Server-side stock check, stock deduction, and total calculation via `create_store_order()`.
- **Admin Dashboard (`#/admin`)** *(lazy-loaded & `noindex`)*:
  - Protected by Supabase Auth + `admins` table check.
  - Manage Orders (download files via temporary signed URLs, change status, edit final total, internal notes, WhatsApp customer).
  - Manage Print Prices, Volume Discounts, Finishing Options, and Minimum Order Total.
  - Manage Products & Categories with browser-side WebP image compression.
  - Manage Shop Settings (WhatsApp, phone, address, working hours, currency, max file size, Vacation Mode).
- **Bilingual EN / AR RTL**: Instant switch persisted in `localStorage`, CSS logical properties.

## Setup Instructions

### 1. Supabase Setup
1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in your Supabase Dashboard, paste the entire contents of `supabase/schema.sql`, and click **Run**.
3. Create your Admin user:
   - Go to **Authentication → Users → Add user** (email + password, auto-confirm enabled).
   - Copy the new user's **UUID** and run in SQL Editor:
     ```sql
     INSERT INTO public.admins (user_id) VALUES ('<USER_UUID_HERE>');
     ```
4. Go to **Project Settings → API** and copy your `Project URL` and `anon / publishable key`.

### 2. Local Environment
Copy `.env.example` to `.env` and fill in your values:
```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_or_anon_key
VITE_WHATSAPP_NUMBER=201018433984
```
Run locally:
```bash
npm install
npm run dev
```

### 3. GitHub Pages Deployment
1. Push this repository to GitHub (`albadran-printing`).
2. In your GitHub repo: **Settings → Pages → Source: GitHub Actions**.
3. In **Settings → Secrets and variables → Actions → Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_WHATSAPP_NUMBER`
4. Push to `main` — GitHub Actions builds and deploys automatically to `https://<user>.github.io/albadran-printing/`.

## Admin Operations Guide
- **Change Print Prices / Discounts / Finishing:** Open `#/admin` → **Print Prices**. Edit any rate or tier and click **Save** — changes apply immediately to customer quotes.
- **Add a Product:** Open `#/admin` → **Products** → **Add Product**, enter English & Arabic names/descriptions, price, stock, and choose an image (automatically resized and compressed to WebP before upload).
- **Pause Orders (Vacation Mode):** Open `#/admin` → **Settings** and uncheck **Accepting New Orders**.

## Architecture Decisions
- **Zero-framework Vanilla JS + Hash Routing:** Keeps initial gzipped JS well under 100KB and avoids 404s on GitHub Pages refresh.
- **Lazy `pdfjs-dist` & Admin Bundle:** Neither the PDF parser nor the Admin UI is downloaded on the landing page.
- **Strict RLS + RPC:** Public visitors never write directly to `orders`, cannot list or read `print-files`, and cannot trust-inject prices.
