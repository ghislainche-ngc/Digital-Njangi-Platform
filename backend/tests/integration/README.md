# Integration Tests — Setup Guide

Integration tests hit a **real Supabase database**.
They are skip-guarded: if `backend/.env.test` is absent
the suite skips cleanly (no failures).

## 1. Create a throwaway Supabase project

1. Go to https://supabase.com and create a New project
2. Name it something like `naas-test`
3. Never use your production project for tests

## 2. Create `backend/.env.test`

Copy `.env.example` and fill in your test credentials: