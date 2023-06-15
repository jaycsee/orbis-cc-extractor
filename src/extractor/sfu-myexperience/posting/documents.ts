export type ApplicationDocument =
  | "Cover letter"
  | "Resume"
  | "Student Information Summary (SIS)"
  | "Transcript"
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
  else if (document.includes("sis")) return "Student Information Summary (SIS)";
  else if (document.includes("transcript")) return "Transcript";
  else if (document.includes("resume")) return "Resume";
  else if (document.includes("other")) return "Other";
  else return "UNKNOWN";
}
