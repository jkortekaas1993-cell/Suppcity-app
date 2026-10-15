-- PT code format, mirrored by normalisePtCode() in src/lib/supabase/ptCode.ts.
-- The client sets its own profiles.pt_code (RLS profiles_update_own); this keeps the
-- value well-formed. There is no trainer registry yet (see docs/decisions.md).
alter table public.profiles
  add constraint profiles_pt_code_format check (pt_code is null or pt_code ~ '^[A-Z0-9]{4,12}$');
