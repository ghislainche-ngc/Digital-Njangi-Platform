-- ============================================================
-- NAAS — NjangiBridge Database Schema
-- Run this in Supabase SQL Editor (project → SQL Editor)
-- ============================================================

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  telegram_chat_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Njangi groups (one row per group = one tenant)
CREATE TABLE njangi_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contribution_amount NUMERIC(12, 2) NOT NULL,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'monthly')),
  rotation_type TEXT NOT NULL CHECK (rotation_type IN ('fixed', 'random', 'president')),
  penalty_per_day NUMERIC(10, 2) DEFAULT 0,
  payout_threshold_pct NUMERIC(5, 2) DEFAULT 100,
  approval_threshold NUMERIC(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memberships — role junction table (one per user per group)
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES njangi_groups(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('president', 'treasurer', 'secretary', 'member')),
  rotation_position INTEGER,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'removed')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_id)
);

-- Invitations (token-based, 7-day expiry)
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES njangi_groups(id),
  phone TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  invited_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- Cycles — one per contribution round
CREATE TABLE cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES njangi_groups(id),
  cycle_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, cycle_number)
);

-- Contributions — one per member per cycle
CREATE TABLE contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES cycles(id),
  user_id UUID REFERENCES users(id),
  group_id UUID REFERENCES njangi_groups(id),
  amount NUMERIC(12, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'confirmed', 'failed')),
  payment_method TEXT CHECK (payment_method IN ('momo_mtn', 'momo_orange', 'cash', 'bank')),
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  UNIQUE(cycle_id, user_id)
);

-- Payouts — one per cycle
CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID REFERENCES cycles(id),
  recipient_id UUID REFERENCES users(id),
  group_id UUID REFERENCES njangi_groups(id),
  amount NUMERIC(12, 2) NOT NULL,
  delivery_method TEXT CHECK (delivery_method IN ('momo_mtn', 'momo_orange', 'cash', 'bank')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'completed', 'failed', 'blocked')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment transactions — every MoMo / Orange API call
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type TEXT NOT NULL CHECK (reference_type IN ('contribution', 'payout')),
  reference_id UUID NOT NULL,
  gateway TEXT NOT NULL CHECK (gateway IN ('mtn_momo', 'orange_money')),
  external_ref TEXT,
  phone TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  attempts INTEGER DEFAULT 1,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fines
CREATE TABLE fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  group_id UUID REFERENCES njangi_groups(id),
  cycle_id UUID REFERENCES cycles(id),
  amount NUMERIC(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'waived')),
  applied_by UUID REFERENCES users(id),
  waived_by UUID REFERENCES users(id),
  waiver_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Audit log — immutable. No UPDATE or DELETE allowed.
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES njangi_groups(id),
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social fund events
CREATE TABLE social_fund_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES njangi_groups(id),
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount NUMERIC(12, 2) NOT NULL,
  reason TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row-Level Security on all tables
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE njangi_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines                ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_fund_events   ENABLE ROW LEVEL SECURITY;
