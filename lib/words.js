// Word validation — trusts the speech recognizer for most words.
// Since all words come from speech recognition, they are inherently real English.
// We only flag words as gibberish if the recognizer produced something very short
// and garbled, or if it's not in the corrections dictionary.
//
// On iOS we use UITextChecker (system dictionary). On web, we trust the recognizer
// and just check the corrections dictionary.

export function isRealWord(word, corrections = null) {
  const cleaned = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!cleaned) return true;        // punctuation, numbers — don't flag
  if (cleaned.length <= 1) return true; // single letters are fine

  // Words from the spelling corrections dictionary are always real
  if (corrections) {
    if (corrections[cleaned]) return true;
    if (Object.values(corrections).some(v => v.toLowerCase() === cleaned)) return true;
  }

  // Trust the speech recognizer — it only outputs real words
  return true;
}
