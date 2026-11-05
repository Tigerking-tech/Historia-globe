// Category → display name + color. Safe to import in client components.
export const CATEGORIES: Record<string, { name: string; color: string }> = {
  politics: { name: "Politics", color: "#60a5fa" },
  war: { name: "War & Conflict", color: "#f87171" },
  space: { name: "Space", color: "#818cf8" },
  science: { name: "Science", color: "#34d399" },
  disaster: { name: "Disaster", color: "#fb923c" },
  tech: { name: "Technology", color: "#a78bfa" },
  exploration: { name: "Exploration", color: "#22d3ee" },
  "civil-rights": { name: "Civil Rights", color: "#facc15" },
  terrorism: { name: "Terrorism", color: "#ef4444" },
  environment: { name: "Environment", color: "#4ade80" },
  archaeology: { name: "Archaeology", color: "#c084fc" },
  history: { name: "History", color: "#94a3b8" },
  crime: { name: "Crime", color: "#f472b6" },
  mystery: { name: "Mystery", color: "#64748b" },
};

export function categoryColor(c: string): string {
  return (CATEGORIES[c] && CATEGORIES[c].color) || "#60a5fa";
}
export function categoryName(c: string): string {
  return (CATEGORIES[c] && CATEGORIES[c].name) || c;
}
