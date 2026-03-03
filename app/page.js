"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { isRealWord } from "@/lib/words";

const VOICE_ID = "vS9XlXILmWaAX70P8jqb";

// Average speaking rate: ~150 wpm = ~400ms per word.
// Shorter words are faster, longer words slower.
function estimateWordDuration(word) {
  const syllables = Math.max(1, word.replace(/[^aeiouy]/gi, "").length);
  return 250 + syllables * 120; // base + per-syllable
}

export default function Home() {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [upperCase, setUpperCase] = useState(true);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [playingWord, setPlayingWord] = useState(null); // for single-word tap
  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const wordAudioRef = useRef(null);
  const highlightTimerRef = useRef(null);

  const words = text.trim() ? text.trim().split(/\s+/) : [];

  const [sttSupported, setSttSupported] = useState(true);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("SpeechRecognition not supported in this browser");
      setSttSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      console.log("Transcript:", transcript);
      setText(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        alert("Microphone access denied. Please allow mic access and reload.");
      }
      if (event.error !== "no-speech") setIsListening(false);
    };

    recognition.onend = () => {
      console.log("Recognition ended, shouldListen:", recognitionRef.current?._shouldListen);
      if (recognitionRef.current?._shouldListen) {
        try { recognition.start(); } catch (e) {}
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
  }, []);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition._shouldListen = false;
    recognition.stop();
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isListening) {
      stopListening();
    } else {
      setText("");
      setActiveWordIndex(-1);
      recognition._shouldListen = true;
      recognition.start();
      setIsListening(true);
    }
  }, [isListening, stopListening]);

  // Play the full sentence with karaoke highlighting
  const handlePlay = useCallback(async () => {
    if (!text.trim() || isPlaying) return;

    // Stop mic before playing
    stopListening();

    if (audioRef.current) {
      audioRef.current.src = "";
      audioRef.current.load();
    }

    setIsPlaying(true);
    setActiveWordIndex(0);

    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: VOICE_ID }),
      });

      if (!response.ok) throw new Error("Speech generation failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;

        // Start karaoke highlighting when audio begins
        audioRef.current.onplay = () => {
          const currentWords = text.trim().split(/\s+/);
          let idx = 0;
          setActiveWordIndex(0);

          const advance = () => {
            idx++;
            if (idx < currentWords.length) {
              setActiveWordIndex(idx);
              highlightTimerRef.current = setTimeout(
                advance,
                estimateWordDuration(currentWords[idx])
              );
            }
          };

          if (currentWords.length > 0) {
            highlightTimerRef.current = setTimeout(
              advance,
              estimateWordDuration(currentWords[0])
            );
          }
        };

        audioRef.current.onended = () => {
          clearTimeout(highlightTimerRef.current);
          setActiveWordIndex(-1);
          setIsPlaying(false);
        };

        setTimeout(() => {
          audioRef.current.play().catch((e) => {
            console.error("Playback failed", e);
            setIsPlaying(false);
            setActiveWordIndex(-1);
          });
        }, 50);
      }
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
      setActiveWordIndex(-1);
    }
  }, [text, isPlaying, stopListening]);

  // Tap a single word to hear it
  const handleWordTap = useCallback(async (word, index) => {
    if (isPlaying) return; // don't interrupt full playback

    // Stop mic before playing a word
    stopListening();

    // Warm up for iOS
    if (wordAudioRef.current) {
      wordAudioRef.current.src = "";
      wordAudioRef.current.load();
    }

    setPlayingWord(index);

    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word, voiceId: VOICE_ID }),
      });

      if (!response.ok) throw new Error("Word speech failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (wordAudioRef.current) {
        wordAudioRef.current.src = url;
        wordAudioRef.current.onended = () => setPlayingWord(null);
        setTimeout(() => {
          wordAudioRef.current.play().catch(() => setPlayingWord(null));
        }, 50);
      }
    } catch (e) {
      console.error(e);
      setPlayingWord(null);
    }
  }, [isPlaying, stopListening]);

  const handleClear = () => {
    setText("");
    clearTimeout(highlightTimerRef.current);
    setActiveWordIndex(-1);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (wordAudioRef.current) {
      wordAudioRef.current.pause();
      wordAudioRef.current.src = "";
    }
    setIsPlaying(false);
    setPlayingWord(null);
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Inter:wght@400;500&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; background: #FAFAF8; overflow: hidden; }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>

      <main style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        background: "#FAFAF8",
        fontFamily: "'Inter', sans-serif",
        padding: "60px 32px 40px",
      }}>
        {/* Top bar */}
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15,
            fontWeight: 700,
            color: "#1A1A18",
            letterSpacing: "-0.01em",
          }}>puppet</span>

          <button
            onClick={() => setUpperCase(!upperCase)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <span style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#9B9890",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>Aa</span>
            <span style={{
              display: "flex",
              alignItems: "center",
              justifyContent: upperCase ? "flex-end" : "flex-start",
              width: 36,
              height: 20,
              borderRadius: 10,
              background: upperCase ? "#1A1A18" : "#F0EFEB",
              padding: 2,
              transition: "all 0.2s ease",
            }}>
              <span style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                background: "#FAFAF8",
                transition: "all 0.2s ease",
              }} />
            </span>
          </button>
        </header>

        {/* Text area */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
        }}>
          {words.length > 0 ? (
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 48,
              fontWeight: 700,
              lineHeight: "60px",
              letterSpacing: "-0.02em",
              width: "100%",
              wordBreak: "break-word",
              display: "flex",
              flexWrap: "wrap",
              gap: "0 14px",
            }}>
              {words.map((word, i) => {
                const gibberish = !isRealWord(word);
                const isActive = activeWordIndex === i;
                const isTappedWord = playingWord === i;

                let color = "#1A1A18";
                if (gibberish) color = "#E53E3E";
                if (isActive) color = "#E85D3A";

                const displayWord = upperCase ? word.toUpperCase() : word;

                return (
                  <span
                    key={i}
                    onClick={() => handleWordTap(word, i)}
                    style={{
                      color,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      transform: isActive ? "scale(1.05)" : isTappedWord ? "scale(0.95)" : "scale(1)",
                      opacity: isPlaying && !isActive ? 0.3 : 1,
                      WebkitTapHighlightColor: "transparent",
                      userSelect: "none",
                    }}
                  >
                    {displayWord}
                  </span>
                );
              })}
            </p>
          ) : (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
            }}>
              <button
                onClick={toggleListening}
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  background: isListening ? "#1A1A18" : "#E85D3A",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s ease",
                  animation: isListening ? "pulse 2s ease-in-out infinite" : "none",
                }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" fill="#FAFAF8"/>
                  <path d="M17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12H5C5 15.53 7.61 18.43 11 18.93V22H13V18.93C16.39 18.43 19 15.53 19 12H17Z" fill="#FAFAF8"/>
                </svg>
              </button>
              <span style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#9B9890",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}>
                {isListening ? "LISTENING..." : "TAP TO TALK"}
              </span>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        {words.length > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            flexShrink: 0,
          }}>
            <button
              onClick={toggleListening}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: isListening ? "#1A1A18" : "#F0EFEB",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s ease",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" fill={isListening ? "#FAFAF8" : "#9B9890"}/>
                <path d="M17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12H5C5 15.53 7.61 18.43 11 18.93V22H13V18.93C16.39 18.43 19 15.53 19 12H17Z" fill={isListening ? "#FAFAF8" : "#9B9890"}/>
              </svg>
            </button>

            <button
              onClick={handlePlay}
              disabled={isPlaying}
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                background: isPlaying ? "#9B9890" : "#E85D3A",
                border: "none",
                cursor: isPlaying ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s ease",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M8 5V19L19 12L8 5Z" fill="#FAFAF8"/>
              </svg>
            </button>

            <button
              onClick={handleClear}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                background: "#F0EFEB",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6L18 18" stroke="#9B9890" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}

        <audio ref={audioRef} hidden />
        <audio ref={wordAudioRef} hidden />

      </main>
    </>
  );
}
