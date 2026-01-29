const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const pool = require("./db");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// ---------- UPLOADS ----------
const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
app.use("/uploads", express.static(UPLOAD_DIR));

// ---------- HELPERS ----------
function isAdminEmail(email) {
  return email === "admin@gmail.com";
}

// ---------- MULTER ----------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// ---------- LOGIN ----------
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      "SELECT email, role, username, department, blocked_until FROM users WHERE email=$1 AND password=$2",
      [email, password]
    );
    if (!result.rows.length) return res.status(401).send("Invalid login");

    const user = result.rows[0];
    if (user.blocked_until && new Date(user.blocked_until) > new Date()) {
      return res.status(403).send(`Blocked until ${user.blocked_until}`);
    }
    res.json(user);
  } catch (err) {
    console.error("LOGIN ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- GET CONTENT (WITH VIEW COUNT + DEPARTMENT FILTER) ----------
app.get("/content", async (req, res) => {
  try {
    const { email, department } = req.query;
    if (!email || !department) return res.status(400).send("email and department required");

    const baseQuery = `
      SELECT c.*,
             COALESCE(v.view_count, 0) AS view_count
      FROM contents c
      LEFT JOIN (
        SELECT content_id, COUNT(*) AS view_count
        FROM content_views
        GROUP BY content_id
      ) v ON v.content_id = c.id
    `;

    if (isAdminEmail(email) || department === "ALL") {
      const all = await pool.query(baseQuery + " ORDER BY c.created_at DESC");
      return res.json(all.rows);
    }

    const filtered = await pool.query(
      baseQuery + `
        WHERE c.department = 'ALL'
           OR c.department = $1
           OR c.department LIKE $2
           OR c.department LIKE $3
        ORDER BY c.created_at DESC
      `,
      [department, department + ",%", "%," + department]
    );

    res.json(filtered.rows);
  } catch (err) {
    console.error("GET CONTENT ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- POST CONTENT ----------
app.post("/content", upload.single("media"), async (req, res) => {
  try {
    const { title, body, author, departments } = req.body;
    if (!isAdminEmail(author)) return res.status(403).send("Admin only");

    let deptValue = "ALL";
    if (departments) {
      if (Array.isArray(departments)) deptValue = departments.join(",");
      else deptValue = String(departments);
    }
    deptValue = deptValue.split(",").map(d => d.trim().toUpperCase()).join(",");

    const media = req.file ? req.file.filename : null;
    const media_original_name = req.file ? req.file.originalname : null;
    const media_mime = req.file ? req.file.mimetype : null;

    await pool.query(
      `INSERT INTO contents
       (title, body, media, media_original_name, media_mime, author, department)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [title, body, media, media_original_name, media_mime, author, deptValue]
    );

    res.send("Posted");
  } catch (err) {
    console.error("CONTENT ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- UPDATE CONTENT ----------
app.put("/content/:id", async (req, res) => {
  try {
    const { title, body, author } = req.body;
    if (!isAdminEmail(author)) return res.status(403).send("Admin only");

    await pool.query(
      "UPDATE contents SET title=$1, body=$2 WHERE id=$3",
      [title, body, req.params.id]
    );
    res.send("Updated");
  } catch (err) {
    console.error("UPDATE CONTENT ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- DELETE CONTENT ----------
app.delete("/content/:id", async (req, res) => {
  try {
    const { author } = req.body;
    if (!isAdminEmail(author)) return res.status(403).send("Admin only");

    const fileRes = await pool.query("SELECT media FROM contents WHERE id=$1", [req.params.id]);
    if (fileRes.rows.length && fileRes.rows[0].media) {
      const fp = path.join(UPLOAD_DIR, fileRes.rows[0].media);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await pool.query("DELETE FROM contents WHERE id=$1", [req.params.id]);
    res.send("Deleted");
  } catch (err) {
    console.error("DELETE CONTENT ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- LOG CONTENT VIEW (DEDUPED) ----------
app.post("/content/:id/view", async (req, res) => {
  try {
    const { viewer_email } = req.body;
    if (!viewer_email) return res.status(400).send("viewer_email required");

    const alreadyViewed = await pool.query(
      `SELECT 1 FROM content_views WHERE content_id=$1 AND viewer_email=$2`,
      [req.params.id, viewer_email]
    );

    if (!alreadyViewed.rows.length) {
      await pool.query(
        `INSERT INTO content_views (content_id, viewer_email, viewed_at)
         VALUES ($1,$2,NOW())`,
        [req.params.id, viewer_email]
      );
    }
    res.send("View logged");
  } catch (err) {
    console.error("VIEW LOG ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- SEARCH USER BY ID ----------
app.get("/users/search", async (req, res) => {
  try {
    const { admin, id } = req.query;
    if (!isAdminEmail(admin)) return res.status(403).send("Admin only");
    if (!id) return res.status(400).send("User ID required");

    const result = await pool.query(
      `SELECT id, email, username, role, department, blocked_until
       FROM users WHERE id=$1`,
      [id]
    );
    if (!result.rows.length) return res.status(404).send("User not found");
    res.json(result.rows[0]);
  } catch (err) {
    console.error("USER SEARCH ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- GET USERS ----------
app.get("/users", async (req, res) => {
  try {
    const { admin } = req.query;
    if (!isAdminEmail(admin)) return res.status(403).send("Admin only");

    const result = await pool.query(
      `SELECT id, email, username, role, department, blocked_until
       FROM users ORDER BY department, id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET USERS ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- CREATE USER ----------
app.post("/users", async (req, res) => {
  try {
    const { admin, id, email, password, role, username, department } = req.body;
    if (!isAdminEmail(admin)) return res.status(403).send("Admin only");
    if (!id || !email || !password || !role) return res.status(400).send("Missing required fields");

    const dept = (department || "CSE").toUpperCase();
    await pool.query(
      `INSERT INTO users
       (id, email, password, role, username, department, blocked_until)
       VALUES ($1,$2,$3,$4,$5,$6,NULL)`,
      [id, email, password, role, username || id, dept]
    );
    res.send("User created");
  } catch (err) {
    console.error("CREATE USER ERROR:", err.message);
    res.status(500).send("Cannot create user");
  }
});

// ---------- UPDATE USER (ADMIN ONLY) ----------
app.put("/users/:id", async (req, res) => {
  try {
    const { admin, newUsername, newPassword, department } = req.body;

    if (!isAdminEmail(admin)) {
      return res.status(403).send("Admin only");
    }

    const updates = [];
    const values = [];
    let idx = 1;

    if (newUsername && newUsername.trim()) {
      updates.push(`username = $${idx++}`);
      values.push(newUsername.trim());
    }

    if (newPassword && newPassword.trim()) {
      updates.push(`password = $${idx++}`);
      values.push(newPassword.trim());
    }

    if (department && department.trim()) {
      updates.push(`department = $${idx++}`);
      values.push(department.trim().toUpperCase());
    }

    if (!updates.length) {
      return res.status(400).send("Nothing to update");
    }

    values.push(req.params.id);

    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx}`,
      values
    );

    res.send("User updated");
  } catch (err) {
    console.error("UPDATE USER ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- ROOT ----------
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "page.html"));
});

// ---------- PORT ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));