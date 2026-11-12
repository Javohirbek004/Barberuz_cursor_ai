const CATEGORY_RU: Record<string, string> = {
  soch: "Волосы",
  soqol: "Борода",
  bolalar: "Детские",
  boshqa: "Другое",
  kosmetik: "Косметика",
  pakora: "Пакора",
};

export function categoryLabel(lang: string, name: string): string {
  if (lang !== "ru" || !name) return name;
  const bare = name.toLowerCase().replace(/[^a-z]/g, "");
  return CATEGORY_RU[bare] ?? name;
}

export function getCategoryIcon(categoryName: string): string {
  if (!categoryName) return "✨";
  const name = categoryName.toLowerCase();

  if (name.includes("soch") || name.includes("hair") || name.includes("fade") || name.includes("klassik")) return "✂️";
  if (name.includes("soqol") || name.includes("beard") || name.includes("shave")) return "🪒";
  if (name.includes("kompleks") || name.includes("vip") || name.includes("combo")) return "💈";
  if (name.includes("bola") || name.includes("kids") || name.includes("child")) return "👶";
  if (name.includes("rang") || name.includes("bo'yoq") || name.includes("boyoq") || name.includes("color")) return "🎨";
  if (name.includes("spa") || name.includes("yuz") || name.includes("face")) return "🧴";

  return "✨";
}
