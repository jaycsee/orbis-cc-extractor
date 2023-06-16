export type JobDuration =
  | "4 month"
  | "4 or 8 month"
  | "8 month"
  | "8 or 12 month"
  | "12 month"
  | "16 month"
  | "UNKNOWN";
export type JobLevel = "JUNIOR" | "INTERMEDIATE" | "SENIOR";

export function parseJobDuration(duration: string): JobDuration {
  duration = duration.toLowerCase().trim();
  const twoWork = duration.includes("2 work");
  const four = duration.includes("4") || duration.includes("four");
  const eight = duration.includes("8") || duration.includes("eight");
  const twelve = duration.includes("12") || duration.includes("twelve");
  switch (true) {
    case four && eight:
      return "4 or 8 month";
    case four:
      return "4 month";
    case eight && twelve:
      return "8 or 12 month";
    case eight:
      return "8 month";
    case twelve:
      return "12 month";
    default:
      return "UNKNOWN";
  }
}

export function parseJobLevels(levels: string): JobLevel[] {
  return (["JUNIOR", "INTERMEDIATE", "SENIOR"] as const).filter((x) =>
    levels.toLowerCase().includes(x.toLowerCase())
  );
}
