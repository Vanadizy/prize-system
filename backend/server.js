// server.js
import express from "express";
import { Pool } from "pg";
import cors from "cors";
import bodyParser from "body-parser";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const app = express();
const PORT = 5000;

// --- Middleware Setup ---
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// --- Database Configuration ---
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "guest_system_db",
  password: "V@n@d1zy",
  port: 5432,
});

// --- QR Code Directory Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const qrDir = path.join(__dirname, "qrcodes");

if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir);
app.use("/qrcodes", express.static(qrDir));

// ==========================
// 🚀 GUEST MANAGEMENT ROUTES
// ==========================

// ✅ Get all guests
app.get("/api/guests", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM guests ORDER BY id DESC");
    const total = await pool.query("SELECT COUNT(*) FROM guests");
    res.json({ guests: result.rows, total: total.rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Search guests by phone number
app.get("/api/guests/search", async (req, res) => {
  const { phonenumber } = req.query;
  try {
    const result = await pool.query(
      "SELECT * FROM guests WHERE phonenumber ILIKE $1 ORDER BY id DESC",
      [`%${phonenumber}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Add new guest + generate QR code
app.post("/api/guests", async (req, res) => {
  const { fullname, phonenumber, sex, state } = req.body;
  const role = "guest";

  try {
    // Check if phone already exists
    const check = await pool.query("SELECT * FROM guests WHERE phonenumber=$1", [phonenumber]);
    if (check.rows.length > 0)
      return res.status(400).json({ message: "Phone number already exists" });

    // Insert new guest
    const insert = await pool.query(
      "INSERT INTO guests (fullname, phonenumber, sex, state, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [fullname, phonenumber, sex, state, role]
    );

    const id = insert.rows[0].id;

    // Generate QR data
    const qrData = `
Full Name: ${fullname}
Phone: ${phonenumber}
Sex: ${sex}
State: ${state}
Role: ${role}
Guest ID: ${id}
    `.trim();

    const qrPath = path.join(qrDir, `guest_${id}.png`);
    await QRCode.toFile(qrPath, qrData, { width: 300 });

    const qrUrl = `http://192.168.1.147:${PORT}/qrcodes/guest_${id}.png`;

    // Save QR URL to DB
    await pool.query("UPDATE guests SET qrcode=$1 WHERE id=$2", [qrUrl, id]);

    res.status(201).json({
      message: "Guest added successfully",
      qrcode: qrUrl,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Update guest details
app.put("/api/guests/:id", async (req, res) => {
  const { id } = req.params;
  const { fullname, phonenumber, sex, state } = req.body;
  try {
    await pool.query(
      "UPDATE guests SET fullname=$1, phonenumber=$2, sex=$3, state=$4 WHERE id=$5",
      [fullname, phonenumber, sex, state, id]
    );
    res.json({ message: "Guest updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Update role
app.put("/api/guests/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  try {
    await pool.query("UPDATE guests SET role=$1 WHERE id=$2", [role, id]);
    res.json({ message: "Role updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete single guest
app.delete("/api/guests/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Delete QR code file
    const qrFile = path.join(qrDir, `guest_${id}.png`);
    if (fs.existsSync(qrFile)) fs.unlinkSync(qrFile);

    await pool.query("DELETE FROM guests WHERE id=$1", [id]);
    res.json({ message: "Guest deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete all guests
app.delete("/api/guests", async (req, res) => {
  try {
    // Delete all QR code files
    const files = fs.readdirSync(qrDir);
    for (const file of files) {
      if (file.startsWith("guest_") && file.endsWith(".png")) {
        fs.unlinkSync(path.join(qrDir, file));
      }
    }

    await pool.query("DELETE FROM guests");
    res.json({ message: "All guests deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// 🔐 ADMIN AUTHENTICATION ROUTES
// ==============================

const saltRounds = 10;
const JWT_SECRET = "your_jwt_secret_key";

// --- Admin Registration ---
app.post("/api/admin/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Username and password are required." });

  try {
    const checkUser = await pool.query("SELECT username FROM users WHERE username=$1", [username]);
    if (checkUser.rows.length > 0)
      return res.status(409).json({ message: "Admin already exists." });

    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role`,
      [username, passwordHash, "admin"]
    );

    const newAdmin = result.rows[0];
    res.status(201).json({
      message: "Admin registered successfully!",
      username: newAdmin.username,
      id: newAdmin.id,
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error during registration." });
  }
});

// --- Login Route ---
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: "Username and password are required." });

  try {
    const userResult = await pool.query(
      "SELECT id, username, password_hash, role FROM users WHERE username=$1",
      [username]
    );

    if (userResult.rows.length === 0)
      return res.status(401).json({ message: "Invalid username or password." });

    const user = userResult.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match)
      return res.status(401).json({ message: "Invalid username or password." });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    res.json({
      message: "Login successful!",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error during login." });
  }
});

// --- JWT Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// --- Profile Route ---
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      "SELECT id, username, role FROM users WHERE id=$1",
      [req.user.id]
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ message: "User not found." });

    res.json(userResult.rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Internal server error." });
  }
});

// ==============================
// 🚀 Start the Server
// ==============================
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://192.168.1.147:${PORT}`);
});
