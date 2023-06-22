export type ApplicationDocument =
  | "Cover letter"
  | "Transcript"
  | "Resume"
  | "Student Summary Sheet"
  | "Work history"
  | "Other"
  | "UNKNOWN";

export function parseApplicationDocument(
  document: string
): ApplicationDocument {
  document = document
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (document.includes("cover") && document.includes("letter"))
    return "Cover letter";
  else if (document.includes("transcript")) return "Transcript";
  else if (document.includes("summary")) return "Student Summary Sheet";
  else if (document.includes("work") && document.includes("history"))
    return "Work history";
  else if (document.includes("resume")) return "Resume";
  else if (document.includes("other")) return "Other";
  else return "UNKNOWN";
}
