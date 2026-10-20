# Contest QR System

An admin creates unique QSN tickets from `QSN 00001` through `QSN 09999`, uploads the campaign logo, and assigns winner/not-won text to one or many tickets. Downloaded QR codes open a public, branded ticket page when scanned with a phone camera. That public view does not use the ticket; scanning through the site's scanner atomically marks it used.

## Run locally

Requirements: Node.js 20+ and PostgreSQL 14+.

1. Create a PostgreSQL database, for example `contest_system`.
2. Copy `backend/.env.example` to `backend/.env` and enter your local PostgreSQL username and password. Set `DB_SSL=false` for a local database.
3. In PowerShell, run:

   ```powershell
   cd backend
   npm install
   npm start
   ```

   On first start, the backend creates the ticket, user, branding, and scan-window tables in PostgreSQL. It also applies the QSN and branding schema migration to an existing database. Ticket IDs remain integers in PostgreSQL and are displayed as padded QSN labels in the interface.

4. In a second PowerShell window, run:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

5. Open the Vite address shown in the terminal (normally `http://localhost:5173`).

## First admin account

On a new, empty database, the backend creates the initial administrator using `ADMIN_PASSWORD` (default `1234`) in `backend/.env`:

- Username: `admin`
- Password: `1234`

Ticket result pages are public. The home page includes the scanner, which marks a ticket as used when staff scan it. `/admin` checks the session with the backend, and all admin changes and ZIP downloads require an admin token.

For a different initial admin password, set `ADMIN_PASSWORD` before the first start. The backend hashes the password before storing it. Once an admin exists, restarts do not reset the credentials. Change the admin username and password from the dashboard's **Change administrator credentials** section; the current password is required and other admin sessions are signed out.

In the admin dashboard, set **Valid from** and **Expires at** to restrict when unused tickets can be scanned. Both times are entered in the device’s local timezone and stored in PostgreSQL. Choose **Clear time limits** to allow scans at any time. A ticket outside the configured window stays unused.

To point the frontend at another API URL, change `VITE_API_URL` in `frontend/.env` and restart Vite. Set backend `PUBLIC_API_URL` to the public API origin; generated QR codes use this value. Set backend `FRONTEND_URL` to the public website origin for the QR redirect. The browser scanner needs camera permission and a secure page context; localhost is supported by browsers for development.

For GitHub and Render hosting, including clean repository setup and PostgreSQL export/import, follow [DEPLOYMENT.md](DEPLOYMENT.md).
