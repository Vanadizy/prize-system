// server.js
import express from "express";
import { Pool } from "pg";
import cors from "cors";
import bodyParser from "body-parser";
import QRCode from "qrcode";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors({
  origin: "https://guest-system.vercel.app",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));
app.use(express.json());
app.use(bodyParser.json());

// --- PostgreSQL Database ---
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

// --- JWT Secret ---
const JWT_SECRET = process.env.JWT_SECRET || "vanadizy_secret_key";
const saltRounds = 10;

// --- Cloudinary Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// --- Local QR Fallback Directory ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const qrDir = path.join(__dirname, "qrcodes");
if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir);
app.use("/qrcodes", express.static(qrDir));

// Utility: Extract numeric guest ID safely
const parseGuestId = (data) => {
  if (!data) return null;
  const idStr = data.toString().trim().match(/\d+/);
  return idStr ? parseInt(idStr[0], 10) : null;
};

// ===============================
// 🚀 GUEST MANAGEMENT
// ===============================

// ✅ Add Guest + Generate Cloudinary QR
app.post("/api/guests", async (req, res) => {
  const { fullname, phonenumber, sex, state } = req.body;
  try {
    const exists = await pool.query("SELECT * FROM guests WHERE phonenumber=$1", [phonenumber]);
    if (exists.rows.length > 0)
      return res.status(400).json({ message: "Phone number already exists" });

    const insert = await pool.query(
      "INSERT INTO guests (fullname, phonenumber, sex, state, role) VALUES ($1, $2, $3, $4, 'guest') RETURNING id",
      [fullname, phonenumber, sex, state]
    );

    const id = insert.rows[0].id;
    const qrData = `${id}`;
    const tmpFile = path.join(os.tmpdir(), `guest_${id}.png`);

    await QRCode.toFile(tmpFile, qrData, { width: 300 });

    const upload = await cloudinary.uploader.upload(tmpFile, {
      folder: "guest_qrcodes",
      public_id: `guest_${id}`,
      overwrite: true,
      resource_type: "image",
    });

    fs.unlinkSync(tmpFile);

    await pool.query("UPDATE guests SET qrcode=$1 WHERE id=$2", [upload.secure_url, id]);

    res.status(201).json({ message: "Guest added successfully", qrcode: upload.secure_url });
  } catch (err) {
    console.error("Add guest error:", err);
    res.status(500).json({ message: "Error adding guest.", error: err.message });
  }
});

// ✅ Scan (Reception)
app.post("/api/guests/scan", async (req, res) => {
  let guestId = parseGuestId(req.body.guestId);
  if (!guestId) return res.status(400).json({ message: "Invalid Guest ID." });

  try {
    const result = await pool.query(
      "SELECT id, fullname, attendance_checked FROM guests WHERE id=$1",
      [guestId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Guest not found." });

    const guest = result.rows[0];
    if (guest.attendance_checked)
      return res.status(409).json({ message: `Guest ${guest.fullname} already checked in.` });

    const update = await pool.query(
      "UPDATE guests SET attendance_checked=TRUE, checkin_time=NOW() WHERE id=$1 RETURNING *",
      [guestId]
    );

    res.json({
      success: true,
      message: `Guest ${update.rows[0].fullname} checked in successfully.`,
      guest: update.rows[0],
    });
  } catch (err) {
    res.status(500).json({ message: "Error scanning guest.", error: err.message });
  }
});

// ✅ Scan (Drinks)
app.post("/api/drinks/scan", async (req, res) => {
  let guestId = parseGuestId(req.body.guestId);
  if (!guestId) return res.status(400).json({ message: "Invalid Guest ID." });

  try {
    const result = await pool.query(
      "SELECT id, fullname, drinks_checked FROM guests WHERE id=$1",
      [guestId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Guest not found." });

    const guest = result.rows[0];
    if (guest.drinks_checked)
      return res.status(409).json({ message: `Drink already served to ${guest.fullname}.` });

    const update = await pool.query(
      "UPDATE guests SET drinks_checked=TRUE, drinks_time=NOW() WHERE id=$1 RETURNING *",
      [guestId]
    );

    res.json({
      success: true,
      message: `Drink served to ${update.rows[0].fullname}.`,
      guest: update.rows[0],
    });
  } catch (err) {
    res.status(500).json({ message: "Error serving drink.", error: err.message });
  }
});

// ✅ Delete Guest + Cloudinary Cleanup
app.delete("/api/guests/:id", async (req, res) => {
  const id = req.params.id;
  try {
    await cloudinary.uploader.destroy(`guest_qrcodes/guest_${id}`, { resource_type: "image" });
    await pool.query("DELETE FROM guests WHERE id=$1", [id]);
    await pool.query("DELETE FROM users WHERE username IN (SELECT phonenumber FROM guests WHERE id=$1)", [id]);
    res.json({ message: "Guest and QR deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting guest.", error: err.message });
  }
});

// ===============================
// 🧩 AUTHENTICATION
// ===============================

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const userResult = await pool.query(
      "SELECT * FROM users WHERE username=$1",
      [username]
    );

    if (userResult.rows.length === 0)
      return res.status(401).json({ message: "Invalid username or password." });

    const user = userResult.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) return res.status(401).json({ message: "Invalid credentials." });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({ message: "Login successful.", token, user });
  } catch (err) {
    res.status(500).json({ message: "Login error.", error: err.message });
  }
});

// ===============================
// 🌍 START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`✅ Server running on port${PORT}`);
});
