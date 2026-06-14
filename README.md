# Strength Progress

A lightweight Progressive Web App for tracking strength training progress. Built with React, TypeScript, Vite, Supabase, and deployable on Vercel.

## Features

- **Multi-user auth** — email/password via Supabase Auth
- **Exercise library** — create, edit, archive exercises
- **Workout templates** — CRUD, drag-and-drop ordering, duplicate, active/inactive toggle
- **Active workouts** — log weight (kg), reps, RIR per set; see last session weight per exercise
- **1RM calculator** — Epley, Brzycki, Lombardi formulas with RIR adjustment
- **Dashboard** — weekly volume, 1RM trends, PR feed, progression suggestions
- **History** — completed workouts with set details
- **PWA** — installable on mobile and desktop

## Tech stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4 + shadcn-style components
- TanStack Query, React Router, React Hook Form + Zod
- Supabase (PostgreSQL, Auth, RLS)
- Recharts, @dnd-kit
- vite-plugin-pwa

## Local development

### 1. Clone and install

```bash
cd strength-progress
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Enable **Email** auth provider (Authentication → Providers)
3. Run migrations in order via the SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_exercises_grants_and_system.sql` (required if you already ran 001 before grants were added)
4. Copy your project URL and anon key from Settings → API

### 3. Environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 5. Run tests

```bash
npm test
```

## Deploy to Vercel

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy — `vercel.json` handles SPA routing

## Project structure

```
src/
  components/     UI and layout
  features/       Auth, exercises, templates, workouts APIs
  lib/            Supabase client, 1RM, progression logic
  pages/          Route pages
  types/          Shared TypeScript types
supabase/
  migrations/     SQL schema, RLS, triggers
```

## Default exercises

On sign-up, these compound lifts are seeded automatically:

- Bench Press
- Back Squat
- Deadlift
- Overhead Press
- Barbell Row

## Progression rules

The dashboard suggests:

- **+2.5 kg** when target reps are hit with RIR ≥ 2 for 2 consecutive sessions
- **Maintain** when RIR = 0 on the last set for 2 sessions
- **−2.5 kg** when below target reps for 2 sessions
- **Deload −10%** when no workout in 14+ days
