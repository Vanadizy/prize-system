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

// --- QR Code Directory Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const qrDir = path.join(__dirname, "qrcodes");

if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir);
app.use("/qrcodes", express.static(qrDir));

// --- JWT Middleware ---
// function authenticateToken(req, res, next) {
//   const authHeader = req.headers["authorization"];
//   const token = authHeader && authHeader.split(" ")[1];
//   if (!token) return res.sendStatus(401); // No token provided

//   jwt.verify(token, JWT_SECRET, (err, user) => {
//     if (err) return res.sendStatus(403); // Invalid or expired token
//     req.user = user;
//     next();
//   });
// }


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





// ✅ SCAN QR CODE (Check-In) - Protected by authentication
// Ensure JSON parsing middleware is enabled

// Helper: parse guestId safely
const parseGuestId = (data) => {
  if (!data) return null;
  const idStr = data.toString().trim().match(/\d+/); // extract first number
  if (!idStr) return null;
  return parseInt(idStr[0], 10);
};

// Reception scan
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




// SCAN DRINKS QR CODE (Serve Drink) - Protected by authentication


// server.js or drinksRoutes.js
// Drinks scan
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
      message: "Internal server error while serving drink.",
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

// ✅ Add new guest + generate QR code (Protected for staff/admin)
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

    const qrUrl = `https://guestsystem.onrender.com/qrcodes/guest_${id}.png`;

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


// ✅ Update role AND manage user account based on role (Protected for staff/admin)
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
                await pool.query(
                    `INSERT INTO users (username, password_hash, role)
                     VALUES ($1, $2, $3)`,
                    [username, passwordHash, role]
                );
            }
        } else {
            // New role is "guest" (or any non-auth role) -> Delete the user account if it exists
            await pool.query("DELETE FROM users WHERE username=$1", [username]);
        }

    res.json({ message: "Role and user account updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete single guest (Protected for staff/admin)
app.delete("/api/guests/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Before deleting guest, get their phone number
    const guestInfo = await getGuestPhone(id);
    if (guestInfo) {
        // Delete the corresponding user account if it exists (using phone as username)
        await pool.query("DELETE FROM users WHERE username=$1", [guestInfo.phonenumber]);
    }
    
    // Delete QR code file
    const qrFile = path.join(qrDir, `guest_${id}.png`);
    if (fs.existsSync(qrFile)) fs.unlinkSync(qrFile);

    await pool.query("DELETE FROM guests WHERE id=$1", [id]);
    res.json({ message: "Guest deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Delete all guests (Protected for staff/admin)
app.delete("/api/guests", async (req, res) => {
  try {
    // Delete all QR code files
    const files = fs.readdirSync(qrDir);
    for (const file of files) {
      if (file.startsWith("guest_") && file.endsWith(".png")) {
        fs.unlinkSync(path.join(qrDir, file));
      }
    }

    // NEW: Delete all non-admin users before deleting guests
    await pool.query("DELETE FROM users WHERE role != 'admin'");

    await pool.query("DELETE FROM guests");
    res.json({ message: "All guests deleted successfully" });
  } catch (err) {
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


// --- Profile Route (Protected) ---
app.get("/api/profile", async (req, res) => {
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
  console.log(`🚀 Server running at https://guestsystem.onrender.com`);
});