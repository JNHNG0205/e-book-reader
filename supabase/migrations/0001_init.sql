-- Extensions
create extension if not exists "pgcrypto";

-- Helper: auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- BOOKS
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  format text not null check (format in ('pdf','epub')),
  storage_path text not null,
  cover_path text,
  total_pages int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger books_updated before update on public.books
  for each row execute function public.set_updated_at();

-- READING PROGRESS
create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  location text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);
create trigger reading_progress_updated before update on public.reading_progress
  for each row execute function public.set_updated_at();

-- HIGHLIGHTS
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  color text not null,
  note text,
  anchor jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger highlights_updated before update on public.highlights
  for each row execute function public.set_updated_at();

-- BOOKMARKS
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  location text not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bookmarks_updated before update on public.bookmarks
  for each row execute function public.set_updated_at();

-- Row-Level Security: owner-only for every table
alter table public.books enable row level security;
alter table public.reading_progress enable row level security;
alter table public.highlights enable row level security;
alter table public.bookmarks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['books','reading_progress','highlights','bookmarks'] loop
    execute format($f$
      create policy "own_select_%1$s" on public.%1$s for select using (auth.uid() = user_id);
      create policy "own_insert_%1$s" on public.%1$s for insert with check (auth.uid() = user_id);
      create policy "own_update_%1$s" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
      create policy "own_delete_%1$s" on public.%1$s for delete using (auth.uid() = user_id);
    $f$, t);
  end loop;
end $$;

-- Storage bucket for book files (private) + per-owner policies.
-- Files are stored under a path prefixed by the user's id: `<uid>/<book_id>.<ext>`.
insert into storage.buckets (id, name, public)
  values ('books', 'books', false)
  on conflict (id) do nothing;

create policy "own_read_books_files" on storage.objects for select
  using (bucket_id = 'books' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own_write_books_files" on storage.objects for insert
  with check (bucket_id = 'books' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own_update_books_files" on storage.objects for update
  using (bucket_id = 'books' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'books' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own_delete_books_files" on storage.objects for delete
  using (bucket_id = 'books' and auth.uid()::text = (storage.foldername(name))[1]);
