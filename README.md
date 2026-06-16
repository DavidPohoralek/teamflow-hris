# HRIS — HR Information System

Multi-tenant HR/shift planning SaaS by **SelbickyLabs**.

## Tech stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Auth + PostgreSQL via `@supabase/ssr`)

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.local.example` to `.env.local` and fill in your Supabase anon key:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://vhsxussdtuacvvtexumd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. Run database migrations

In the Supabase dashboard, open the **SQL Editor** and run the contents of:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, enables Row Level Security, and sets up the auto-profile trigger.

### 4. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
  app/
    (auth)/          # Login, register pages
    (dashboard)/     # Protected dashboard pages
  components/        # Shared components (Sidebar, …)
  lib/supabase/      # Supabase client/server/middleware helpers
  types/             # TypeScript database types
supabase/
  migrations/        # SQL schema migrations
middleware.ts        # Session refresh middleware
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Redirect → `/dashboard` or `/login` |
| `/login` | Login form |
| `/register` | Organization registration |
| `/dashboard` | Overview with stat cards |
| `/employees` | Employee list |
| `/shifts` | Monthly shift calendar |
| `/attendance` | Attendance tracking |
| `/requests` | Vacation/sick/correction requests |
| `/settings` | Organization settings |

## GitHub

[github.com/DavidPohoralek](https://github.com/DavidPohoralek)
