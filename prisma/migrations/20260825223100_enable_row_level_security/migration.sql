-- Supabase automatically exposes every table in the public schema through
-- its own public REST API (PostgREST), gated by Row-Level Security. The
-- app itself never uses that API (Prisma connects directly as the
-- database owner via DATABASE_URL/DIRECT_URL), but leaving RLS disabled
-- means anyone with the project's public API key could read, write, or
-- delete these tables straight through Supabase's REST endpoint.
--
-- Enabling RLS with no policies denies all access through that REST API
-- by default, for every role except the table owner. It has no effect on
-- this app: Prisma connects as the table owner, and table owners bypass
-- Row-Level Security in Postgres unless FORCE ROW LEVEL SECURITY is also
-- set (it is not, here).

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClockEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CorrectionRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SchoolClosure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DeviceRequest" ENABLE ROW LEVEL SECURITY;
