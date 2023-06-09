import type Posting from ".";

import type { PostingError } from ".";
import {
  parseApplicationStatus,
  parseInternalStatus,
  parseJobPostingStatus,
} from "./status";

function toSerializableMap(map: Map<string, string | number>) {
  return [...map.entries()];
}

export function serializablePosting(posting: Posting | PostingError) {
  if (typeof posting.error === "string") return JSON.stringify(posting);
  const { id, title, subtitle, error, status } = posting;
  return {
    ...{ id, title, subtitle, error, status },
    application: {
      data: toSerializableMap(posting.application.data),
      parsed: posting.application.parsed,
    },
    company: {
      data: toSerializableMap(posting.company.data),
      parsed: posting.company.parsed,
    },
    statsRatings: !posting.statsRatings
      ? null
      : {
          parsed: {
            ...posting.statsRatings.parsed,
            percentByFaculty: {
              division: toSerializableMap(
                posting.statsRatings.parsed.percentByFaculty.division
              ),
            },
            percentByTermNumber: {
              division: toSerializableMap(
                posting.statsRatings.parsed.percentByTermNumber.division
              ),
            },
            amountByProgram: {
              division: toSerializableMap(
                posting.statsRatings.parsed.amountByProgram.division
              ),
            },
            questionRating: {
              ...posting.statsRatings.parsed.questionRating,
              questions: "[**QUESTION_LIST**]",
            },
          },
        },
    serviceTeam: {
      data: toSerializableMap(posting.serviceTeam.data),
      parsed: posting.serviceTeam.parsed,
    },
    job: {
      data: toSerializableMap(posting.job.data),
      parsed: posting.job.parsed,
    },
    error: undefined,
  } as any;
}

type TypeArray = {
  string: string;
  number: number;
  "string[]": string[];
  "number[]": number[];
};

// function parseData<T extends keyof TypeArray, R>(
//   data: string | number | (string | number)[] | undefined,
//   type: T,
//   parser: (data: TypeArray[typeof type]) => R
// ): R {
//   if (type === "string")
//     return (parser as (data: TypeArray["string"]) => R)(
//       typeof data === "string" ? data : "UNKNOWN"
//     );
//   else if (type === "number")
//     return (parser as (data: TypeArray["number"]) => R)(Number(data));
//   else {
//     const parsedData = Array.isArray(data) ? data : [];
//     if (type === "string[]")
//     return (parser as (data: TypeArray["number"]) => R)(Number(data));
//   }
// }

export function fromSerializablePosting(posting: any): Posting | PostingError {
  return { id: undefined, error: "yes" };
  //   if (typeof posting.error === "string")
  //     return { id: posting.id, error: posting.error } satisfies PostingError;
  //   const { title, subtitle } = posting;
  //   return {
  //     id: parseData(posting?.id, "string", Number),
  //     title, // dont assume string
  //     subtitle,

  //     error: undefined,

  //     status: {
  //       data: new Map<string, string>(posting?.status?.data ?? []),
  //       parsed: {
  //         posting: parseJobPostingStatus(
  //           posting?.status?.parsed?.posting ?? "UNKNOWN"
  //         ),
  //         internal: parseInternalStatus(
  //           posting?.status?.parsed?.internal ?? "UNKNOWN"
  //         ),
  //       },
  //     },
  //     application: {
  //       data: new Map<string, string>(posting?.application?.data ?? []),
  //       availableInteractions: posting?.application?.availableInteractions ?? [],
  //       tags: posting?.application?.tags ?? [],
  //       parsed: {
  //         ...posting.application.parsed,
  //         status: parseApplicationStatus(posting.application.parsed),
  //       },
  //     },
  //     // company: {
  //     //   data: toSerializableMap(posting.company.data),
  //     //   parsed: posting.company.parsed,
  //     // },
  //     // statsRatings: !posting.statsRatings
  //     //   ? null
  //     //   : {
  //     //       parsed: {
  //     //         ...posting.statsRatings.parsed,
  //     //         percentByFaculty: {
  //     //           division: toSerializableMap(
  //     //             posting.statsRatings.parsed.percentByFaculty.division
  //     //           ),
  //     //         },
  //     //         percentByTermNumber: {
  //     //           division: toSerializableMap(
  //     //             posting.statsRatings.parsed.percentByTermNumber.division
  //     //           ),
  //     //         },
  //     //         amountByProgram: {
  //     //           division: toSerializableMap(
  //     //             posting.statsRatings.parsed.amountByProgram.division
  //     //           ),
  //     //         },
  //     //         questionRating: {
  //     //           ...posting.statsRatings.parsed.questionRating,
  //     //           questions: "[**QUESTION_LIST**]",
  //     //         },
  //     //       },
  //     //     },
  //     // serviceTeam: {
  //     //   data: toSerializableMap(posting.serviceTeam.data),
  //     //   parsed: posting.serviceTeam.parsed,
  //     // },
  //     // job: {
  //     //   data: toSerializableMap(posting.job.data),
  //     //   parsed: posting.job.parsed,
  //     // },
  //   } satisfies Posting;
}
