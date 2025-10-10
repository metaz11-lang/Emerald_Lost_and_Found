const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple admin credentials (in production, use proper authentication)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'emerald2024'
};

// Simple token storage (in production, use proper session management)
const activeSessions = new Set();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    
    // Create discs table if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS discs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_name TEXT,
      phone_number TEXT NOT NULL,
      disc_type TEXT NOT NULL,
      disc_color TEXT NOT NULL,
      date_found TEXT NOT NULL,
      bin_number INTEGER,
      is_returned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
      // Run initial cleanup after table is ready
      cleanupOldDiscs();
    });
  }
});

// Function to automatically remove discs older than 6 weeks
function cleanupOldDiscs() {
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42); // 6 weeks = 42 days
  const cutoffDate = sixWeeksAgo.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  
  db.run(
    'UPDATE discs SET is_returned = 1 WHERE date_found <= ? AND is_returned = 0',
    [cutoffDate],
    function(err) {
      if (err) {
        console.error('Error during automatic cleanup:', err.message);
      } else if (this.changes > 0) {
        console.log(`Automatic cleanup: Marked ${this.changes} disc(s) older than 6 weeks as returned`);
      }
    }
  );
}

// Run cleanup every hour (3600000 milliseconds)
setInterval(cleanupOldDiscs, 3600000);

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes
app.get('/api/discs', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM discs WHERE is_returned = 0 ORDER BY created_at DESC';
  let params = [];
  
  if (search) {
    query = `SELECT * FROM discs WHERE is_returned = 0 
             AND (owner_name LIKE ? OR phone_number LIKE ? OR disc_type LIKE ? OR disc_color LIKE ?) 
             ORDER BY created_at DESC`;
    const searchTerm = `%${search}%`;
    params = [searchTerm, searchTerm, searchTerm, searchTerm];
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/discs', (req, res) => {
  const { owner_name, phone_number, disc_type, disc_color, bin_number } = req.body;
  
  if (!phone_number || !disc_type || !disc_color) {
    return res.status(400).json({ error: 'Phone number, disc type, and disc color are required' });
  }
  
  const date_found = new Date().toISOString().split('T')[0];
  
  db.run(
    'INSERT INTO discs (owner_name, phone_number, disc_type, disc_color, bin_number, date_found) VALUES (?, ?, ?, ?, ?, ?)',
    [owner_name || null, phone_number, disc_type, disc_color, bin_number || null, date_found],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        id: this.lastID,
        message: 'Disc added successfully',
        disc: {
          id: this.lastID,
          owner_name,
          phone_number,
          disc_type,
          disc_color,
          bin_number,
          date_found
        }
      });
    }
  );
});

// Admin Routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Admin API Routes
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    // Generate a simple session token
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.add(token);
    
    res.json({ 
      success: true, 
      token: token,
      message: 'Login successful' 
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid credentials' 
    });
  }
});

// Middleware to verify admin token
function verifyAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  if (!activeSessions.has(token)) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  next();
}

// Get all discs for admin (including full phone numbers)
app.get('/api/admin/discs', verifyAdminToken, (req, res) => {
  db.all('SELECT * FROM discs WHERE is_returned = 0 ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Delete a disc (admin only)
app.delete('/api/admin/discs/:id', verifyAdminToken, (req, res) => {
  const discId = req.params.id;
  
  db.run('DELETE FROM discs WHERE id = ?', [discId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Disc not found' });
      return;
    }
    
    res.json({ message: 'Disc deleted successfully' });
  });
});

// Update a disc (admin only)
app.put('/api/admin/discs/:id', verifyAdminToken, (req, res) => {
  const discId = req.params.id;
  const { owner_name, phone_number, disc_type, disc_color, bin_number } = req.body;
  
  if (!phone_number || !disc_type || !disc_color) {
    return res.status(400).json({ error: 'Phone number, disc type, and disc color are required' });
  }
  
  db.run(
    'UPDATE discs SET owner_name = ?, phone_number = ?, disc_type = ?, disc_color = ?, bin_number = ? WHERE id = ?',
    [owner_name || null, phone_number, disc_type, disc_color, bin_number || null, discId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Disc not found' });
        return;
      }
      
      res.json({ message: 'Disc updated successfully' });
    }
  );
});

// Mark disc as returned (admin only)
app.put('/api/admin/discs/:id/returned', verifyAdminToken, (req, res) => {
  const discId = req.params.id;
  
  db.run('UPDATE discs SET is_returned = 1 WHERE id = ?', [discId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Disc not found' });
      return;
    }
    
    res.json({ message: 'Disc marked as returned successfully' });
  });
});

// Manual cleanup endpoint (admin only)
app.post('/api/admin/cleanup', verifyAdminToken, (req, res) => {
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42); // 6 weeks = 42 days
  const cutoffDate = sixWeeksAgo.toISOString().split('T')[0];
  
  db.run(
    'UPDATE discs SET is_returned = 1 WHERE date_found <= ? AND is_returned = 0',
    [cutoffDate],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      res.json({ 
        message: `Cleanup completed: ${this.changes} disc(s) marked as returned`,
        discsProcessed: this.changes,
        cutoffDate: cutoffDate
      });
    }
  );
});

// Admin logout
app.post('/api/admin/logout', verifyAdminToken, (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader.substring(7);
  
  activeSessions.delete(token);
  res.json({ message: 'Logged out successfully' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Keep the process alive and handle errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  db.close();
  process.exit(0);
});