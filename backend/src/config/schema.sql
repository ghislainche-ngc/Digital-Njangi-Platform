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
  password_hash TEXT NOT NULL,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'fr')),
  telegram_chat_id TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OTP verification codes (10-minute expiry)
CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Njangi groups (one row per group = one tenant)
CREATE TABLE njangi_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contribution_amount NUMERIC(12, 2) NOT NULL,
  frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  rotation_type TEXT NOT NULL CHECK (rotation_type IN ('fixed', 'random', 'president')),
  penalty_per_day NUMERIC(10, 2) DEFAULT 0,
  payout_threshold_pct NUMERIC(5, 2) DEFAULT 100,
  approval_threshold NUMERIC(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  subscription_tier TEXT NOT NULL DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'growth', 'enterprise')),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled')),
  subscription_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
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
  payment_method TEXT CHECK (payment_method IN ('momo_mtn', 'momo_orange', 'cash', 'bank', 'campay')),
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
  delivery_method TEXT CHECK (delivery_method IN ('momo_mtn', 'momo_orange', 'cash', 'bank', 'campay')),
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
  gateway TEXT NOT NULL CHECK (gateway IN ('mtn_momo', 'orange_money', 'campay')),
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
ALTER TABLE otp_verifications    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Campay payment gateway columns (added 2026-05-23)
-- ============================================================

-- Collection rail. NOT NULL with a safe default so every existing group
-- keeps behaving identically until an admin opts them in.
ALTER TABLE njangi_groups
  ADD COLUMN IF NOT EXISTS preferred_gateway text NOT NULL DEFAULT 'mtn_momo';

-- Add check constraint separately or ensure it doesn't conflict
ALTER TABLE njangi_groups 
  DROP CONSTRAINT IF EXISTS njangi_groups_preferred_gateway_check;
ALTER TABLE njangi_groups
  ADD CONSTRAINT njangi_groups_preferred_gateway_check 
    CHECK (preferred_gateway IN ('mtn_momo', 'orange_money', 'campay'));

-- Payout rail. NULLABLE — NULL means "fall back to phone-prefix routing"
-- (the existing behavior). Setting it to 'campay' opts the group into
-- Campay disbursement; 'mtn_momo' / 'orange_money' force a specific
-- direct API (only sensible for single-operator groups).
ALTER TABLE njangi_groups
  ADD COLUMN IF NOT EXISTS preferred_payout_gateway text NULL;

ALTER TABLE njangi_groups 
  DROP CONSTRAINT IF EXISTS njangi_groups_preferred_payout_gateway_check;
ALTER TABLE njangi_groups
  ADD CONSTRAINT njangi_groups_preferred_payout_gateway_check 
    CHECK (preferred_payout_gateway IS NULL
           OR preferred_payout_gateway IN ('mtn_momo', 'orange_money', 'campay'));

-- ============================================================
-- SaaS Subscription & Monetization columns (added 2026-05-29)
-- ============================================================
ALTER TABLE njangi_groups
  ADD COLUMN IF NOT EXISTS subscription_tier text NOT NULL DEFAULT 'starter';

ALTER TABLE njangi_groups 
  DROP CONSTRAINT IF EXISTS njangi_groups_subscription_tier_check;
ALTER TABLE njangi_groups
  ADD CONSTRAINT njangi_groups_subscription_tier_check 
    CHECK (subscription_tier IN ('starter', 'growth', 'enterprise'));

ALTER TABLE njangi_groups
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active';

ALTER TABLE njangi_groups 
  DROP CONSTRAINT IF EXISTS njangi_groups_subscription_status_check;
ALTER TABLE njangi_groups
  ADD CONSTRAINT njangi_groups_subscription_status_check 
    CHECK (subscription_status IN ('active', 'past_due', 'canceled'));

ALTER TABLE njangi_groups
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz DEFAULT (now() + interval '30 days');

-- ============================================================
-- Platform Admin role column (added 2026-05-29)
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ============================================================
-- Group Announcements table (added 2026-06-04)
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES njangi_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Group Meeting Minutes table (added 2026-06-04)
-- ============================================================
CREATE TABLE IF NOT EXISTS meeting_minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES njangi_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date DATE NOT NULL,
  attendees INTEGER NOT NULL DEFAULT 0,
  pages INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  description TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE meeting_minutes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Security Upgrades: 2FA & Login History (added 2026-06-05)
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;




