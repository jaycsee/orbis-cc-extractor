export type JobPostingStatus = "APPROVED" | "EXPIRED" | "UNKNOWN";

export type InternalStatus =
  | "FILLED"
  | "PARTIALLY-FILLED"
  | "EMP-RANKINGS-FINALIZED"
  | "INTERVIEW-COMPLETE"
  | "INTERVIEW-SELECTIONS-COMPLETE"
  | "EXPIRED-APPLICATIONS-AVAILABLE"
  | "OPEN-FOR-APPLICATIONS"
  | "CANCEL"
  | "UNKNOWN";

export type ApplicationStatus =
  | "APPLIED"
  | "SHORTLISTED"
  | "NOT-INTERESTED"
  | "EXPIRED"
  | "AVAILABLE"
  | "UNKNOWN";

export type InterviewStatus =
  | "APPLIED"
  | "NOT-SELECTED"
  | "SELECTED-FOR-INTERVIEW"
  | "EMPLOYED"
  | "NONE"
  | "UNKNOWN";

export function parseJobPostingStatus(status: string): JobPostingStatus {
  status = status.toLowerCase().trim();
  if (status.includes("approved")) return "APPROVED";
  else if (status.includes("expired")) return "EXPIRED";
  else return "UNKNOWN";
}

export function parseInternalStatus(status: string): InternalStatus {
  status = status.toLowerCase().trim();
  if (status.includes("filled")) return "FILLED";
  else if (status.includes("partially filled")) return "PARTIALLY-FILLED";
  else if (status.includes("rankings finalized"))
    return "EMP-RANKINGS-FINALIZED";
  else if (status.includes("interview complete")) return "INTERVIEW-COMPLETE";
  else if (status.includes("interview selections complete"))
    return "INTERVIEW-SELECTIONS-COMPLETE";
  else if (status.includes("expired") && status.includes("available"))
    return "EXPIRED-APPLICATIONS-AVAILABLE";
  else if (status.includes("open") && status.includes("applications"))
    return "OPEN-FOR-APPLICATIONS";
  else if (status.includes("cancel")) return "CANCEL";
  else return "UNKNOWN";
}

export function parseApplicationStatus(status: string): ApplicationStatus {
  status = status.toLowerCase().trim();
  if (status.includes("applied")) return "APPLIED";
  else if (status.includes("shortlisted")) return "SHORTLISTED";
  else if (status.includes("not interested")) return "NOT-INTERESTED";
  else if (status.includes("expired")) return "EXPIRED";
  else if (status.includes("available")) return "AVAILABLE";
  else return "UNKNOWN";
}

export function parseInterviewStatus(status: string): InterviewStatus {
  status = status.toLowerCase().trim();
  if (status.includes("applied")) return "APPLIED";
  else if (status.includes("not selected")) return "NOT-SELECTED";
  else if (status.includes("selected") && status.includes("interview"))
    return "SELECTED-FOR-INTERVIEW";
  else if (status.includes("employed")) return "EMPLOYED";
  else if (status.includes("none")) return "NONE";
  else return "UNKNOWN";
}
