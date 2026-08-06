import { Router } from "express";
import { db, expensesTable, expenseCategoriesTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";

const router = Router();

function todayTashkent() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
}

function getDateRange(period: string): { start: string; end: string } {
  const tz = "Asia/Tashkent";
  const today = todayTashkent();
  if (period === "today") return { start: today, end: today };
  if (period === "week") {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return { start: d.toLocaleDateString("sv-SE", { timeZone: tz }), end: today };
  }
  const d = new Date(); d.setDate(d.getDate() - 29);
  return { start: d.toLocaleDateString("sv-SE", { timeZone: tz }), end: today };
}

// GET /api/expenses/categories — MUST come before /:id
router.get("/categories", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const cats = await db.select()
      .from(expenseCategoriesTable)
      .where(eq(expenseCategoriesTable.barberId, user.id))
      .orderBy(expenseCategoriesTable.createdAt);
    res.json({ categories: cats.map(c => c.name) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

// POST /api/expenses/categories
router.post("/categories", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { name } = req.body as { name?: string };
    if (!name?.trim() || name.trim().length > 20) {
      res.status(400).json({ error: "validation", message: "name required (max 20 chars)" });
      return;
    }
    const [cat] = await db.insert(expenseCategoriesTable)
      .values({ barberId: user.id, name: name.trim() })
      .onConflictDoNothing()
      .returning();
    res.json(cat ?? { name: name.trim() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

// GET /api/expenses
router.get("/", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const period = req.query.period as string | undefined;
    const conditions: ReturnType<typeof eq>[] = [eq(expensesTable.barberId, user.id)];
    if (period) {
      const { start, end } = getDateRange(period);
      conditions.push(gte(expensesTable.date, start));
      conditions.push(lte(expensesTable.date, end));
    }
    const expenses = await db.select()
      .from(expensesTable)
      .where(and(...conditions))
      .orderBy(desc(expensesTable.date), desc(expensesTable.createdAt));
    res.json({ expenses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

// POST /api/expenses
router.post("/", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { title, amount, category, date } = req.body as {
      title?: string; amount?: number; category?: string; date?: string;
    };
    if (!title?.trim() || !amount || !category || !date) {
      res.status(400).json({ error: "validation", message: "title, amount, category, date required" });
      return;
    }
    const [expense] = await db.insert(expensesTable)
      .values({ barberId: user.id, title: title.trim(), amount: String(amount), category, date })
      .returning();
    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

// PUT /api/expenses/:id
router.put("/:id", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { id } = req.params;
    const { title, amount, category, date } = req.body as {
      title?: string; amount?: number; category?: string; date?: string;
    };
    const [expense] = await db.update(expensesTable)
      .set({
        ...(title  ? { title: title.trim() } : {}),
        ...(amount ? { amount: String(amount) } : {}),
        ...(category ? { category } : {}),
        ...(date   ? { date } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(expensesTable.id, id), eq(expensesTable.barberId, user.id)))
      .returning();
    if (!expense) { res.status(404).json({ error: "not_found" }); return; }
    res.json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

// DELETE /api/expenses/:id
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { id } = req.params;
    await db.delete(expensesTable)
      .where(and(eq(expensesTable.id, id), eq(expensesTable.barberId, user.id)));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
