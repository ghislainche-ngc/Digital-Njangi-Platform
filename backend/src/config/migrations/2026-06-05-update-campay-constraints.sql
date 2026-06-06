-- Migration: 2026-06-05 — update check constraints to support campay
-- Drop existing constraints
ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_gateway_check;
ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_payment_method_check;
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_delivery_method_check;

-- Add updated constraints allowing 'campay'
ALTER TABLE payment_transactions ADD CONSTRAINT payment_transactions_gateway_check CHECK (gateway IN ('mtn_momo', 'orange_money', 'campay'));
ALTER TABLE contributions ADD CONSTRAINT contributions_payment_method_check CHECK (payment_method IN ('momo_mtn', 'momo_orange', 'cash', 'bank', 'campay'));
ALTER TABLE payouts ADD CONSTRAINT payouts_delivery_method_check CHECK (delivery_method IN ('momo_mtn', 'momo_orange', 'cash', 'bank', 'campay'));
