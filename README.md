# Contest QR System

An admin generates QR codes for a numeric ID range, assigns contestant information and a prize outcome to each ID, and downloads the codes as a ZIP. Reception scans an ID to display the outcome set for that specific code.

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

   On first start, the backend creates the `contestants`, `users`, and ticket scan window settings in PostgreSQL. If the previous `guests` table exists, it renames it to `contestants`, carries over the numeric IDs and names, and removes the unrelated guest and attendance columns. Contestant names, details, prizes, outcomes, and notes are preserved in the new columns where possible. This migration runs against the database configured in `backend/.env`.

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

Only `/reception` is public for contestants and scanners. `/admin` checks the session with the backend, and all admin changes and ZIP downloads require an admin token. Reception can read contestant outcomes but cannot edit them.

For a different initial admin password, set `ADMIN_PASSWORD` before the first start. The backend hashes the password before storing it. Once an admin exists, restarts do not reset the credentials. Change the admin username and password from the dashboard's **Change administrator credentials** section; the current password is required and other admin sessions are signed out.

In the admin dashboard, set **Valid from** and **Expires at** to restrict when unused tickets can be scanned. Both times are entered in the device’s local timezone and stored in PostgreSQL. Choose **Clear time limits** to allow scans at any time. A ticket outside the configured window stays unused.

To point the frontend at another API URL, change `VITE_API_URL` in `frontend/.env` and restart Vite. The QR scanner needs camera permission and a secure page context; localhost is supported by browsers for development.

For GitHub and Render hosting, including clean repository setup and PostgreSQL export/import, follow [DEPLOYMENT.md](DEPLOYMENT.md).
