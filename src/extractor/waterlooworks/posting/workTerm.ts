type WorkTerm = {
  year: number;
  term: "FALL" | "WINTER" | "SPRING" | "UNKNOWN";
};

export function parseWorkTermTerm(term: string): WorkTerm["term"] {
  term = term.toLowerCase().trim();
  if (term.includes("fall")) return "FALL";
  else if (term.includes("winter")) return "WINTER";
  else if (term.includes("spring")) return "SPRING";
  else return "UNKNOWN";
}

export function parseWorkTerm(workTerm: string): WorkTerm {
  const [year, term] = workTerm.split("-");
  return {
    year: parseInt(year ?? ""),
    term: parseWorkTermTerm(term ?? ""),
  };
}

export default WorkTerm;
