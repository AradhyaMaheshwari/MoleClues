# MoleClues Crossword

MoleClues is a mobile-friendly biology crossword for event teams. It records each official attempt's team name, start time, score, submission status, and server-measured elapsed time. The administrator page ranks fully correct attempts from fastest to slowest and lists all attempts, including those still in progress.

## Run locally on Windows

1. Make sure Node.js is installed (`node -v`).
2. Keep your private `backend/answers.json` file in place. It should contain `puzzleId`, a private `secretSalt`, and the answer map. This file is ignored by Git.
3. In the project root, run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File ".\scripts\run-local-server.ps1" -Port 3000
   ```

4. Open <http://localhost:3000> to play.
5. Open <http://localhost:3000/admin.html> for the administrator dashboard. The local server prints the local-only admin password in the terminal; by default it is `moleclues-local-admin`.

Local attempts are saved to `backend/attempts.json`. It is intentionally ignored by Git. This package starts with an empty attempt ledger (`[]`); to clear local results later, stop the server and replace the file contents with `[]`.

## Deploy to Netlify with a persistent leaderboard

The standalone local server stores attempts in a local JSON file. Netlify Functions are serverless and should not use a local file as permanent shared storage, so the deployed version stores attempts in Supabase.

### 1. Create the database table

1. Create a Supabase project.
2. Open **SQL Editor** in the Supabase dashboard.
3. For a new database, run `supabase/schema.sql`. If upgrading the earlier participant-name/ID version, run `supabase/migrate-team-name.sql` instead.
4. In **Settings / API Keys**, copy the project URL and create/copy a **secret key** for server-side use. Never add that key to frontend JavaScript or commit it to Git.

The table has Row Level Security enabled and no public policies. Only the server-side Netlify Functions should access it.

### 2. Add Netlify environment variables

In your Netlify site, open **Project configuration → Environment variables**. Add the following values (make sure the variables are available to Functions):

- `SUPABASE_URL`: your Supabase project URL, such as `https://YOUR_PROJECT.supabase.co`.
- `SUPABASE_SECRET_KEY`: the Supabase **secret key** (`sb_secret_...`). The code also supports the legacy `SUPABASE_SERVICE_ROLE_KEY`, but the new secret key is preferred.
- `ADMIN_PASSWORD`: a long, unique password only event administrators know.
- `SESSION_SECRET`: a randomly generated secret of at least 32 characters.
- `ANSWERS_JSON`: the complete private JSON contents from `backend/answers.json`, including the puzzle ID and answers. Keep this value only in Netlify's environment-variable settings—never in Git or frontend code.

To print a compact single-line version of your private answer file in PowerShell, run this locally:

```powershell
(Get-Content ".\backend\answers.json" -Raw | ConvertFrom-Json | ConvertTo-Json -Compress)
```

Copy the output into the `ANSWERS_JSON` value in Netlify. Do not paste it into a public issue, chat, README, or source file.

To generate a cryptographically random 32-byte secret in Windows PowerShell, run:

```powershell
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
[BitConverter]::ToString($bytes).Replace('-', '').ToLower()
$rng.Dispose()
```

### 3. Deploy and verify

Push the project to your Git repository and connect it to Netlify. The included `netlify.toml` configures `frontend` as the publish directory and routes `/api/session`, `/api/submit`, and `/api/leaderboard` to Netlify Functions.

After adding or changing Netlify environment variables, trigger a new deploy so the Functions use the updated values.

- Team site: `https://YOUR-SITE.netlify.app/`
- Private administrator dashboard: `https://YOUR-SITE.netlify.app/admin.html`

Open the admin URL and enter the `ADMIN_PASSWORD` value. The admin API checks the password on the server; the database secret key and answer key never go to the browser.

## Event behavior

- A team enters its team name before starting. The timer starts after the server registers the attempt.
- The server signs the team session token and measures elapsed time at each check; the browser timer is only a display.
- The crossword checks automatically once every cell is filled. If any answer is wrong, the team can edit entries and the timer continues until all answers are correct.
- Each new page load/team session starts with an empty crossword; previous localStorage letters are not restored.
- The crossword grid automatically fits the available screen width and height; there are no zoom controls. The layout adjusts for phones, tablets, and laptops.
- The database records a row when a team starts, updates the score after an incorrect check, and finalizes the time only when every answer is correct.
- The fastest-completion ranking includes only fully correct submissions. After a team completes the puzzle, the page switches to the final riddle and that team name cannot start or complete another official attempt.
- Attempts that were started but never submitted remain marked **In progress**. They are not included in the fastest-correct ranking.

## Security checklist before the event

- Never commit `backend/answers.json`, `backend/attempts.json`, private secrets, or a file containing the answer key.
- This project `.gitignore` excludes the two local JSON files; if either was already tracked by Git, remove it from tracking separately.
- Keep Supabase's secret key, `ADMIN_PASSWORD`, `SESSION_SECRET`, and `ANSWERS_JSON` in Netlify environment variables only.
- Team names are self-entered in this version. Completed team names are blocked from starting or finishing another official attempt, but this is not proof of identity; for stricter event control, validate team names against a pre-approved team list or require per-team entry codes.
- Review the public `README.md` and test files before publishing; they should not contain the puzzle's solutions.
