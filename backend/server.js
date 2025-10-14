// server.js

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors'); // Essential for connecting frontend and backend
const jwt = require('jsonwebtoken');

const app = express();
const port = 5000; // Matches the port in your React fetch URL

// --- Middleware Setup ---
app.use(cors()); // Allow requests from your React app (e.g., http://localhost:3000)
app.use(express.json()); // To parse incoming JSON requests

// --- Database Configuration ---
// Configure your PostgreSQL connection details
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'guest_system_db',
    password: 'V@n@d1zy',
    port: 5432, // Default PostgreSQL port
});

// --- Constants ---
const saltRounds = 10; // Number of rounds for bcrypt hashing

// --- JWT Secret ---
const JWT_SECRET = 'your_jwt_secret_key'; // Change this to a secure value in production

// --- Admin/User Login Route ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // 1. Find user by username
        const userResult = await pool.query(
            'SELECT id, username, password_hash, role FROM users WHERE username = $1',
            [username]
        );
        if (userResult.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        const user = userResult.rows[0];

        // 2. Compare password
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }

        // 3. Create JWT token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        // 4. Respond with token and user info
        res.json({
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error during login.' });
    }
});

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- Profile Route ---
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const userResult = await pool.query(
            'SELECT id, username, role FROM users WHERE id = $1',
            [req.user.id]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.json(userResult.rows[0]);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});



// --- Admin Registration Route ---
app.post('/api/admin/register', async (req, res) => {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // 1. Check if user already exists
        const checkUser = await pool.query('SELECT username FROM users WHERE username = $1', [username]);
        if (checkUser.rows.length > 0) {
            return res.status(409).json({ message: 'Admin with this phone number already exists.' });
        }

        // 2. Hash the password
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 3. Insert the new admin into the 'users' table
        // NOTE: Adjust column names (username, password_hash, role) as per your actual table schema
        const result = await pool.query(
            `INSERT INTO users (username, password_hash, role) 
             VALUES ($1, $2, $3) 
             RETURNING id, username, role`, // Return the created user's data
            [username, passwordHash, 'admin'] // Assuming 'admin' is the role for administrators
        );

        // 4. Send success response
        const newAdmin = result.rows[0];
        res.status(201).json({ 
            message: 'Admin registered successfully!', 
            username: newAdmin.username,
            id: newAdmin.id,
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error during registration.' });
    }
});




// --- Start Server ---
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});