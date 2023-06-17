import { ApplicationDocument } from "./documents";
import { JobDuration, JobLevel } from "./job";
import { ApplicationStatus, InternalStatus, JobPostingStatus } from "./status";
import { WorkTerm } from "./workTerm";

interface FromData {
  data: Map<string, string>;
}

interface StatusInformation extends FromData {
  parsed: {
    posting: JobPostingStatus;
    internal: InternalStatus;
  };
}

interface JobInformation extends FromData {
  parsed: {
    workTerm: WorkTerm;
    type: string;
    title: string;
    openings: number;
    category: {
      number: number;
      title: string;
    };
    level: JobLevel[];
    region: string;
    address: string[];
    location?: string;
    duration: JobDuration;
    specialRequirements?: string;
    summary: string;
    responsibilities: string;
    skills: string;
    transportationHousing?: string;
    compensation?: string;
    targets: string[];
  };
}

interface ApplicationInformation extends FromData {
  availableInteractions: string[];
  tags: string[];
  parsed: {
    status: ApplicationStatus;
    deadline: Date;
    requiredDocuments: ApplicationDocument[];
    additionalInformation?: string;
    method: string;
  };
}
interface CompanyInformation extends FromData {
  parsed: {
    organization: string;
    division: string;
  };
}

/**
 * An object representing a posting on PDPortal
 *
 * This object is not serializable: convert this object to a `PostingData`
 */
export default interface Posting {
  id: number;
  title: string;
  subtitle: string;

  error?: undefined;

  status: StatusInformation;
  job: JobInformation;
  application: ApplicationInformation;
  company: CompanyInformation;
}

export interface PostingError {
  id: string | number | undefined;
  error: string;
}

export * from "./data";
