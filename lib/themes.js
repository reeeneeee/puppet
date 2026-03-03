export const themes = [
  {
    id: "original",
    name: "Original",
    bg: "#FAFAF8",
    text: "#1A1A18",
    accent: "#E85D3A",
    gibberish: "#E53E3E",
    muted: "#9B9890",
    controlBg: "#F0EFEB",
    recordingBg: "#E53E3E",
  },
  {
    // Navy & Lime — dark navy sock with chartreuse toe
    id: "navyLime",
    name: "Navy & Lime",
    bg: "#12203F",
    text: "#F5F5EB",
    accent: "#B6CF36",
    gibberish: "#FF6B6B",
    muted: "#788CAF",
    controlBg: "#1E3055",
    recordingBg: "#B6CF36",
  },
  {
    // Pink Space — pink/yellow/teal "space" sock
    id: "pinkSpace",
    name: "Pink Space",
    bg: "#FFF0F3",
    text: "#2D2337",
    accent: "#E6648C",
    gibberish: "#C83C3C",
    muted: "#AA96A5",
    controlBg: "#FAE1EB",
    recordingBg: "#50B9AF",
  },
  {
    // Monster — orange monster sock with big eyes
    id: "monster",
    name: "Monster",
    bg: "#F06432",
    text: "#FFFAF0",
    accent: "#1E3C78",
    gibberish: "#328C78",
    muted: "#FFC8AA",
    controlBg: "#DC5023",
    recordingBg: "#1E3C78",
  },
];

const STORAGE_KEY = "puppet_theme";

export function loadTheme() {
  if (typeof window === "undefined") return themes[0];
  const id = localStorage.getItem(STORAGE_KEY) || "original";
  return themes.find((t) => t.id === id) || themes[0];
}

export function saveTheme(theme) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, theme.id);
}
