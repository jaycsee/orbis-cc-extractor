const RatingQuestion1 =
  "Availability of employer support (e.g. start of the term in the company, ongoing interactions with supervisors/others, general feedback, and end-of-term transition)";
const RatingQuestion2 = "Opportunities to learn or develop new skills";
const RatingQuestion3 =
  "Opportunities to make meaningful contributions at work";
const RatingQuestion4 = "Opportunities to expand your professional network";
const RatingQuestion5 = "Appropriate compensation and/or benefits";
const RatingQuestion6 =
  "How closely your work was related to your academic program";
const RatingQuestion7 =
  "How closely your work was related to the skills you are developing at university";

export interface RatingsQuestionsType {
  0: undefined;
  1: typeof RatingQuestion1;
  2: typeof RatingQuestion2;
  3: typeof RatingQuestion3;
  4: typeof RatingQuestion4;
  5: typeof RatingQuestion5;
  6: typeof RatingQuestion6;
  7: typeof RatingQuestion7;
}

export const RatingsQuestions: RatingsQuestionsType = [
  undefined,
  RatingQuestion1,
  RatingQuestion2,
  RatingQuestion3,
  RatingQuestion4,
  RatingQuestion5,
  RatingQuestion6,
  RatingQuestion7,
];

export type RatingsByQuestion = Record<1 | 2 | 3 | 4 | 5 | 6 | 7, number> &
  Record<0, undefined>;

export type SatisfactionDistribution = Record<
  1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10,
  number
> &
  Record<0, undefined>;

export interface SatisfactionRating {
  rating: number;
  n: number;
}
