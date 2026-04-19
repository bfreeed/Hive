-- ============================================================
-- Subproject Member Inheritance — one-time backfill
-- Merges parent project's member_ids into all existing subprojects.
-- Safe to re-run: only adds members, never removes.
-- ============================================================

UPDATE public.projects child
SET member_ids = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(child.member_ids || parent.member_ids)
    FROM public.projects parent
    WHERE parent.id = child.parent_id
  )
)
WHERE child.parent_id IS NOT NULL;
