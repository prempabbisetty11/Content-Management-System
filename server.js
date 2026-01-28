const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("."));

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.use("/uploads", express.static(UPLOAD_DIR));

// ---------- DATABASE ----------
const db = new sqlite3.Database("./database.db");

// Run db.sql every start (keeps schema + resets user list as you requested)
const sql = fs.readFileSync("./db.sql", "utf8");
db.exec(sql);

// ---------- HELPERS ----------
function isAdminEmail(email) {
  return email === "admin@gmail.com";
}

function nowISO() {
  return new Date().toISOString();
}

// ---------- MULTER (keep file extension) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext.slice(0, 12);
    const name = Date.now() + "-" + Math.round(Math.random() * 1e9) + safeExt;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// ---------- LOGIN ----------
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE email=? AND password=?",
    [email, password],
    (err, user) => {
      if (err) return res.status(500).send("DB error");
      if (!user) return res.status(401).send("Invalid login");

      // blocked check
      if (user.blocked_until) {
        const blockedUntil = new Date(user.blocked_until).getTime();
        if (!Number.isNaN(blockedUntil) && blockedUntil > Date.now()) {
          return res
            .status(403)
            .send(`Blocked until ${user.blocked_until}`);
        }
      }

      return res.send({
        email: user.email,
        role: user.role,
        username: user.username || ""
      });
    }
  );
});

// ---------- GET CONTENT ----------
app.get("/content", (req, res) => {
  db.all("SELECT * FROM contents ORDER BY datetime(created_at) DESC", [], (e, rows) => {
    if (e) return res.status(500).send("DB error");
    res.send(rows);
  });
});

// ---------- POST CONTENT (ADMIN ONLY) ----------
app.post("/content", upload.single("media"), (req, res) => {
  const { title, body, author } = req.body;

  if (!isAdminEmail(author)) return res.status(403).send("Admin only");

  const media = req.file ? req.file.filename : null;
  const media_original_name = req.file ? req.file.originalname : null;
  const media_mime = req.file ? req.file.mimetype : null;

  db.run(
    `INSERT INTO contents (title,body,media,media_original_name,media_mime,author,created_at)
     VALUES (?,?,?,?,?,?,?)`,
    [title || "", body || "", media, media_original_name, media_mime, author, nowISO()],
    (err2) => {
      if (err2) return res.status(500).send("DB error");
      res.send("Posted");
    }
  );
});

// ---------- UPDATE CONTENT (ADMIN ONLY) ----------
app.put("/content/:id", (req, res) => {
  const { title, body, author } = req.body;
  if (!isAdminEmail(author)) return res.status(403).send("Admin only");

  db.run(
    "UPDATE contents SET title=?, body=? WHERE id=?",
    [title || "", body || "", req.params.id],
    (err) => {
      if (err) return res.status(500).send("DB error");
      res.send("Updated");
    }
  );
});

// ---------- DELETE CONTENT (ADMIN ONLY) ----------
app.delete("/content/:id", (req, res) => {
  const { author } = req.body;
  if (!isAdminEmail(author)) return res.status(403).send("Admin only");

  // remove file if exists
  db.get("SELECT media FROM contents WHERE id=?", [req.params.id], (e, row) => {
    if (row && row.media) {
      const fp = path.join(UPLOAD_DIR, row.media);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    db.run("DELETE FROM contents WHERE id=?", [req.params.id], (err) => {
      if (err) return res.status(500).send("DB error");
      res.send("Deleted");
    });
  });
});

// ---------- VIEW LOGGING ----------
app.post("/content/:id/view", (req, res) => {
  const { viewer_email } = req.body;
  const contentId = req.params.id;

  if (!viewer_email) return res.status(400).send("viewer_email required");

  db.run(
    "INSERT INTO content_views (content_id, viewer_email, viewed_at) VALUES (?,?,?)",
    [contentId, viewer_email, nowISO()],
    (err) => {
      if (err) return res.status(500).send("DB error");
      res.send("Logged");
    }
  );
});

// ---------- GET VIEWS (ADMIN ONLY) ----------
app.get("/content/:id/views", (req, res) => {
  const admin = req.query.admin;
  if (!isAdminEmail(admin)) return res.status(403).send("Admin only");

  db.all(
    "SELECT viewer_email, viewed_at FROM content_views WHERE content_id=? ORDER BY datetime(viewed_at) DESC",
    [req.params.id],
    (err, rows) => {
      if (err) return res.status(500).send("DB error");
      res.send(rows);
    }
  );
});

// ---------- USERS LIST (ADMIN ONLY) ----------
app.get("/users", (req, res) => {
  const admin = req.query.admin;
  if (!isAdminEmail(admin)) return res.status(403).send("Admin only");

  db.all(
    "SELECT id, email, username, role, blocked_until FROM users ORDER BY role DESC, email ASC",
    [],
    (err, rows) => {
      if (err) return res.status(500).send("DB error");
      res.send(rows);
    }
  );
});

// ---------- CREATE USER (ADMIN ONLY) ----------
app.post("/users", (req, res) => {
  const { admin, id, email, password, role, username } = req.body;
  if (!isAdminEmail(admin)) return res.status(403).send("Admin only");

  if (!id || !email || !password || !role) {
    return res.status(400).send("Missing fields");
  }

  db.run(
    "INSERT INTO users (id, email, password, role, username, blocked_until) VALUES (?,?,?,?,?,NULL)",
    [id, email, password, role, username || id],
    (err) => {
      if (err) return res.status(400).send("User insert failed (duplicate?)");
      res.send("User created");
    }
  );
});

// ---------- UPDATE USER (ADMIN ONLY) ----------
app.put("/users/:id", (req, res) => {
  const { admin, newUsername, newPassword } = req.body;
  if (!isAdminEmail(admin)) return res.status(403).send("Admin only");

  // Build query dynamically
  const updates = [];
  const params = [];

  if (newUsername && newUsername.trim()) {
    updates.push("username=?");
    params.push(newUsername.trim());
  }
  if (newPassword && newPassword.trim()) {
    updates.push("password=?");
    params.push(newPassword.trim());
  }

  if (updates.length === 0) return res.status(400).send("Nothing to update");

  params.push(req.params.id);

  db.run(
    `UPDATE users SET ${updates.join(", ")} WHERE id=?`,
    params,
    (err) => {
      if (err) return res.status(500).send("DB error");
      res.send("Updated");
    }
  );
});

// ---------- BLOCK USER (ADMIN ONLY) ----------
app.post("/users/:id/block", (req, res) => {
  const { admin, minutes } = req.body;
  if (!isAdminEmail(admin)) return res.status(403).send("Admin only");

  const mins = Number(minutes || 0);
  if (!mins || mins <= 0) return res.status(400).send("minutes required");

  const until = new Date(Date.now() + mins * 60 * 1000).toISOString();

  db.run(
    "UPDATE users SET blocked_until=? WHERE id=?",
    [until, req.params.id],
    (err) => {
      if (err) return res.status(500).send("DB error");
      res.send({ blocked_until: until });
    }
  );
});

// ---------- UNBLOCK USER (ADMIN ONLY) ----------
app.post("/users/:id/unblock", (req, res) => {
  const { admin } = req.body;
  if (!isAdminEmail(admin)) return res.status(403).send("Admin only");

  db.run(
    "UPDATE users SET blocked_until=NULL WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).send("DB error");
      res.send("Unblocked");
    }
  );
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'page.html'));
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});