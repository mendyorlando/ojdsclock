-- _prisma_migrations is Prisma's own migration-history bookkeeping table
-- (just migration names/checksums/timestamps, no application data), but
-- it still lives in the public schema, so Supabase's security scanner
-- flags it the same way it flagged our application tables. Same fix:
-- enabling RLS with no policies blocks Supabase's public REST API while
-- leaving Prisma's direct owner connection unaffected.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
