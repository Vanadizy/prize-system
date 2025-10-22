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

const app = express();
const PORT = 5000;

// --- Middleware Setup ---
app.use(cors({
    origin: "https://guest-system.vercel.app", // <-- UPDATE TO YOUR FRONTEND URL
    methods: ["GET", "POST","PUT" ,"DELETE", "OPTIONS"],
    credentials: true,
}));
app.use(express.json());
app.use(bodyParser.json());

// --- Database Configuration (UPDATE YOUR DETAILS HERE) ---
const pool = new Pool({ 
  user: "neondb_owner",// <-- CHANGE THIS IF NOT 'postgres'
  host: "ep-bitter-rice-aeox32nl-pooler.c-2.us-east-2.aws.neon.tech",
  database: "guest_system_db",
  password: "npg_sfZ1DSjPmte6",
  ssl: {
    rejectUnauthorized: false
  },
});

// --- Security & Auth Configuration ---
const saltRounds = 10;
// *** IMPORTANT: Change this secret key ***
const JWT_SECRET = "your_jwt_secret_key"; 

// --- Cloudinary Configuration (hard-coded as requested) ---
cloudinary.config({
  cloud_name: "dgoceedqm",
  api_key: "823944376266122",
  api_secret: "kkKFidoYq_fCtLILZc2AItdh3NY",
  secure: true,
});

// --- QR Code Directory Setup (local fallback) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const qrDir = path.join(__dirname, "qrcodes");

if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir);
app.use("/qrcodes", express.static(qrDir));


// ==========================
// 🚀 GUEST MANAGEMENT ROUTES
// ==========================

// ✅ Get all guests (Protected for staff/admin)
app.get("/api/guests", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM guests ORDER BY id DESC");
    // NOTE: Removed total calculation, let frontend handle it from 'result.rows'
    res.json({ guests: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Helper: parse guestId safely
const parseGuestId = (data) => {
  if (!data) return null;
  const idStr = data.toString().trim().match(/\d+/); // extract first number
  if (!idStr) return null;
  return parseInt(idStr[0], 10);
};

// ==============================
// ✅ SCAN QR CODE (Reception)
// ==============================
app.post("/api/guests/scan", async (req, res) => {
  let guestId = parseGuestId(req.body.guestId);
  if (!guestId) return res.status(400).json({ message: "Invalid or missing Guest ID." });

  try {
    const guestResult = await pool.query(
      "SELECT id, fullname, phonenumber, attendance_checked FROM guests WHERE id = $1",
      [guestId]
    );

    if (guestResult.rows.length === 0) {
      return res.status(404).json({ message: "Guest not found in database." });
    }

    const guest = guestResult.rows[0];

    if (guest.attendance_checked) {
      return res.status(409).json({
        message: `Guest ${guest.fullname} already checked in.`,
        guest,
      });
    }

    const update = await pool.query(
      "UPDATE guests SET attendance_checked = TRUE, checkin_time = NOW() WHERE id = $1 RETURNING *",
      [guestId]
    );

    res.json({
      success: true,
      message: `Guest ${update.rows[0].fullname} checked in successfully!`,
      guest: update.rows[0],
    });
  } catch (error) {
    console.error("Reception scan error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while scanning guest.",
      error: error.message,
    });
  }
});


// ==============================
// ✅ SCAN DRINKS QR CODE (Drinks)
// ==============================
app.post("/api/drinks/scan", async (req, res) => {
  let guestId = parseGuestId(req.body.guestId);
  if (!guestId) return res.status(400).json({ message: "Invalid or missing Guest ID." });

  try {
    const guestResult = await pool.query(
      "SELECT id, fullname, phonenumber, drinks_checked FROM guests WHERE id = $1",
      [guestId]
    );

    if (guestResult.rows.length === 0) {
      return res.status(404).json({ message: guestId + " not found in database." });
    }

    const guest = guestResult.rows[0];

    if (guest.drinks_checked) {
      return res.status(409).json({
        message: `Drink already served to ${guest.fullname}.`,
        guest,
      });
    }

    const update = await pool.query(
      "UPDATE guests SET drinks_checked = TRUE, drinks_time = NOW() WHERE id = $1 RETURNING *",
      [guestId]
    );

    res.json({
      success: true,
      message: `Drink served to ${update.rows[0].fullname}!`,
      guest: update.rows[0],
    });
  } catch (error) {
    console.error("Drinks scan error:", error);
    res.status(500).json({
      success: false,
      message: guestId + " Internal server error while serving drink.",
      error: error.message,
    });
  }
});


// ✅ Search guests by phone number (Protected for staff/admin)
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


// ==============================
// ✅ Add new guest + generate QR code (Cloudinary)
// ==============================
app.post("/api/guests", async (req, res) => {
  const { fullname, phonenumber, sex, state } = req.body;
  const role = "guest";

  try {
    // Check if phone already exists
    const check = await pool.query("SELECT * FROM guests WHERE phonenumber=$1", [phonenumber]);
    if (check.rows.length > 0)
      return res.status(400).json({ message: "Phone number already exists" });

    // Insert new guest (attendance_checked defaults to FALSE)
    const insert = await pool.query(
      "INSERT INTO guests (fullname, phonenumber, sex, state, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [fullname, phonenumber, sex, state, role]
    );

    const id = insert.rows[0].id;

    // Generate QR data (we keep it compact - guest id only is fine or JSON as you want)
    const qrData = `Guest ID: ${id}`;

    // Use temporary file in OS tmp dir (good for Render)
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `guest_${id}.png`);

    // Create QR file locally
    await QRCode.toFile(tmpFile, qrData, { width: 300 });

    // Upload local QR file to Cloudinary under folder guest_qrcodes with public_id guest_<id>
    // This makes removal easy later: public_id = `guest_qrcodes/guest_${id}`
    const uploadResult = await cloudinary.uploader.upload(tmpFile, {
      folder: "guest_qrcodes",
      public_id: `guest_${id}`,
      overwrite: true,
      resource_type: "image"
    });

    // Remove temporary file
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch (e) {
      console.warn("Failed to delete temp QR file:", tmpFile, e.message);
    }

    const qrUrl = uploadResult.secure_url;

    // Save QR URL to DB
    await pool.query("UPDATE guests SET qrcode=$1 WHERE id=$2", [qrUrl, id]);

    res.status(201).json({
      message: "Guest added successfully",
      qrcode: qrUrl,
    });
  } catch (err) {
    console.error("Add guest error:", err);
    res.status(500).json({ error: err.message });
  }
});


// ✅ Update guest details (Protected for staff/admin)
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


/**
 * HELPER FUNCTION to get the guest's phone number
 */
const getGuestPhone = async (guestId) => {
  const result = await pool.query("SELECT phonenumber, role FROM guests WHERE id=$1", [guestId]);
  return result.rows[0];
}


// ==============================
// ✅ Update role AND manage user account (Protected for staff/admin)
// Path preserved: /api/guests/:id/role
// ==============================
app.put("/api/guests/:id/role", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
    
  // Roles that should have a user account
  const AUTH_ROLES = ["reception", "drinks"];

  try {
    // 1. Update guest's role in the guests table
    await pool.query("UPDATE guests SET role=$1 WHERE id=$2", [role, id]);
      
    // 2. Fetch the guest's phone number (needed for username) and old role
    const guestInfo = await getGuestPhone(id);
    if (!guestInfo) return res.status(404).json({ message: "Guest not found." });
    const username = guestInfo.phonenumber;
    const defaultPassword = "1234"; // Default password
    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

    // Check if the new role requires a user account
    if (AUTH_ROLES.includes(role)) {
        // New role is "reception" or "drinks" -> Must have a user account
        
        // Check if the user already exists in the users table
        const userCheck = await pool.query("SELECT id FROM users WHERE username=$1", [username]);
        
        if (userCheck.rows.length > 0) {
            // User exists, just update their role
            await pool.query(
               "UPDATE users SET role=$1 WHERE username=$2",
               [role, username]
            );
        } else {
            // User does not exist, create a new user account
            // Use parameterized query (safe). If a parallel insert created same username, catch and continue.
            try {
              await pool.query(
                 "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)",
                 [username, passwordHash, role]
              );
            } catch (insertErr) {
              // If unique constraint fails (race), attempt to update role instead
              if (insertErr && insertErr.code === '23505') {
                // unique_violation - update role for existing user
                await pool.query("UPDATE users SET role=$1 WHERE username=$2", [role, username]);
              } else {
                throw insertErr;
              }
            }
        }
    } else {
        // New role is "guest" (or any non-auth role) -> Delete the user account if it exists
        await pool.query("DELETE FROM users WHERE username=$1", [username]);
    }

    res.json({ message: "Role and user account updated successfully" });
  } catch (err) {
    console.error("Role update error:", err);
    res.status(500).json({ error: err.message });
  }
});


// ==============================
// ✅ Delete single guest (Protected for staff/admin)
// When deleting, remove user (if any) and Cloudinary image
// ==============================
app.delete("/api/guests/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Before deleting guest, get their phone number and qrcode
    const guestInfo = await pool.query("SELECT phonenumber, qrcode FROM guests WHERE id=$1", [id]);
    if (guestInfo.rows.length > 0) {
      const row = guestInfo.rows[0];
      const phone = row.phonenumber;
      const qrcodeUrl = row.qrcode;

      if (phone) {
        // Delete the corresponding user account if it exists (using phone as username)
        await pool.query("DELETE FROM users WHERE username=$1", [phone]);
      }

      // Delete Cloudinary QR image if exists (we used public_id guest_qrcodes/guest_<id>)
      try {
        const publicId = `guest_qrcodes/guest_${id}`;
        await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
      } catch (cloudErr) {
        // log and continue
        console.warn("Cloudinary delete failed for guest", id, cloudErr.message || cloudErr);
      }
    }

    await pool.query("DELETE FROM guests WHERE id=$1", [id]);

    // Also try to remove local file if present
    const qrFile = path.join(qrDir, `guest_${id}.png`);
    try {
      if (fs.existsSync(qrFile)) fs.unlinkSync(qrFile);
    } catch (e) {
      // ignore
    }

    res.json({ message: "Guest deleted successfully" });
  } catch (err) {
    console.error("Delete guest error:", err);
    res.status(500).json({ error: err.message });
  }
});


// ==============================
// ✅ Delete all guests (Protected for staff/admin)
// Deletes Cloudinary images for pattern guest_qrcodes/guest_<id>
// ==============================
app.delete("/api/guests", async (req, res) => {
  try {
    // Fetch all IDs so we can delete Cloudinary assets deterministically
    const rows = await pool.query("SELECT id FROM guests");
    for (const r of rows.rows) {
      const id = r.id;
      try {
        await cloudinary.uploader.destroy(`guest_qrcodes/guest_${id}`, { resource_type: "image" });
      } catch (cloudErr) {
        console.warn("Cloudinary delete failed for guest", id, cloudErr.message || cloudErr);
      }
    }

    // Delete all non-admin users before deleting guests
    await pool.query("DELETE FROM users WHERE role != 'admin'");

    // Delete local qrcode files if any
    try {
      const files = fs.readdirSync(qrDir);
      for (const file of files) {
        if (file.startsWith("guest_") && file.endsWith(".png")) {
          fs.unlinkSync(path.join(qrDir, file));
        }
      }
    } catch (e) {
      // ignore errors reading/deleting local folder
    }

    await pool.query("DELETE FROM guests");
    res.json({ message: "All guests deleted successfully" });
  } catch (err) {
    console.error("Delete all guests error:", err);
    res.status(500).json({ error: err.message });
  }
});


// ==============================
// 🔐 AUTHENTICATION ROUTES
// ==============================

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
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role",
      [username, passwordHash, "admin"]
    );

    const newAdmin = result.rows[0];
    res.status(201).json({
      message: "Admin registered successfully!",
      username: newAdmin.username,
      id: newAdmin.id,
    });
  } catch (error) {
    console.error("Admin register error:", error);
    res.status(500).json({ message: "Internal server error during registration." + (error.message || "") });
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
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error during login." });
  }
});


// --- Profile Route (Protected) ---
// NOTE: your original code expects req.user to exist; authentication middleware not included here.
// Keeping same behavior as original but be aware req.user must be set by auth middleware for this to work.
app.get("/api/profile", async (req, res) => {
  try {
    const userResult = await pool.query(
      "SELECT id, username, role FROM users WHERE id=$1",
      [req.user?.id] // unchanged behavior; will fail if req.user isn't set
    );
    if (!userResult || userResult.rows.length === 0)
      return res.status(404).json({ message: "User not found." });

    res.json(userResult.rows[0]);
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// ==============================
// 🚀 Start the Server
// ==============================
app.listen(PORT, () => {
  console.log(`🚀 Server running at https://guestsystem.onrender.com`);
});
