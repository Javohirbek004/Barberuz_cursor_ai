import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, generateToken, authenticate, getUser } from "../lib/auth";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    brandName: user.brandName,
    mode: user.mode,
    lang: user.lang,
    telegramVerified: user.telegramVerified,
    telegramId: user.telegramId,
    createdAt: user.createdAt,
  };
}

function slugifyName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "barber";
}

async function uniqueUsername(baseName: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = Math.floor(Math.random() * 9000) + 1000;
    const candidate = `${slugifyName(baseName)}_${suffix}`;
    const [exists] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, candidate)).limit(1);
    if (!exists) return candidate;
  }
  return `barber_${Date.now()}`;
}

router.post("/register", async (req, res) => {
  try {
    const { name, username: providedUsername, brandName, password, mode, lang } = req.body;
    if (!name || !password || !mode) {
      res.status(400).json({ error: "validation", message: "Missing required fields" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "validation", message: "Password must be at least 6 characters" });
      return;
    }
    // Use provided username or auto-generate a unique one
    let username = providedUsername || "";
    if (!username) {
      username = await uniqueUsername(name);
    } else {
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
      if (existing) {
        username = await uniqueUsername(name);
      }
    }
    const passwordHash = hashPassword(password);
    const [user] = await db.insert(usersTable).values({
      name,
      username,
      brandName: brandName || null,
      passwordHash,
      mode: mode || "solo",
      lang: lang || "uz",
    }).returning();
    const token = generateToken(user.id);
    res.status(201).json({
      user: formatUser(user),
      token,
      telegramVerified: false,
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "validation", message: "Missing credentials" });
      return;
    }
    // Allow login by username OR by display name (case-insensitive)
    const { ilike, or } = await import("drizzle-orm");
    const [user] = await db.select().from(usersTable)
      .where(or(eq(usersTable.username, username), ilike(usersTable.name, username)))
      .limit(1);
    if (!user) {
      res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
      return;
    }
    const hash = hashPassword(password);
    if (hash !== user.passwordHash) {
      res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
      return;
    }
    const token = generateToken(user.id);
    res.json({
      user: formatUser(user),
      token,
      telegramVerified: user.telegramVerified,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "server_error", message: "Internal server error" });
  }
});

router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/me", authenticate, async (req, res) => {
  const user = getUser(req);
  res.json(formatUser(user));
});

router.get("/telegram-status/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }
    res.json({ verified: user.telegramVerified, telegramId: user.telegramId });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/telegram-verify", async (req, res) => {
  try {
    const { userId, telegramId, telegramUsername, secret } = req.body;
    const expectedSecret = process.env.TELEGRAM_BOT_SECRET || "barber_telegram_secret_2024";
    if (secret !== expectedSecret) {
      res.status(403).json({ error: "forbidden", message: "Invalid secret" });
      return;
    }
    await db.update(usersTable)
      .set({ telegramVerified: true, telegramId, telegramUsername: telegramUsername || null })
      .where(eq(usersTable.id, userId));
    res.json({ success: true, message: "Telegram verified" });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
