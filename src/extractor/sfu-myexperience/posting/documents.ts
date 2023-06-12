export type ApplicationDocument =
  | "Cover letter"
  | "Grade report"
  | "Resume"
  | "Student Information Summary (SIS)"
  | "Transcript"
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
  else if (document.includes("grade") && document.includes("report"))
    return "Grade report";
  else if (document.includes("work") && document.includes("history"))
    return "Work history";
  else if (document.includes("SIS")) return "Student Information Summary (SIS)";
  else if (document.includes("Transcript")) return "Transcript";
  else if (document.includes("resume")) return "Resume";
  else if (document.includes("other")) return "Other";
  else return "UNKNOWN";
}
