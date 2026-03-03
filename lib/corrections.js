// Spelling corrections dictionary.
// Maps what speech recognition hears to the desired spelling.
// Keys must be lowercase.
const DEFAULT_CORRECTIONS = {
  luca: "luka",
};

// Number-to-word conversion
const DIGIT_WORDS = {
  0: "zero", 1: "one", 2: "two", 3: "three", 4: "four",
  5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine",
};

const TEEN_WORDS = {
  10: "ten", 11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen",
  15: "fifteen", 16: "sixteen", 17: "seventeen", 18: "eighteen", 19: "nineteen",
};

const TENS_WORDS = {
  2: "twenty", 3: "thirty", 4: "forty", 5: "fifty",
  6: "sixty", 7: "seventy", 8: "eighty", 9: "ninety",
};

function smallNumber(n) {
  if (n < 10) return DIGIT_WORDS[n];
  if (n < 20) return TEEN_WORDS[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  if (ones === 0) return TENS_WORDS[tens];
  return `${TENS_WORDS[tens]} ${DIGIT_WORDS[ones]}`;
}

function numberToWords(word) {
  const cleaned = word.replace(/[^0-9]/g, "");
  if (!cleaned || !/^[\d,]+$/.test(word)) return word;

  const num = parseInt(cleaned, 10);
  if (num >= 0 && num <= 99) return smallNumber(num);

  // Larger numbers: spell each digit
  return cleaned.split("").map((d) => DIGIT_WORDS[parseInt(d, 10)]).join(" ");
}

// Load corrections from localStorage, falling back to defaults
const STORAGE_KEY = "puppet_corrections";

export function loadCorrections() {
  if (typeof window === "undefined") return { ...DEFAULT_CORRECTIONS };
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { ...DEFAULT_CORRECTIONS };
}

export function saveCorrections(corrections) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(corrections));
}

// Apply a single correction
export function correctWord(word, corrections) {
  // Number conversion first
  const numbered = numberToWords(word);
  if (numbered !== word) return numbered;

  const lower = word.toLowerCase();
  const corrected = corrections[lower];
  if (!corrected) return word;

  // Preserve casing
  if (word === word.toUpperCase()) return corrected.toUpperCase();
  if (word[0] === word[0].toUpperCase()) {
    return corrected[0].toUpperCase() + corrected.slice(1);
  }
  return corrected;
}

// Apply corrections to an array of words (may expand: "42" → ["forty", "two"])
export function correctAll(words, corrections) {
  return words.flatMap((w) => {
    const corrected = correctWord(w, corrections);
    return corrected.split(" ");
  });
}

// Check if a word is in the corrections dictionary (as key or value)
export function isKnownCorrection(word, corrections) {
  const lower = word.toLowerCase();
  if (corrections[lower]) return true;
  return Object.values(corrections).some((v) => v.toLowerCase() === lower);
}
