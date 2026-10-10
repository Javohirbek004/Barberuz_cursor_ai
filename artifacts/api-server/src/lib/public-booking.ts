import { db, servicesTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

export type PublicServicePick = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function resolveCatalogServices(
  barberId: string,
  incoming: unknown,
): Promise<{ ok: true; services: PublicServicePick[]; totalPrice: number; totalDuration: number } | { ok: false; message: string }> {
  if (!Array.isArray(incoming) || incoming.length === 0 || incoming.length > 12) {
    return { ok: false, message: "Xizmat tanlanmagan" };
  }

  const catalog = await db
    .select({
      id: servicesTable.id,
      name: servicesTable.name,
      nameRu: servicesTable.nameRu,
      price: servicesTable.price,
      duration: servicesTable.duration,
    })
    .from(servicesTable)
    .where(and(
      eq(servicesTable.barberId, barberId),
      eq(servicesTable.isActive, true),
      isNull(servicesTable.deletedAt),
    ));

  const picked: PublicServicePick[] = [];
  for (const item of incoming) {
    if (!item || typeof item !== "object") return { ok: false, message: "Xizmat noto'g'ri" };
    const row = item as { id?: unknown; name?: unknown };
    const id = typeof row.id === "string" ? row.id : "";
    const name = typeof row.name === "string" ? row.name : "";
    const match = catalog.find((svc) =>
      (id && svc.id === id) || (name && (sameName(svc.name, name) || sameName(svc.nameRu || "", name))),
    );
    if (!match) return { ok: false, message: "Xizmat topilmadi" };
    picked.push({
      id: match.id,
      name: match.name,
      price: Number(match.price) || 0,
      duration: Math.max(Number(match.duration) || 1, 1),
    });
  }

  const totalPrice = picked.reduce((sum, svc) => sum + svc.price, 0);
  const totalDuration = picked.reduce((sum, svc) => sum + svc.duration, 0);
  return { ok: true, services: picked, totalPrice, totalDuration };
}
