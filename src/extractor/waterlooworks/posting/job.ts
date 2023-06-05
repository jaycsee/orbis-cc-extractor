export type JobDuration =
  | "4 month"
  | "4 or 8 month"
  | "8 month preferred"
  | "8 month required"
  | "UNKNOWN";
export type JobLevel = "JUNIOR" | "INTERMEDIATE" | "SENIOR";

export function parseJobDuration(duration: string): JobDuration {
  duration = duration.toLowerCase().trim();
  const four = duration.includes("4") || duration.includes("four");
  const eight = duration.includes("8") || duration.includes("eight");
  if (four && eight) return "4 or 8 month";
  else if (four) return "4 month";
  else if (eight && duration.includes("prefer")) return "8 month preferred";
  else if (eight && duration.includes("required")) return "8 month required";
  else return "UNKNOWN";
}

export function parseJobLevels(levels: string): JobLevel[] {
  return (["JUNIOR", "INTERMEDIATE", "SENIOR"] as const).filter((x) =>
    levels.toLowerCase().includes(x.toLowerCase())
  );
}
