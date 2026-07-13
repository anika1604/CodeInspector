import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/pool";
import { signToken } from "../middleware/authMiddleware";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { email, password, displayName } = req.body ?? {};
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: "email, password, displayName are required" });
  }

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount) {
    return res.status(409).json({ error: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (email, display_name, password_hash)
     VALUES ($1, $2, $3) RETURNING id, email, display_name`,
    [email, displayName, passwordHash]
  );

  const user = result.rows[0];
  const token = signToken(user.id);
  res.status(201).json({ token, user });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const result = await pool.query(
    "SELECT id, password_hash, display_name FROM users WHERE email = $1",
    [email]
  );
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(user.id);
  res.json({ token, user: { id: user.id, displayName: user.display_name } });
});
