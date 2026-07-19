-- ============================================================
-- WhatsApp Shop — Supabase Migration
-- Run this in Supabase SQL Editor (Session 2)
-- ============================================================

-- Enable pgvector extension (needed for RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── shops ───────────────────────────────────────────────────
-- One row per registered shop / business
CREATE TABLE IF NOT EXISTS shops (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_phone      TEXT UNIQUE NOT NULL,
  shop_name        TEXT,
  is_active        BOOLEAN DEFAULT false,
  trial_ends_at    TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  plan             TEXT DEFAULT 'pro',
  razorpay_customer_id TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── users ───────────────────────────────────────────────────
-- Owner + staff members for a shop
CREATE TABLE IF NOT EXISTS users (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone    TEXT UNIQUE NOT NULL,
  shop_id  UUID REFERENCES shops(id) ON DELETE CASCADE,
  role     TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'staff')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── products ────────────────────────────────────────────────
-- Inventory items. embedding column enables RAG search.
CREATE TABLE IF NOT EXISTS products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID REFERENCES shops(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  quantity      NUMERIC DEFAULT 0,
  unit          TEXT DEFAULT 'units',
  low_threshold NUMERIC DEFAULT 5,
  embedding     VECTOR(1536),       -- OpenAI text-embedding-3-small dimension
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast vector similarity search
CREATE INDEX IF NOT EXISTS products_embedding_idx
  ON products USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─── orders ──────────────────────────────────────────────────
-- Order log. items_json stores array of {name, qty, price}
CREATE TABLE IF NOT EXISTS orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID REFERENCES shops(id) ON DELETE CASCADE,
  customer_name TEXT,
  items_json    JSONB DEFAULT '[]',
  total_amount  NUMERIC DEFAULT 0,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'delivered', 'cancelled')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── ledger ──────────────────────────────────────────────────
-- Customer credit/debit tracking (baaki system)
CREATE TABLE IF NOT EXISTS ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID REFERENCES shops(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  amount        NUMERIC NOT NULL,
  type          TEXT DEFAULT 'credit' CHECK (type IN ('credit', 'payment')),
  note          TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ─── messages ────────────────────────────────────────────────
-- Full message log for RAGAS evaluation + debugging
CREATE TABLE IF NOT EXISTS messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID REFERENCES shops(id) ON DELETE CASCADE,
  direction  TEXT CHECK (direction IN ('inbound', 'outbound')),
  body       TEXT,
  intent     TEXT,
  from_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Seed: one demo shop for testing (optional)
-- ============================================================
-- INSERT INTO shops (owner_phone, shop_name, is_active)
-- VALUES ('919876543210', 'Sharma General Store', true);
