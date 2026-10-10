-- Run once against an existing MoleClues database that used participant_name and participant_id.
-- It preserves previous attempts and lets the updated backend write only team_name.

alter table public.crossword_attempts
  add column if not exists team_name text;

update public.crossword_attempts
set team_name = coalesce(
  nullif(team_name, ''),
  nullif(concat_ws(' / ', participant_name, participant_id), ''),
  'Legacy team'
)
where team_name is null or team_name = '';

alter table public.crossword_attempts
  alter column team_name set not null;

-- Old fields are kept for existing data but made optional so new team-only attempts can be inserted.
alter table public.crossword_attempts
  alter column participant_name drop not null;

alter table public.crossword_attempts
  alter column participant_id drop not null;
