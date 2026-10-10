-- Run this in Supabase Dashboard > SQL Editor.
-- Do not create a public SELECT/INSERT/UPDATE policy for this table.
-- Server-side Netlify Functions use the Supabase secret key to access it.

create table if not exists public.crossword_attempts (
  session_id text primary key,
  puzzle_id text not null,
  team_name text not null,
  started_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  score integer,
  total integer,
  all_correct boolean not null default false,
  time_seconds integer,
  created_at timestamptz not null default now(),
  constraint crossword_attempts_score_nonnegative check (score is null or score >= 0),
  constraint crossword_attempts_total_positive check (total is null or total > 0),
  constraint crossword_attempts_time_nonnegative check (time_seconds is null or time_seconds >= 0)
);

create index if not exists crossword_attempts_started_at_idx
  on public.crossword_attempts (started_at desc);

create index if not exists crossword_attempts_correct_time_idx
  on public.crossword_attempts (puzzle_id, all_correct, time_seconds asc)
  where status = 'submitted' and all_correct = true;

alter table public.crossword_attempts enable row level security;

-- Intentionally no anon/authenticated policies. Keep all reads/writes behind the server API.
