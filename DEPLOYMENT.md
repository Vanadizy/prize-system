# GitHub and Render deployment

This project has separate services for the React frontend, Express API, and PostgreSQL database. The steps below use GitHub for source control and Render for hosting.

## 1. Create a clean GitHub repository

The existing local Git history tracks `backend/.env` and `frontend/.env`. Do not push that history to a new repository: deleting a tracked `.env` from the latest commit does not remove it from earlier commits. This guide creates a clean copy without the Git history, local environment files, installed packages, or generated QR image files.

In PowerShell, run:

```powershell
Set-Location (Join-Path $env:USERPROFILE "Desktop")
$target = Join-Path (Get-Location) "GuestSystem-live"
if (Test-Path $target) { throw "GuestSystem-live already exists. Choose another clean folder name." }
robocopy .\GuestSystem $target /E /XD .git node_modules qrcodes dist /XF .env .env.local
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
| `FRONTEND_URL` | Exact HTTPS URL of the Render static site, after you create it |
| `ADMIN_PASSWORD` | Strong initial password; used only if the database has no administrator yet |

If you imported the local database, it includes the local admin account hash, so log in with the existing admin credentials. `ADMIN_PASSWORD` will not replace an administrator in an imported database. The backend now creates the default `admin` user only if no admin exists; restarting the service will not reset a changed password.

Render's [Express deployment guide](https://render.com/docs/deploy-node-express-app) and [environment-variable guide](https://render.com/docs/configure-environment-variables) describe these settings. Keep secrets in Render's environment settings, not in the repository.

## 5. Deploy the React frontend

Create a **Static Site** in Render using the same repository:

- Root Directory: `frontend`
- Build Command: `npm install && npm run build`
- Publish Directory: `dist`
- Environment Variable `VITE_API_URL`: the backend's HTTPS base URL, for example `https://your-api.onrender.com` (do not add `/api`)

After Render assigns the static-site URL, set the backend's `FRONTEND_URL` to that exact URL and redeploy the backend. The live site uses HTTPS, which browsers require for camera access outside localhost. See Render's [static site deployment fields](https://render.com/docs/your-first-deploy).

The backend regenerates missing QR PNG files from ticket IDs at startup. The database is the durable source of ticket data; do not rely on the web service's local QR image folder as persistent storage.

## 6. Change the live administrator login

Sign in at the live site and open the admin dashboard. In **Change administrator credentials**, enter the current password, a new username, and a password of at least eight characters, then select **Update admin login**. The change is stored as a bcrypt password hash in PostgreSQL, survives service restarts, and signs out other admin sessions. Save the new credentials in a password manager.

For future updates, commit and push from `GuestSystem-live`; Render will deploy the connected branch automatically.
