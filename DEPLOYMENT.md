# GitHub and Render deployment

This project has separate services for the React frontend, Express API, and PostgreSQL database. The steps below use GitHub for source control and Render for hosting.

## 1. Create a clean GitHub repository

The existing local Git history tracks `backend/.env` and `frontend/.env`. Do not push that history to a new repository: deleting a tracked `.env` from the latest commit does not remove it from earlier commits. This guide creates a clean copy without the Git history, local environment files, installed packages, or generated QR image files.

In PowerShell, run:

```powershell
Set-Location (Join-Path $env:USERPROFILE "Desktop")
$target = Join-Path (Get-Location) "GuestSystem-live"
if (Test-Path $target) { throw "GuestSystem-live already exists. Choose another clean folder name." }
robocopy .\GuestSystem $target /E /XD .git node_modules qrcodes dist database-backup /XF .env .env.local
if ($LASTEXITCODE -ge 8) { throw "Copy failed. Robocopy exit code: $LASTEXITCODE" }
Set-Location $target
git init -b main
git add .
git status --short
```

Review the files listed by `git status --short`. Check that neither `.env` nor generated QR PNGs are listed, then make the first commit:

```powershell
git commit -m "Prepare contest QR system for live hosting"
```

On GitHub, open **New repository**, create a private repository (for example, `contest-qr-live`), and leave the initialize-with-README option unchecked. Then connect and push the clean copy:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/contest-qr-live.git
git push -u origin main
```

`gh` (GitHub CLI) is not installed in this workspace, so create the empty GitHub repository in the browser first. GitHub's [instructions for creating a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository) cover that screen flow.

If credentials in either local `.env` were ever pushed to a remote, rotate them. GitHub notes that secrets can persist in repository history and clones; simply removing the file from the latest version does not erase the old copies. See [GitHub's sensitive data guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

## 2. Export the local PostgreSQL database

Install PostgreSQL command-line tools on the computer if `pg_dump` and `pg_restore` are not already available. In PowerShell, create a custom-format backup; `-W` asks for the local PostgreSQL password without placing it in the command:

```powershell
pg_dump -h localhost -p 5432 -U postgres -W -d contest_system -Fc -f "$env:USERPROFILE\Desktop\contest-system.dump"
```

The backup contains the contestant tickets, their used status and prize details, scan-window settings, and administrator password hash. Keep the dump private and out of GitHub.

### Import with pgAdmin

Use the generated SQL file at `database-backup/contest_system_export.sql`. It contains the local database's schema and data as SQL `CREATE` and `INSERT` statements, including the administrator hash, so it can be opened in pgAdmin's Query Tool. Keep it private.

1. In Render, create a new empty PostgreSQL database. A Render database may already have its default database created; use that empty database as the target.
2. In pgAdmin, register the Render database using the **External Database URL** values from Render: hostname, port, database name, and username. Set the connection's SSL mode to **Require** and enter the database password.
3. Select the empty target database and open **Tools → Query Tool**.
4. In Query Tool, open `database-backup/contest_system_export.sql` and execute the script (F5). It restores data into the `public` schema. Leave the target empty before running it, so the script doesn't collide with existing tables or rows.
5. Verify the import with:

   ```sql
   SELECT COUNT(*) AS total_tickets,
          COUNT(*) FILTER (WHERE used_at IS NOT NULL) AS used_tickets
   FROM public.contestants;

   SELECT id, starts_at, expires_at
   FROM public.ticket_scan_window;

   SELECT username, role
   FROM public.users;
   ```

Use the Render **Internal Database URL** for the backend's `DATABASE_URL` after import. The external URL is for pgAdmin running on your computer. Render's [database restore documentation](https://render.com/docs/postgresql-backups) also recommends restoring exports into an empty database.

## 3. Create the Render database and import the backup

1. In Render, create a PostgreSQL database. Keep the database and the two app services in the same region.
2. From the Render database page, copy its **External Database URL** for the one-time import from your computer. Restore into a new, empty Render database. Do not use `--clean` against a database that already contains live data.
3. In PowerShell, enter the External Database URL without putting it in a saved command, then restore:

```powershell
$secureUrl = Read-Host "Render External Database URL" -AsSecureString
$urlPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
try {
    $env:RENDER_EXTERNAL_DATABASE_URL = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($urlPointer)
    pg_restore --no-owner --no-privileges --dbname=$env:RENDER_EXTERNAL_DATABASE_URL "$env:USERPROFILE\Desktop\contest-system.dump"
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($urlPointer)
    Remove-Item Env:\RENDER_EXTERNAL_DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Variable secureUrl -ErrorAction SilentlyContinue
}
```

Render's [PostgreSQL backup documentation](https://render.com/docs/postgresql-backups) describes `pg_dump` and `pg_restore` and recommends restoring a dump into an empty database. Use the database's **Internal Database URL** for the deployed backend service; keep the External URL for connections from your computer.

## 4. Deploy the Express backend

In Render, create a **Web Service** connected to the new GitHub repository. Configure:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Add these environment variables in Render's service settings:

| Key | Value |
| --- | --- |
| `DATABASE_URL` | Render PostgreSQL **Internal Database URL** |
| `DB_SSL` | `true` |
| `JWT_SECRET` | A new, long random secret used only by the live backend |
| `FRONTEND_URL` | Exact HTTPS URL of the Render frontend Node service, after you create it |
| `ADMIN_PASSWORD` | Strong initial password; used only if the database has no administrator yet |

If you imported the local database, it includes the local admin account hash, so log in with the existing admin credentials. `ADMIN_PASSWORD` will not replace an administrator in an imported database. The backend now creates the default `admin` user only if no admin exists; restarting the service will not reset a changed password.

Render's [Express deployment guide](https://render.com/docs/deploy-node-express-app) and [environment-variable guide](https://render.com/docs/configure-environment-variables) describe these settings. Keep secrets in Render's environment settings, not in the repository.

## 5. Deploy on Rodline Node app hosting

Create two Node applications from the same GitHub repository: one for the API and one for the React frontend. In CloudLinux Node.js Selector, configure each app with its own application root and virtual environment, then use the Selector's **Run NPM Install** action after uploading `package.json` and `package-lock.json`. Do not upload a `node_modules` directory. The API application's root is `backend`; its startup file is `server.js` (or use `npm start`). Configure `DATABASE_URL`, `DB_SSL`, `JWT_SECRET`, `FRONTEND_URL`, `PUBLIC_API_URL`, and the other backend variables in its app settings. Set `PUBLIC_API_URL` to `https://api.malenyapharmacy.com` (the public API origin) and `FRONTEND_URL` to the public frontend origin, for example `https://check.malenyapharmacy.com`.

Configure the frontend Node application as follows:

- Root Directory: `frontend`
- Install dependencies in the frontend app's activated Selector environment with `npm install --include=dev`
- Build Command: `npm run build`
- Start Command: `npm start`
- Environment Variable `VITE_API_URL`: the backend's HTTPS base URL (do not add `/api`)

If Rodline provides a combined build command, activate the frontend app's Selector environment first, then run `npm install --include=dev && npm run build`. Vite is listed under `devDependencies`, so an install that omits development packages leaves Vite unavailable. The build script limits Tailwind's Rayon worker pool for CloudLinux shared-host thread limits. Run the commands separately if checking the install: `npm install --include=dev`, `npm ls vite --depth=0`, then `npm run build`. The version check should list Vite 7. Do not run `npm start` until the build succeeds. `frontend/server.js` serves the built `dist` files and sends React routes such as `/admin` back to `index.html`. It listens on the hosting platform's `PORT` and `0.0.0.0`. Set `VITE_API_URL` before building, because Vite embeds that value into the frontend bundle. Set the backend's `FRONTEND_URL` to the frontend's exact HTTPS URL. HTTPS is required for camera access outside localhost.

### Populate the hosted database

The backend creates the required tables and the initial `admin` account when it starts against an empty PostgreSQL database. It also applies the QSN/branding schema migration on startup. Set the live database connection in the backend app's environment settings, restart the backend, then sign in to the admin page, upload the campaign logo, create QSN ticket IDs, and assign result details to selected tickets. No contestant login is needed.

For a manual PostgreSQL upgrade, run [`backend/migrations/qr_ticket_format.sql`](backend/migrations/qr_ticket_format.sql) in pgAdmin's Query Tool while connected to the existing database. It adds per-ticket display labels and URLs, random public QR tokens, a branding settings table, and the 1–9999 ID check. The backend applies these schema changes and backfills tokens automatically at startup as well.

QR images contain an HTTPS link on `PUBLIC_API_URL` with a cryptographically random 256-bit ticket token in the path. The QSN number is not included in the public URL. A phone's built-in camera opens that API link, which redirects to the branded public ticket page on `FRONTEND_URL` without using the ticket. Scanning inside the site's scanner calls the separate atomic redemption endpoint and marks the ticket used. On upgrade, the backend assigns tokens to existing tickets and regenerates local QR image files. Download fresh QR codes from the admin dashboard and reprint any previously distributed QR codes; old links containing QSN IDs will no longer resolve.

To copy the existing local records instead, connect to the Rodline PostgreSQL database in pgAdmin (using Rodline's connection details and SSL requirement), select that database, open **Tools → Query Tool**, open `database-backup/contest_system_export.sql`, and execute it only on an empty database. This export includes 20 existing tickets, an administrator row, and scan-window dates that expired on 2026-10-18; review or change the scan window in the admin interface after importing. Do not execute it on a database that already has tables or live records. Verify the import with `SELECT COUNT(*) FROM public.contestants;`.

The backend regenerates missing or outdated QR PNGs from the database at startup. The database is the durable source of ticket data; do not rely on the hosted app's local QR image folder as persistent storage.

## 6. Change the live administrator login

Sign in at the live site and open the admin dashboard. In **Change administrator credentials**, enter the current password, a new username, and a password of at least eight characters, then select **Update admin login**. The change is stored as a bcrypt password hash in PostgreSQL, survives service restarts, and signs out other admin sessions. Save the new credentials in a password manager.

For future updates, commit and push from `GuestSystem-live`; Render will deploy the connected branch automatically.
