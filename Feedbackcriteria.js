// Rubric shared by both directions. Keys must match the stored feedback fields.
export const STUDENT_CRITERIA = [
  { key: "speaking", label: "Speaking", hint: "How much they spoke and improved" },
  { key: "confidence", label: "Confidence", hint: "Willing to try and make mistakes" },
  { key: "pronunciation", label: "Pronunciation", hint: "Clarity of sounds and stress" },
  { key: "vocabulary", label: "Vocabulary & grammar", hint: "Range and accuracy in use" },
  { key: "fluency", label: "Fluency", hint: "Smooth rhythm without long stops" },
  { key: "listening", label: "Listening", hint: "Understands questions and responds" },
];

export const MENTOR_CRITERIA = [
  { key: "clarity", label: "Clear explanation", hint: "Easy to follow and understand" },
  { key: "patience", label: "Patience & support", hint: "Helped without rushing" },
  { key: "engagement", label: "Engaging class", hint: "Kept the session alive" },
  { key: "practice", label: "Speaking practice", hint: "Enough time to speak" },
];

// Quick chips a student can tap when rating the mentor of a session.
export const MENTOR_TAGS = ["Clear explanation", "Very patient", "Fun class", "Useful vocabulary", "Encouraging"];

// Quick chips the mentor can tap instead of typing everything.
export const STUDENT_TAGS = [
  "Speaks fluently",
  "Good pronunciation",
  "Brave to try",
  "Active in class",
  "Good listening",
  "Rich vocabulary",
  "Needs more confidence",
  "Needs grammar practice",
  "Too quiet today",
  "Needs slower pace",
];

export const criteriaFor = (direction) => (direction === "student_to_mentor" ? MENTOR_CRITERIA : STUDENT_CRITERIA);

export const emptyCriteria = (list) => Object.fromEntries(list.map((item) => [item.key, 0]));

export const criteriaAverage = (row = {}, list) => {
  const values = list.map((item) => Number(row[item.key]) || 0).filter((value) => value > 0);
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
};

export const pickCriteria = (row = {}, list) => Object.fromEntries(list.map((item) => [item.key, Number(row[item.key]) || 0]));