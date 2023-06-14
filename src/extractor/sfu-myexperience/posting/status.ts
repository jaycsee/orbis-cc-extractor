export type JobPostingStatus = "APPROVED" | "EXPIRED" | "UNKNOWN";

// If an SFU status are not present here, or a status is known to not be applicable
// to SFU, please create an issue on the github page or create a pull request.
export type InternalStatus =
  | "FILLED"
  | "PARTIALLY-FILLED"
  | "FILLED-EXTERNALLY"
  | "UNFILLED"
  | "EMP-RANKINGS-FINALIZED"
  | "INTERVIEW-COMPLETE"
  | "INTERVIEWING-PHASE"
  | "INTERVIEW-SELECTIONS-COMPLETE"
  | "EXPIRED-APPLICATIONS-AVAILABLE"
  | "OFFER-PHASE"
  | "OPEN-FOR-APPLICATIONS"
  | "CANCEL"
  | "NOT-SET"
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
  if (status.includes("part") && status.includes("filled"))
    return "PARTIALLY-FILLED";
  else if (status.includes("filled") && status.includes("externally"))
    return "FILLED-EXTERNALLY";
  else if (status.includes("unfilled")) return "UNFILLED";
  else if (status.includes("filled")) return "FILLED";
  else if (status.includes("rankings finalized"))
    return "EMP-RANKINGS-FINALIZED";
  else if (status.includes("interview complete")) return "INTERVIEW-COMPLETE";
  else if (status.includes("interview selections complete"))
    return "INTERVIEW-SELECTIONS-COMPLETE";
  else if (status.includes("interview") && status.includes("phase"))
    return "INTERVIEWING-PHASE";
  else if (status.includes("expired") && status.includes("available"))
    return "EXPIRED-APPLICATIONS-AVAILABLE";
  else if (status.includes("open") && status.includes("applications"))
    return "OPEN-FOR-APPLICATIONS";
  else if (status.includes("offer") && status.includes("phase"))
    return "OFFER-PHASE";
  else if (status.includes("cancel")) return "CANCEL";
  else if (status.includes("not set")) return "NOT-SET";
  else return "UNKNOWN";
}

export function parseApplicationStatus(status: string): ApplicationStatus {
  status = status.toLowerCase().trim();
  if (status.includes("application submitted")) return "APPLIED";
  else if (status.includes("shortlisted")) return "SHORTLISTED";
  else if (status.includes("not interested")) return "NOT-INTERESTED";
  else if (status.includes("expired")) return "EXPIRED";
  else if (status.includes("available")) return "AVAILABLE";
  else return "UNKNOWN";
}

export function parseInterviewStatus(status: string): InterviewStatus {
  status = status.toLowerCase().trim();
  if (status.includes("application submitted")) return "APPLIED";
  else if (status.includes("not selected")) return "NOT-SELECTED";
  else if (status.includes("selected") && status.includes("interview"))
    return "SELECTED-FOR-INTERVIEW";
  else if (status.includes("employed")) return "EMPLOYED";
  else if (status.includes("none")) return "NONE";
  else return "UNKNOWN";
}
