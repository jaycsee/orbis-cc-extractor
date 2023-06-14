import { ApplicationDocument } from "./documents";
import { JobDuration, JobLevel } from "./job";
import {
  RatingsByQuestion,
  RatingsQuestionsType,
  SatisfactionDistribution,
  SatisfactionRating,
} from "./satisfactionRatings";
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
    preScreening: boolean;
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

interface StatsRatingsInformation {
  parsed: {
    overallRating?: number;
    hired: {
      organization: [WorkTerm, number][];
      division: [WorkTerm, number][];
    };
    percentByFaculty: { division: Map<string, number> };
    percentByTermNumber: { division: Map<string, number> };
    amountByProgram: { division: Map<string, number> };
    satisfaction?: {
      allCoop: SatisfactionRating;
      organization: SatisfactionRating & {
        distribution?: SatisfactionDistribution;
      };
      division: SatisfactionRating & {
        distribution?: SatisfactionDistribution;
      };
    };
    questionRating?: {
      readonly questions: RatingsQuestionsType;
      allCoop: RatingsByQuestion;
      organization?: RatingsByQuestion;
      division?: RatingsByQuestion;
    };
  };
}



/**
 * An object representing a posting on WaterlooWorks
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
  statsRatings?: StatsRatingsInformation;
}

export interface PostingError {
  id: string | number | undefined;
  error: string;
}

export * from "./data";
