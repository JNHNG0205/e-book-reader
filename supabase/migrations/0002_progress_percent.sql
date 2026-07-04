-- Adds a completion percentage (0–100) to reading progress, so the library can show how
-- far through each book the reader is. Computed client-side at save time (EPUB current/total,
-- PDF page/numPages). Nullable so existing rows and never-opened books simply have no percent.
alter table public.reading_progress add column if not exists percent int;
