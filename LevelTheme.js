// One visual identity per level, reused by the room picker, materials and feedback.
export const LEVEL_THEME = {
  beginner: {
    name: "Beginner",
    code: "Level A1 · A2",
    tagline: "Building the basics",
    panel: "bg-[#F2F7FF] border-[#D9E6FB]",
    bar: "bg-[#1D4ED8]",
    accent: "text-[#1D4ED8]",
    chip: "bg-[#1D4ED8] text-white",
    soft: "bg-[#E6EFFC] text-[#1D4ED8]",
    ring: "border-[#1D4ED8]",
  },
  intermediate: {
    name: "Intermediate",
    code: "Level B1 · B2",
    tagline: "Speaking with confidence",
    panel: "bg-[#F8F3FF] border-[#E7D9F8]",
    bar: "bg-[#6B21A8]",
    accent: "text-[#6B21A8]",
    chip: "bg-[#6B21A8] text-white",
    soft: "bg-[#F0E6FA] text-[#6B21A8]",
    ring: "border-[#6B21A8]",
  },
};

export const levelTheme = (level) => LEVEL_THEME[level] || LEVEL_THEME.beginner;