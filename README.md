# E-Book Reader

A hosted web app for reading PDF and EPUB books, with per-user private libraries,
highlighting, bookmarks, and offline-first reading.

See [`docs/`](./docs) for the design spec and implementation plans.

## Development

Package manager/runtime: **Bun**.

```bash
bun install      # install dependencies
bun run dev      # start the dev server
bun run test     # run the Vitest suite (NOT `bun test`)
bun run build    # type-check + production build
```

Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.
