import { Request, Response } from "express";
import { formatUser } from "../models/user.model";
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  phoneExists,
} from "../services/users.service";
import {
  validationError,
  notFoundError,
  serverError,
  isUuid,
  isPhone,
} from "../middleware/validate";
import { hashPassword } from "../../lib/auth";

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || "barber";
}

async function buildUsername(name: string): Promise<string> {
  const { db, usersTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  for (let i = 0; i < 10; i++) {
    const candidate = `${slugify(name)}_${Math.floor(Math.random() * 9000) + 1000}`;
    const [exists] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, candidate)).limit(1);
    if (!exists) return candidate;
  }
  return `barber_${Date.now()}`;
}

/** GET /api/v1/users */
export async function getUsers(req: Request, res: Response) {
  try {
    const rows = await listUsers();
    res.json({ data: rows.map(formatUser), total: rows.length });
  } catch (err) {
    serverError(res, err);
  }
}

/** GET /api/v1/users/:id */
export async function getUser(req: Request, res: Response) {
  try {
    const row = await getUserById(req.params.id);
    if (!row) return notFoundError(res, "User");
    res.json({ data: formatUser(row) });
  } catch (err) {
    serverError(res, err);
  }
}

/** POST /api/v1/users */
export async function postUser(req: Request, res: Response) {
  try {
    const { name, phone, password, role, language, brand_name, telegram_id } = req.body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return validationError(res, "Field 'name' is required");
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return validationError(res, "Field 'password' must be at least 6 characters");
    }
    if (phone && !isPhone(phone)) {
      return validationError(res, "Field 'phone' must be in international format (e.g. +998901234567)");
    }
    if (role && !["barber", "client"].includes(role)) {
      return validationError(res, "Field 'role' must be 'barber' or 'client'");
    }
    if (language && !["uz", "ru"].includes(language)) {
      return validationError(res, "Field 'language' must be 'uz' or 'ru'");
    }

    // Prevent duplicate phone
    if (phone && await phoneExists(phone)) {
      return res.status(409).json({ error: "conflict", message: "A user with this phone number already exists" });
    }

    const username = await buildUsername(name);
    const row = await createUser({
      name: name.trim(),
      username,
      password_hash: hashPassword(password),
      role: role ?? "barber",
      language: language ?? "uz",
      phone: phone ?? null,
      brand_name: brand_name ?? null,
      telegram_id: telegram_id ?? null,
    });

    res.status(201).json({ data: formatUser(row) });
  } catch (err) {
    serverError(res, err);
  }
}

/** PATCH /api/v1/users/:id */
export async function patchUser(req: Request, res: Response) {
  try {
    const { name, phone, role, language, brand_name, bio, avatar_url, deleted_at } = req.body;

    if (phone !== undefined && phone !== null && !isPhone(phone)) {
      return validationError(res, "Field 'phone' must be in international format");
    }
    if (role !== undefined && !["barber", "client"].includes(role)) {
      return validationError(res, "Field 'role' must be 'barber' or 'client'");
    }
    if (language !== undefined && !["uz", "ru"].includes(language)) {
      return validationError(res, "Field 'language' must be 'uz' or 'ru'");
    }
    if (phone && await phoneExists(phone, req.params.id)) {
      return res.status(409).json({ error: "conflict", message: "Phone number already in use" });
    }

    const row = await updateUser(req.params.id, {
      name, phone, role, language,
      brand_name, bio, avatar_url,
      deleted_at: deleted_at ? new Date(deleted_at) : undefined,
    });
    if (!row) return notFoundError(res, "User");
    res.json({ data: formatUser(row) });
  } catch (err) {
    serverError(res, err);
  }
}
