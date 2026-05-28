-- Migration: 2026-05-23 — add per-group payment gateway columns
-- Spec: docs/superpowers/specs/2026-05-23-campay-gateway-design.md (commit 6ed3a7d)

-- Collection rail. NOT NULL with a safe default so every existing group
-- keeps behaving identically until an admin opts them in.
ALTER TABLE njangi_groups
  ADD COLUMN preferred_gateway text NOT NULL DEFAULT 'mtn_momo'
    CHECK (preferred_gateway IN ('mtn_momo', 'orange_money', 'campay'));

-- Payout rail. NULLABLE — NULL means "fall back to phone-prefix routing"
-- (the existing behavior). Setting it to 'campay' opts the group into
-- Campay disbursement; 'mtn_momo' / 'orange_money' force a specific
-- direct API (only sensible for single-operator groups).
ALTER TABLE njangi_groups
  ADD COLUMN preferred_payout_gateway text NULL
    CHECK (preferred_payout_gateway IS NULL
           OR preferred_payout_gateway IN ('mtn_momo', 'orange_money', 'campay'));
