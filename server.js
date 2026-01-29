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


// ---------- LOG CONTENT VIEW ----------
app.post("/content/:id/view", async (req, res) => {
  try {
    const { viewer_email } = req.body;
    if (!viewer_email) return res.status(400).send("viewer_email required");

    const alreadyViewed = await pool.query(
      `SELECT 1 FROM content_views
       WHERE content_id = $1 AND viewer_email = $2`,
      [req.params.id, viewer_email]
    );

    if (alreadyViewed.rows.length === 0) {
      await pool.query(
        `INSERT INTO content_views (content_id, viewer_email, viewed_at)
         VALUES ($1, $2, NOW())`,
        [req.params.id, viewer_email]
      );
    }

    res.send("View logged");
  } catch (err) {
    console.error("VIEW LOG ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- GET ALL USERS (ADMIN ONLY) ----------
app.get("/users", async (req, res) => {
  try {
    const { admin } = req.query;
    if (!isAdminEmail(admin)) return res.status(403).send("Admin only");

    const result = await pool.query(
      `SELECT id, email, username, role, department, blocked_until
       FROM users
       ORDER BY department, id`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET USERS ERROR:", err.message);
    res.status(500).send("DB error");
  }
});

// ---------- CREATE USER (ADMIN ONLY) ----------
app.post("/users", async (req, res) => {
  try {
    const { admin, id, email, password, role, username, department } = req.body;

    if (!isAdminEmail(admin)) {
      return res.status(403).send("Admin only");
    }

    if (!id || !email || !password || !role) {
      return res.status(400).send("Missing required fields");
    }

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