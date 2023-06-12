import moment from "moment-timezone";
import type Posting from ".";
import type { PostingError } from ".";
import {
  MapEntries,
  ParsableMapEntries,
  parseMap,
  priorityMatch,
  splitFirst,
} from "../../util";
import { parseApplicationDocument } from "./documents";
import { parseJobDuration, parseJobLevels } from "./job";
import { parseInternalStatus, parseJobPostingStatus } from "./status";
import { parseWorkTerm } from "./workTerm";

export interface ParsablePostingData {
  id: number;
  title: string;
  subtitle: string;

  error: null;

  availableInteractions: string[];
  tags: string[];

  statusData: ParsableMapEntries<string, string>;
  jobData: ParsableMapEntries<string, string>;
  applicationData: ParsableMapEntries<string, string>;
  companyData: ParsableMapEntries<string, string>;
}

export interface PostingData extends ParsablePostingData {
  statusData: MapEntries<string, string>;
  jobData: MapEntries<string, string>;
  applicationData: MapEntries<string, string>;
  companyData: MapEntries<string, string>;
}

export interface PostingErrorData {
  id: string | number | null;
  error: string;
}

/**
 * Convert a `Posting` to an object which is serializable
 *
 * @param posting - The posting to convert
 * @returns The serialized version of posting
 * @see {@link parsePostingData}
 * @example
 * let posting: Posting;
 * const postingData = toPostingData(posting);
 * console.log(postingData.statusData); // [["key1", "value1"], ["key2", "value2"]]
 */
export function toPostingData(
  posting: Posting | PostingError
): PostingData | PostingErrorData {
  if (typeof posting.error === "string")
    return {
      id: posting.id ?? null,
      error: posting.error,
    };
  const { id, title, subtitle } = posting;
  const { availableInteractions, tags } = posting.application;

  return {
    id,
    title,
    subtitle,
    error: null,
    availableInteractions,
    tags,
    statusData: [...posting.status.data.entries()],
    jobData: [...posting.job.data.entries()],
    applicationData: [...posting.application.data.entries()],
    companyData: [...posting.company.data.entries()],
  };
}

/**
 * Parses posting data into a `Posting`
 *
 * Can parse a serialized version from {@link toPostingData} or a object labelling parsable map data
 *
 * @param data - The data to parse
 * @returns A `Posting` containing the parsed data, or `PostingError` if it encountered an error
 * @see {@link toPostingData}
 * @example
 * const posting = parsePostingData({...validData});
 * console.log(posting.id); // 123456
 * const postingError = parsePostingData({...invalidData});
 * console.log(postingError.error); // "Some error text"
 */
export function parsePostingData(
  data: ParsablePostingData | PostingErrorData
): Posting | PostingError {
  if (Array.isArray(data))
    throw new Error(
      "Got an array posting data. Perhaps you forgot to iterate?"
    );

  if (typeof data?.error === "string")
    return {
      id: typeof data.id === "string" ? data.id : undefined,
      error: data.error,
    };

  const { id } = data;

  if (!Array.isArray(data?.tags))
    return { id, error: "Got incorrect data type for tags" };
  if (!Array.isArray(data?.availableInteractions))
    return { id, error: "Got incorrect data type for availableInteractions" };
  const tags = data.tags.map(String);
  const lowerTags = tags.map((s) => s.toLowerCase());
  const availableInteractions = data.availableInteractions.map(String);
  const lowerInteractions = availableInteractions.map((s) => s.toLowerCase());

  let parsed: Record<
    "jobData" | "appData" | "statusData" | "companyData",
    Map<string, string>
  >;
  try {
    parsed = {
      jobData: parseMap(data?.jobData, "jobData"),
      appData: parseMap(data?.applicationData, "applicationData"),
      statusData: parseMap(data?.statusData, "statusData"),
      companyData: parseMap(data?.companyData, "companyData"),
    };
  } catch (err) {
    return { id, error: err?.toString() ?? "Unknown error" };
  }
  const { jobData, appData, statusData, companyData } = parsed;

  const statusString = (...k: string[]) =>
    priorityMatch(statusData, ...k)?.trim() ?? "UNKNOWN";
  const jobStringU = (...k: string[]) => priorityMatch(jobData, ...k)?.trim();
  const jobString = (...k: string[]) => jobStringU(...k) ?? "UNKNOWN";
  const appStringU = (...k: string[]) => priorityMatch(appData, ...k)?.trim();
  const appString = (...k: string[]) => appStringU(...k) ?? "UNKNOWN";
  const companyStringU = (...k: string[]) =>
    priorityMatch(companyData, ...k)?.trim();
  const companyString = (...k: string[]) => companyStringU(...k) ?? "UNKNOWN";

  const [categoryNumber, categoryTitle] = splitFirst(
    jobString("job category (noc)", "job category", "category"),
    " "
  ) ?? ["NaN", "UNKNOWN"];

  const parsedStatus = {
    posting: parseJobPostingStatus(
      statusString("job posting status", "posting")
    ),
    internal: parseInternalStatus(statusString("internal status", "internal")),
  };

  return {
    id: Number(id),
    title: String(data.title),
    subtitle: String(data.subtitle),
    error: undefined,
    status: {
      data: statusData,
      parsed: parsedStatus,
    },
    job: {
      data: jobData,
      parsed: {
        workTerm: parseWorkTerm(jobString("work term", "term")),
        type: jobString("job type", "type"),
        title: jobString("job title", "title"),
        openings: parseInt(
          jobString("number of job openings", "job openings", "opening")
        ),
        category: {
          number: parseInt(categoryNumber),
          title: categoryTitle,
        },
        level: parseJobLevels(jobString("level")),
        region: jobString("region"),
        address: [
          ...[
            "address line one",
            "address line two",
            "address line three",
          ].flatMap((s) => {
            const x = jobStringU(s);
            return x ? [x] : [];
          }),
          [
            ["city"],
            ["province / state", "province"],
            ["postal code / zip code", "postal code", "postal"],
          ]
            .flatMap((s) => {
              const x = jobStringU(...s);
              return x ? [x] : [];
            })
            .join(", "),
          jobString("country / region", "country"),
        ],
        location: jobStringU("job location", "location"),
        duration: parseJobDuration(jobString("work term duration", "duration")),
        specialRequirements: jobStringU(
          "special job requirements",
          "special job",
          "special"
        ),
        summary: jobString("job summary", "summary"),
        responsibilities: jobString("job responsibilities", "responsibilities"),
        skills: jobString("required skills", "skills"),
        transportationHousing: jobStringU(
          "transportation and housing",
          "transportation",
          "housing"
        ),
        compensation: jobStringU(
          "compensation and benefits information",
          "compensation and benefits",
          "compensation",
          "benefits"
        ),
        targets:
          jobStringU(
            "targeted degrees and disciplines",
            "targeted degrees",
            "targeted"
          )
            ?.split("\n")
            .filter((s) => !s.toLowerCase().includes("targeted clusters"))
            .map((s) => (s.startsWith("- ") ? s.slice(2).trim() : s)) ?? [],
      },
    },
    application: {
      data: appData,
      availableInteractions,
      tags,
      parsed: {
        deadline: moment
          .tz(
            appString("application deadline", "deadline"),
            "MMMM DD, YYYY HH:mm a",
            "America/Toronto"
          )
          .toDate(),
        method: appString("application method", "method"),
        requiredDocuments:
          appStringU(
            "application documents required",
            "documents required",
            "documents"
          )
            ?.split(",")
            .map(parseApplicationDocument) ?? [],
        status: lowerTags.some((s) => s.includes("application submitted"))
          ? "APPLIED"
          : parsedStatus.posting === "EXPIRED"
          ? "EXPIRED"
          : lowerTags.some((s) => s.includes("shortlisted"))
          ? "SHORTLISTED"
          : lowerInteractions.some((s) => s.includes("include"))
          ? "NOT-INTERESTED"
          : lowerInteractions.some((s) => s.includes("apply"))
          ? "AVAILABLE"
          : "UNKNOWN",
        additionalInformation: appStringU(
          "additional application information",
          "additional"
        ),
      },
    },
    company: {
      data: companyData,
      parsed: {
        division: companyString("division", "div"),
        organization: companyString("organization", "org"),
      },
    },
  };
}
