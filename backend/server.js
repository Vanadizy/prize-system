import express from "express";
import { Pool } from "pg";
import cors from "cors";
import QRCode from "qrcode";
import { ZipArchive } from "archiver";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
// Reflect every requesting origin. The frontend authenticates with Bearer tokens,
// not cookies, so cross-origin credentials are not needed.
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qrDir = path.join(__dirname, "qrcodes");
fs.mkdirSync(qrDir, { recursive: true });
app.use("/qrcodes", express.static(qrDir));
const PORT = process.env.PORT || 5000;
const PUBLIC_API_BASE = (process.env.PUBLIC_API_URL || process.env.API_URL || `http://localhost:${PORT}`)
  .replace(/\/api\/?$/i, "")
  .replace(/\/+$/, "");
const PUBLIC_FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/+$/, "");
app.get("/api/health", (req, res) => res.json({ ok: true, service: "contest-qr-system" }));
app.use(express.json({ limit: "2mb" }));

const hostedDatabase = process.env.DATABASE_URL || process.env.DB_HOST;
const poolOptions = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false } }
  : {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === "false" ? false : (process.env.DB_SSL === "true" || (hostedDatabase && hostedDatabase !== "localhost" && hostedDatabase !== "127.0.0.1") ? { rejectUnauthorized: false } : false),
    };
const pool = new Pool(poolOptions);
let schemaError = null;
const schemaReady = (async () => {
  await pool.query(`
  DO $$ BEGIN
    IF to_regclass('public.contestants') IS NULL AND to_regclass('public.guests') IS NOT NULL THEN
      ALTER TABLE public.guests RENAME TO contestants;
    END IF;
  END $$;
  CREATE TABLE IF NOT EXISTS public.contestants (
    id integer PRIMARY KEY,
    description text,
    prize varchar(200),
    display_label varchar(100),
    outcome varchar(20),
    notes text,
    qr_path text,
    qr_url text,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE public.contestants ADD COLUMN IF NOT EXISTS description text;
  ALTER TABLE public.contestants ADD COLUMN IF NOT EXISTS prize varchar(200);
  ALTER TABLE public.contestants ADD COLUMN IF NOT EXISTS display_label varchar(100);
  ALTER TABLE public.contestants ADD COLUMN IF NOT EXISTS outcome varchar(20);
  ALTER TABLE public.contestants ADD COLUMN IF NOT EXISTS notes text;
  ALTER TABLE public.contestants ADD COLUMN IF NOT EXISTS qr_path text;
  ALTER TABLE public.contestants ADD COLUMN IF NOT EXISTS qr_url text;
  ALTER TABLE public.contestants ADD COLUMN IF NOT EXISTS public_token varchar(64);
  ALTER TABLE public.contestants ADD COLUMN IF NOT EXISTS used_at timestamp without time zone;
  ALTER TABLE public.contestants ADD COLUMN IF NOT EXISTS created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP;
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='contestants_qsn_id_range_check' AND conrelid='public.contestants'::regclass)
       AND NOT EXISTS (SELECT 1 FROM public.contestants WHERE id NOT BETWEEN 1 AND 9999) THEN
      ALTER TABLE public.contestants ADD CONSTRAINT contestants_qsn_id_range_check CHECK (id BETWEEN 1 AND 9999);
    END IF;
  END $$;
  DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contestants' AND column_name='fullname') THEN
      ALTER TABLE public.contestants DROP COLUMN fullname CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contestants' AND column_name='name') THEN
      ALTER TABLE public.contestants DROP COLUMN name CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contestants' AND column_name='state') THEN
      ALTER TABLE public.contestants DROP COLUMN state CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contestants' AND column_name='phonenumber') THEN
      ALTER TABLE public.contestants DROP COLUMN phonenumber CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contestants' AND column_name='sex') THEN
      ALTER TABLE public.contestants DROP COLUMN sex CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contestants' AND column_name='qrcode') THEN
      ALTER TABLE public.contestants DROP COLUMN qrcode CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contestants' AND column_name='role') THEN
      ALTER TABLE public.contestants DROP COLUMN role CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contestants' AND column_name='checkin_time') THEN
      ALTER TABLE public.contestants DROP COLUMN checkin_time CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contestants' AND column_name='attendance_checked') THEN
      ALTER TABLE public.contestants DROP COLUMN attendance_checked CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contestants' AND column_name='drinks_checked') THEN
      ALTER TABLE public.contestants DROP COLUMN drinks_checked CASCADE;
    END IF;
  END $$;
  CREATE TABLE IF NOT EXISTS public.users (
    id serial PRIMARY KEY,
    username varchar(255) UNIQUE NOT NULL,
    password_hash varchar(255) NOT NULL,
    role varchar(50) NOT NULL DEFAULT 'admin',
    auth_version integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_version integer NOT NULL DEFAULT 0;
  CREATE TABLE IF NOT EXISTS public.ticket_scan_window (
    id integer PRIMARY KEY CHECK (id = 1),
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (starts_at IS NULL OR expires_at IS NULL OR starts_at < expires_at)
  );
  CREATE TABLE IF NOT EXISTS public.branding_settings (
    id smallint PRIMARY KEY CHECK (id = 1),
    logo_data_url text,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  `);
  await pool.query("INSERT INTO public.ticket_scan_window (id) VALUES (1) ON CONFLICT (id) DO NOTHING");
  await pool.query("INSERT INTO public.branding_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING");
  await pool.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='contestants_outcome_check' AND conrelid='public.contestants'::regclass) THEN
      ALTER TABLE public.contestants ADD CONSTRAINT contestants_outcome_check CHECK (outcome IN ('winner','not_winner') OR outcome IS NULL);
    END IF;
  END $$;`);
  const existingCodes = await pool.query("SELECT id, qr_path, qr_url, public_token FROM public.contestants ORDER BY id");
  for (const { id, qr_path: oldQrPath, qr_url: oldQrUrl, public_token: storedPublicToken } of existingCodes.rows) {
    let publicToken = storedPublicToken;
    if (!publicToken) {
      publicToken = createPublicToken();
      await pool.query("UPDATE public.contestants SET public_token=$1 WHERE id=$2 AND (public_token IS NULL OR public_token='')", [publicToken, id]);
    }
    const filename = qrFilename(id);
    const absolutePath = path.join(qrDir, filename);
    const qrPath = `/qrcodes/${filename}`;
    const qrUrl = makeQrUrl(publicToken);
    if (!fs.existsSync(absolutePath) || oldQrPath !== qrPath || oldQrUrl !== qrUrl)
      await QRCode.toFile(absolutePath, qrUrl, { width: 500, margin: 3 });
    await pool.query("UPDATE public.contestants SET qr_path=$1, qr_url=$2 WHERE id=$3 AND (qr_path IS DISTINCT FROM $1 OR qr_url IS DISTINCT FROM $2)", [qrPath, qrUrl, id]);
  }
  await pool.query("ALTER TABLE public.contestants ALTER COLUMN public_token SET NOT NULL");
  await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS contestants_public_token_uq ON public.contestants(public_token)");
  const adminPasswordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || "1234", 10);
  await pool.query(
    `INSERT INTO public.users (username, password_hash, role)
     SELECT 'admin', $1, 'admin'
     WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE role='admin')
     ON CONFLICT (username) DO NOTHING`,
    [adminPasswordHash]
  );
  return true;
})().catch((error) => {
  schemaError = error.message;
  console.error("Database connection or contest schema setup failed:", error);
  return false;
});
const JWT_SECRET = process.env.JWT_SECRET || "vanadizy_secret_key";
const QR_SIZE_LIMIT = 9999;

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

app.get("/api/db-health", asyncRoute(async (req, res) => {
  try {
    await pool.query("SELECT 1");
    const schemaReadyState = await schemaReady;
    res.status(schemaReadyState ? 200 : 503).json({ ok: schemaReadyState, database: "connected", schema: schemaReadyState ? "ready" : "failed", error: schemaError });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable", message: "Check database settings in backend/.env." });
  }
}));

function ticketLabel(value) {
  return `QSN ${String(value).padStart(5, "0")}`;
}

function createPublicToken() {
  return randomBytes(32).toString("hex");
}

function makeQrUrl(token) {
  return `${PUBLIC_API_BASE}/api/qr/${token}`;
}

function qrFilename(value) {
  return `qrcode_${ticketLabel(value).replace(" ", "_")}.png`;
}

function readContestId(value) {
  if (value === undefined || value === null) return null;
  let raw = String(value).trim();
  if (/^https?:\/\//i.test(raw)) {
    try { raw = new URL(raw).pathname.split("/").filter(Boolean).at(-1) || ""; }
    catch { return null; }
  }
  const match = raw.match(/^(?:QSN[\s_-]*)?(\d{1,5})$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id >= 1 && id <= 9999 ? id : null;
}

function parseContestId(value) {
  return readContestId(value);
}

async function getAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Authentication required." });
  try {
    if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
    req.user = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query("SELECT role, auth_version FROM public.users WHERE id=$1", [req.user.id]);
    if (!rows.length || rows[0].role !== "admin" || rows[0].auth_version !== (req.user.authVersion ?? 0))
      return res.status(401).json({ message: "Session expired. Please log in again." });
    next();
  } catch (error) {
    if (error.name !== "JsonWebTokenError" && error.name !== "TokenExpiredError") return next(error);
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  next();
}

const contestantFields = "id, description, prize, display_label, outcome, notes, qr_path, used_at, created_at";

app.get("/api/qr/:token", asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).send("Ticket service is unavailable.");
  const token = String(req.params.token || "");
  if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).send("Unknown ticket.");
  const { rowCount } = await pool.query("SELECT 1 FROM public.contestants WHERE public_token=$1", [token]);
  if (!rowCount) return res.status(404).send("Unknown ticket.");
  res.redirect(302, `${PUBLIC_FRONTEND_URL}/ticket/${token}`);
}));

app.get("/api/public/contestants/:token", asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Ticket service is unavailable." });
  const token = String(req.params.token || "");
  if (!/^[a-f0-9]{64}$/i.test(token)) return res.status(404).json({ message: "Unknown ticket." });
  const { rows } = await pool.query(
    "SELECT id, outcome, prize, display_label, description, used_at FROM public.contestants WHERE public_token=$1",
    [token]
  );
  if (!rows.length) return res.status(404).json({ message: "Unknown ticket." });
  const ticket = rows[0];
  if (ticket.used_at) return res.json({ used: true, ticket: { id: ticket.id, used_at: ticket.used_at } });
  res.json({ used: false, ticket });
}));

app.get("/api/public/branding", asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Ticket service is unavailable." });
  const { rows } = await pool.query("SELECT logo_data_url FROM public.branding_settings WHERE id=1");
  res.json({ logoDataUrl: rows[0]?.logo_data_url || null });
}));

app.get("/api/settings/branding", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  const { rows } = await pool.query("SELECT logo_data_url FROM public.branding_settings WHERE id=1");
  res.json({ logoDataUrl: rows[0]?.logo_data_url || null });
}));

app.put("/api/settings/branding", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  const { logoDataUrl } = req.body;
  if (logoDataUrl !== null && (typeof logoDataUrl !== "string" || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(logoDataUrl)))
    return res.status(400).json({ message: "Upload a PNG, JPG, or WebP logo." });
  if (logoDataUrl && logoDataUrl.length > 1400000)
    return res.status(400).json({ message: "Logo must be 1 MB or smaller." });
  const { rows } = await pool.query(
    "UPDATE public.branding_settings SET logo_data_url=$1, updated_at=CURRENT_TIMESTAMP WHERE id=1 RETURNING logo_data_url",
    [logoDataUrl]
  );
  res.json({ logoDataUrl: rows[0]?.logo_data_url || null, message: logoDataUrl ? "Logo saved." : "Logo removed." });
}));

app.get("/api/contestants", asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const result = await pool.query(`SELECT ${contestantFields} FROM contestants ORDER BY id`);
  res.json({ contestants: result.rows, total: result.rowCount });
}));

app.get("/api/contestants/used", asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const result = await pool.query("SELECT id, outcome, prize, description, used_at FROM contestants WHERE used_at IS NOT NULL ORDER BY used_at DESC");
  res.json({ contestants: result.rows });
}));

app.get("/api/settings/ticket-window", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const { rows } = await pool.query("SELECT starts_at, expires_at, updated_at FROM public.ticket_scan_window WHERE id=1");
  res.json({ ticketWindow: rows[0] });
}));

app.put("/api/settings/ticket-window", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const { startsAt, expiresAt } = req.body;
  const start = startsAt ? new Date(startsAt) : null;
  const end = expiresAt ? new Date(expiresAt) : null;
  if ((startsAt && Number.isNaN(start.getTime())) || (expiresAt && Number.isNaN(end.getTime())))
    return res.status(400).json({ message: "Enter valid start and expiration times." });
  if (Boolean(start) !== Boolean(end)) return res.status(400).json({ message: "Set both a start and expiration time, or clear both to disable the scan window." });
  if (start && end && start >= end) return res.status(400).json({ message: "The expiration time must be after the start time." });
  const { rows } = await pool.query(
    "UPDATE public.ticket_scan_window SET starts_at=$1, expires_at=$2, updated_at=CURRENT_TIMESTAMP WHERE id=1 RETURNING starts_at, expires_at, updated_at",
    [start, end]
  );
  res.json({ ticketWindow: rows[0], message: start ? "Ticket scan window saved." : "Ticket scan time limits cleared." });
}));

app.post("/api/contestants/range", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const start = readContestId(req.body.start);
  const end = readContestId(req.body.end);
  if (!start || !end || end < start)
    return res.status(400).json({ message: "Enter a valid QSN range from QSN 00001 through QSN 09999." });
  if (end - start + 1 > QR_SIZE_LIMIT)
    return res.status(400).json({ message: `Generate up to ${QR_SIZE_LIMIT.toLocaleString()} IDs at a time.` });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = [];
    const skipped = [];
    for (let id = start; id <= end; id += 1) {
      const filename = qrFilename(id);
      const publicToken = createPublicToken();
      const qrUrl = makeQrUrl(publicToken);
      const insert = await client.query(
        "INSERT INTO contestants (id, qr_path, qr_url, public_token) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING RETURNING id",
        [id, `/qrcodes/${filename}`, qrUrl, publicToken]
      );
      if (!insert.rowCount) {
        skipped.push(id);
        continue;
      }
      await QRCode.toFile(path.join(qrDir, filename), qrUrl, { width: 500, margin: 3 });
      created.push(id);
    }
    await client.query("COMMIT");
    res.status(201).json({ message: `Created ${created.length} new QR code${created.length === 1 ? "" : "s"}.`, created, skipped });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.get("/api/contestants/:id/qrcode", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const id = readContestId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid contest ID." });
  const filename = path.join(qrDir, qrFilename(id));
  const { rows } = await pool.query("SELECT public_token FROM contestants WHERE id=$1", [id]);
  if (!rows.length) return res.status(404).json({ message: "Contest ID not found." });
  const qrUrl = makeQrUrl(rows[0].public_token);
  await QRCode.toFile(filename, qrUrl, { width: 500, margin: 3 });
  res.download(filename, qrFilename(id));
}));

app.get("/api/contestants/qrcodes.zip", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const start = Number(req.query.start);
  const end = Number(req.query.end);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start || end - start + 1 > QR_SIZE_LIMIT)
    return res.status(400).json({ message: "Enter a valid QSN range from QSN 00001 through QSN 09999." });
  const rows = await pool.query("SELECT id, public_token FROM contestants WHERE id BETWEEN $1 AND $2 ORDER BY id", [start, end]);
  if (!rows.rowCount) return res.status(404).json({ message: "No QR codes found in that range. Create the range first." });
  res.attachment(`qrcodes_${start}-${end}.zip`);
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on("error", (error) => res.destroy(error));
  archive.pipe(res);
  for (const { id, public_token: publicToken } of rows.rows) {
    const filename = path.join(qrDir, qrFilename(id));
    await QRCode.toFile(filename, makeQrUrl(publicToken), { width: 500, margin: 3 });
    archive.file(filename, { name: qrFilename(id) });
  }
  await archive.finalize();
}));

app.post("/api/contestants/qrcodes/selected.zip", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const ids = [...new Set((req.body.ids || []).map(readContestId).filter(Boolean))];
  if (!ids.length || ids.length > QR_SIZE_LIMIT) return res.status(400).json({ message: "Select between 1 and 9,999 QR codes." });
  const { rows } = await pool.query("SELECT id, public_token FROM contestants WHERE id = ANY($1::int[]) ORDER BY id", [ids]);
  if (!rows.length) return res.status(404).json({ message: "No selected QR codes were found." });
  res.attachment("selected_qrcodes.zip");
  const archive = new ZipArchive({ zlib: { level: 6 } });
  archive.on("error", (error) => res.destroy(error));
  archive.pipe(res);
  for (const { id, public_token: publicToken } of rows) {
    const filename = path.join(qrDir, qrFilename(id));
    await QRCode.toFile(filename, makeQrUrl(publicToken), { width: 500, margin: 3 });
    archive.file(filename, { name: qrFilename(id) });
  }
  await archive.finalize();
}));

app.put("/api/contestants/:id", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const id = readContestId(req.params.id);
  const { description, prize, outcome, displayLabel } = req.body;
  if (!id) return res.status(400).json({ message: "Invalid ID." });
  if (!["winner", "not_winner"].includes(outcome)) return res.status(400).json({ message: "Choose Winner or Not a winner." });
  if (displayLabel !== undefined && displayLabel !== null && (typeof displayLabel !== "string" || displayLabel.trim().length > 100)) return res.status(400).json({ message: "Ticket label must be 100 characters or fewer." });
  if (typeof description !== "string" || !description.trim()) return res.status(400).json({ message: outcome === "winner" ? "Enter a prize message." : "Enter a try again message." });
  if (outcome === "winner" && (typeof prize !== "string" || !prize.trim())) return res.status(400).json({ message: "Enter a prize title." });
  const result = await pool.query(
    `UPDATE contestants SET description=$1, prize=$2, display_label=$3, outcome=$4, notes=NULL WHERE id=$5 RETURNING ${contestantFields}`,
    [description.trim(), outcome === "winner" ? prize.trim() : null, typeof displayLabel === "string" && displayLabel.trim() ? displayLabel.trim() : null, outcome, id]
  );
  if (!result.rowCount) return res.status(404).json({ message: "Contest ID not found." });
  res.json({ contestant: result.rows[0], message: "Contestant and prize information saved." });
}));

app.post("/api/contestants/bulk-update", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const ids = [...new Set((req.body.ids || []).map(parseContestId).filter(Boolean))];
  const { description, prize, outcome, displayLabel } = req.body;
  if (!ids.length) return res.status(400).json({ message: "Select at least one contest ID." });
  if (!["winner", "not_winner"].includes(outcome)) return res.status(400).json({ message: "Choose Winner or Not a winner." });
  if (displayLabel !== undefined && displayLabel !== null && (typeof displayLabel !== "string" || displayLabel.trim().length > 100)) return res.status(400).json({ message: "Ticket label must be 100 characters or fewer." });
  if (typeof description !== "string" || !description.trim()) return res.status(400).json({ message: outcome === "winner" ? "Enter a prize message." : "Enter a try again message." });
  if (outcome === "winner" && (typeof prize !== "string" || !prize.trim())) return res.status(400).json({ message: "Enter a prize title." });
  const prizeValue = outcome === "winner" ? prize.trim() : null;
  const result = await pool.query(
    `UPDATE contestants SET description=$1, prize=$2, display_label=$3, outcome=$4, notes=NULL WHERE id = ANY($5::int[])`,
    [description.trim(), prizeValue, typeof displayLabel === "string" && displayLabel.trim() ? displayLabel.trim() : null, outcome, ids]
  );
  res.json({ message: `Updated ${result.rowCount} contest ID${result.rowCount === 1 ? "" : "s"}.`, updated: result.rowCount });
}));

app.post("/api/contestants/scan", asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const ticketToken = typeof req.body.ticketToken === "string" && /^[a-f0-9]{64}$/i.test(req.body.ticketToken)
    ? req.body.ticketToken
    : null;
  const contestantId = ticketToken ? null : readContestId(req.body.contestantId);
  if (!ticketToken && !contestantId) return res.status(400).json({ message: "Enter a valid QSN ID or scan a valid QR code." });
  const whereClause = ticketToken ? "public_token=$1" : "id=$1";
  const ticketKey = ticketToken || contestantId;
  const { rows: [window] } = await pool.query("SELECT starts_at, expires_at, CURRENT_TIMESTAMP AS now FROM public.ticket_scan_window WHERE id=1");
  const result = await pool.query(
    `UPDATE contestants SET used_at=CURRENT_TIMESTAMP
     WHERE ${whereClause} AND used_at IS NULL AND outcome IN ('winner','not_winner')
       AND ($2::timestamptz IS NULL OR CURRENT_TIMESTAMP >= $2)
       AND ($3::timestamptz IS NULL OR CURRENT_TIMESTAMP <= $3)
     RETURNING ${contestantFields}`,
    [ticketKey, window?.starts_at ?? null, window?.expires_at ?? null]
  );
  if (result.rowCount) return res.json({ success: true, contestant: result.rows[0] });
  const existing = await pool.query(`SELECT ${contestantFields} FROM contestants WHERE ${whereClause}`, [ticketKey]);
  if (!existing.rowCount) return res.status(404).json({ message: "Unknown ticket." });
  if (existing.rows[0].used_at) return res.status(409).json({ message: "This ticket is already used. If you have a problem, contact an administrator." });
  if (window?.starts_at && new Date(window.starts_at) > new Date(window.now)) return res.status(410).json({ message: "Ticket scanning has not opened yet." });
  if (window?.expires_at && new Date(window.expires_at) < new Date(window.now)) return res.status(410).json({ message: "This ticket has expired." });
  return res.status(409).json({ message: "This ticket does not have a result set yet." });
}));

app.post("/api/login", asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const { username, password } = req.body;
  const result = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
  if (!result.rowCount) return res.status(401).json({ message: "Invalid username or password." });
  const user = result.rows[0];
  if (!(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: "Invalid username or password." });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, authVersion: user.auth_version ?? 0 }, JWT_SECRET, { expiresIn: "2h" });
  res.json({ message: "Login successful.", token, user: { id: user.id, username: user.username, role: user.role } });
}));

app.put("/api/admin/credentials", getAuth, requireAdmin, asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const { currentPassword, username, newPassword } = req.body;
  if (typeof currentPassword !== "string" || !currentPassword)
    return res.status(400).json({ message: "Enter your current password." });
  if (typeof username !== "string" || !/^[A-Za-z0-9_.-]{3,50}$/.test(username.trim()))
    return res.status(400).json({ message: "Username must be 3–50 characters and use letters, numbers, dots, underscores, or hyphens." });
  if (typeof newPassword !== "string" || newPassword.length < 8 || newPassword.length > 128)
    return res.status(400).json({ message: "New password must be between 8 and 128 characters." });
  const current = await pool.query("SELECT id, password_hash FROM public.users WHERE id=$1 AND role='admin'", [req.user.id]);
  if (!current.rowCount || !(await bcrypt.compare(currentPassword, current.rows[0].password_hash)))
    return res.status(401).json({ message: "Current password is incorrect." });
  const duplicate = await pool.query("SELECT id FROM public.users WHERE lower(username)=lower($1) AND id<>$2", [username.trim(), req.user.id]);
  if (duplicate.rowCount) return res.status(409).json({ message: "That username is already in use." });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { rows } = await pool.query(
    "UPDATE public.users SET username=$1, password_hash=$2, auth_version=auth_version+1 WHERE id=$3 RETURNING id, username, role, auth_version",
    [username.trim(), passwordHash, req.user.id]
  );
  const user = rows[0];
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, authVersion: user.auth_version }, JWT_SECRET, { expiresIn: "2h" });
  res.json({ message: "Administrator credentials updated. Other admin sessions have been signed out.", token, user: { id: user.id, username: user.username, role: user.role } });
}));

app.get("/api/auth/me", getAuth, asyncRoute(async (req, res) => {
  if (!(await schemaReady)) return res.status(503).json({ message: "Database is unavailable. Check backend/.env database settings." });
  const result = await pool.query("SELECT id, username, role FROM users WHERE id=$1", [req.user.id]);
  if (!result.rowCount) return res.status(401).json({ message: "Administrator account no longer exists." });
  res.json({ user: result.rows[0] });
}));

app.use((error, req, res, next) => {
  console.error(error);
  if (error.code === "23505" && error.constraint === "users_username_key") return res.status(409).json({ message: "That username is already in use." });
  if (error.code === "23505") return res.status(409).json({ message: "That phone number is already assigned to another record." });
  res.status(500).json({ message: "Server error. Please try again.", error: process.env.NODE_ENV === "production" ? undefined : error.message });
});

app.listen(PORT, () => console.log(`Contest QR API listening on port ${PORT}`));
