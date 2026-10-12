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
