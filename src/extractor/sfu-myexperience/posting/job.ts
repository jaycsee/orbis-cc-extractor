export type JobDuration =
  | "4 month"
  | "4 or 8 month"
  | "8 month"
  | "8 or 12 month"
  | "12 month"
  | "UNKNOWN";
export type JobLevel = "JUNIOR" | "INTERMEDIATE" | "SENIOR";

export function parseJobDuration(duration: string): JobDuration {
  duration = duration.toLowerCase().trim();
  const four = duration.includes("4") || duration.includes("four");
  const eight = duration.includes("8") || duration.includes("eight");
  const twelve = duration.includes("12") || duration.includes("twelve");

  if (four && eight) return "4 or 8 month";
  else if (four) return "4 month";
  else if (eight && twelve) return "8 or 12 month";
  else if (eight) return "8 month";
  else if (twelve) return "12 month";
  else return "UNKNOWN";
}

export function parseJobLevels(levels: string): JobLevel[] {
  return (["JUNIOR", "INTERMEDIATE", "SENIOR"] as const).filter((x) =>
    levels.toLowerCase().includes(x.toLowerCase())
  );
}
