-- ============================================================
-- NAAS — Row-Level Security Policies
-- Run AFTER schema.sql in Supabase SQL Editor
-- ============================================================
-- These policies ensure multi-tenancy: a user can only see data
-- belonging to groups they are a member of.
-- ============================================================

-- Helper: check if the authenticated user is in a given group
-- (used by most policies below)

-- ─── njangi_groups ───────────────────────────────────────
-- Members can read their own groups
CREATE POLICY "members_read_own_group"
  ON njangi_groups FOR SELECT
  USING (
    id IN (
      SELECT group_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Only the creator (president) can update group settings
CREATE POLICY "president_update_group"
  ON njangi_groups FOR UPDATE
  USING (
    id IN (
      SELECT group_id FROM memberships
      WHERE user_id = auth.uid() AND role = 'president' AND status = 'active'
    )
  );

-- ─── memberships ─────────────────────────────────────────
-- Members can see who else is in their group
CREATE POLICY "members_read_own_memberships"
  ON memberships FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── contributions ───────────────────────────────────────
CREATE POLICY "members_read_own_contributions"
  ON contributions FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── payouts ─────────────────────────────────────────────
CREATE POLICY "members_read_own_payouts"
  ON payouts FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── fines ───────────────────────────────────────────────
CREATE POLICY "members_read_own_fines"
  ON fines FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── audit_events ────────────────────────────────────────
-- Read-only for group members — no UPDATE or DELETE policies (immutable)
CREATE POLICY "members_read_own_audit"
  ON audit_events FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── social_fund_events ──────────────────────────────────
CREATE POLICY "members_read_own_social_fund"
  ON social_fund_events FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ─── cycles ──────────────────────────────────────────────
CREATE POLICY "members_read_own_cycles"
  ON cycles FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- NOTE: The service-role key (used by the Express backend) bypasses ALL
-- RLS policies. These policies only apply to direct Supabase client calls.
-- The backend enforces tenant isolation at the middleware layer as well.
