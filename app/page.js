"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { isRealWord } from "@/lib/words";

const VOICE_ID = "vS9XlXILmWaAX70P8jqb";

export default function Home() {
  const [words, setWords] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [upperCase, setUpperCase] = useState(true);
  const [playingWord, setPlayingWord] = useState(null);

  // Drag state
  const [dragIndex, setDragIndex] = useState(-1);
  const [dropTarget, setDropTarget] = useState(-1);
  const longPressTimer = useRef(null);
  const isDragging = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const wordRefs = useRef([]);

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const wordAudioRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const text = words.join(" ");

  const [sttSupported, setSttSupported] = useState(true);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
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
      const newWords = transcript.trim().split(/\s+/).filter(Boolean);
      setWords(newWords);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        alert("Microphone access denied. Please allow mic access and reload.");
      }
      if (event.error !== "no-speech") setIsListening(false);
    };

    recognition.onend = () => {
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
      setWords([]);
      recognition._shouldListen = true;
      recognition.start();
      setIsListening(true);
    }
  }, [isListening, stopListening]);

  const handlePlay = useCallback(async () => {
    if (!text.trim() || isPlaying) return;
    stopListening();

    if (audioRef.current) {
      audioRef.current.src = "";
      audioRef.current.load();
    }

    setIsPlaying(true);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: VOICE_ID }),
      });

      if (!response.ok) throw new Error("Speech generation failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setIsGenerating(false);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.onended = () => setIsPlaying(false);

        setTimeout(() => {
          audioRef.current.play().catch((e) => {
            console.error("Playback failed", e);
            setIsPlaying(false);
          });
        }, 50);
      }
    } catch (e) {
      console.error(e);
      setIsPlaying(false);
      setIsGenerating(false);
    }
  }, [text, isPlaying, stopListening]);

  const handleWordTap = useCallback(async (word, index) => {
    if (isPlaying || isDragging.current) return;
    stopListening();

    if (wordAudioRef.current) {
      wordAudioRef.current.src = "";
      wordAudioRef.current.load();
    }

    setPlayingWord(index);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word, voiceId: VOICE_ID, singleWord: true }),
      });

      if (!response.ok) throw new Error("Word speech failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setIsGenerating(false);

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
      setIsGenerating(false);
    }
  }, [isPlaying, stopListening]);

  const handleClear = () => {
    setWords([]);
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

  // --- Drag and drop ---
  const handlePointerDown = useCallback((e, index) => {
    if (isPlaying) return;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDragging.current = false;

    longPressTimer.current = setTimeout(() => {
      isDragging.current = true;
      setDragIndex(index);
      setDropTarget(index);
      // Prevent text selection
      document.body.style.userSelect = "none";
    }, 300);
  }, [isPlaying]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging.current || dragIndex === -1) {
      // If we moved too far before long-press fired, cancel it (it's a scroll)
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimeout(longPressTimer.current);
      }
      return;
    }

    // Find which word we're over
    const x = e.clientX;
    const y = e.clientY;
    for (let i = 0; i < wordRefs.current.length; i++) {
      const el = wordRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        setDropTarget(i);
        break;
      }
    }
  }, [dragIndex]);

  const handlePointerUp = useCallback((e, index) => {
    clearTimeout(longPressTimer.current);

    if (isDragging.current && dragIndex !== -1 && dropTarget !== -1 && dragIndex !== dropTarget) {
      // Reorder words
      setWords(prev => {
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(dropTarget, 0, moved);
        return next;
      });
    }

    if (!isDragging.current && index !== undefined) {
      // It was a tap, not a drag
      handleWordTap(words[index], index);
    }

    isDragging.current = false;
    setDragIndex(-1);
    setDropTarget(-1);
    document.body.style.userSelect = "";
  }, [dragIndex, dropTarget, handleWordTap, words]);

  // Global pointer up to handle releasing outside a word
  useEffect(() => {
    const handleGlobalUp = () => {
      if (isDragging.current) {
        if (dragIndex !== -1 && dropTarget !== -1 && dragIndex !== dropTarget) {
          setWords(prev => {
            const next = [...prev];
            const [moved] = next.splice(dragIndex, 1);
            next.splice(dropTarget, 0, moved);
            return next;
          });
        }
        isDragging.current = false;
        setDragIndex(-1);
        setDropTarget(-1);
        document.body.style.userSelect = "";
      }
      clearTimeout(longPressTimer.current);
    };

    window.addEventListener("pointerup", handleGlobalUp);
    window.addEventListener("pointercancel", handleGlobalUp);
    return () => {
      window.removeEventListener("pointerup", handleGlobalUp);
      window.removeEventListener("pointercancel", handleGlobalUp);
    };
  }, [dragIndex, dropTarget]);

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
        @keyframes breathe {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Recording overlay — tap anywhere to stop */}
      {isListening && (
        <div
          onClick={stopListening}
          style={{
            position: "fixed",
            inset: 0,
            background: "#E53E3E",
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 32px",
            cursor: "pointer",
            transition: "background 0.3s ease",
          }}
        >
          {/* Live transcript preview */}
          {words.length > 0 && (
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 48,
              fontWeight: 700,
              lineHeight: "60px",
              letterSpacing: "-0.02em",
              color: "#FAFAF8",
              width: "100%",
              wordBreak: "break-word",
              textAlign: "left",
              flex: 1,
              display: "flex",
              alignItems: "center",
            }}>
              <span>{upperCase ? words.join(" ").toUpperCase() : words.join(" ")}</span>
            </div>
          )}

          {/* Mic icon + hint */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            flexShrink: 0,
            ...(words.length > 0 ? { paddingBottom: 40 } : {}),
          }}>
            <div style={{
              width: words.length > 0 ? 64 : 120,
              height: words.length > 0 ? 64 : 120,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "pulse 2s ease-in-out infinite",
            }}>
              <svg width={words.length > 0 ? "28" : "40"} height={words.length > 0 ? "28" : "40"} viewBox="0 0 24 24" fill="none">
                <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" fill="#FAFAF8"/>
                <path d="M17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12H5C5 15.53 7.61 18.43 11 18.93V22H13V18.93C16.39 18.43 19 15.53 19 12H17Z" fill="#FAFAF8"/>
              </svg>
            </div>
            <span style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}>
              TAP ANYWHERE TO STOP
            </span>
          </div>
        </div>
      )}

      <main
        onPointerMove={handlePointerMove}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          background: "#FAFAF8",
          fontFamily: "'Inter', sans-serif",
          padding: "60px 32px 40px",
          touchAction: dragIndex !== -1 ? "none" : "auto",
        }}
      >
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
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 48,
              fontWeight: 700,
              lineHeight: "60px",
              letterSpacing: "-0.02em",
              width: "100%",
              wordBreak: "break-word",
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 14px",
            }}>
              {words.map((word, i) => {
                const gibberish = !isRealWord(word);
                const isTappedWord = playingWord === i;
                const isBeingDragged = dragIndex === i;
                const isDropSpot = dropTarget === i && dragIndex !== -1 && dragIndex !== i;

                let color = "#1A1A18";
                if (gibberish) color = "#E53E3E";

                const displayWord = upperCase ? word.toUpperCase() : word;

                return (
                  <span
                    key={`${word}-${i}`}
                    ref={el => wordRefs.current[i] = el}
                    onPointerDown={(e) => handlePointerDown(e, i)}
                    onPointerUp={(e) => handlePointerUp(e, i)}
                    style={{
                      color,
                      cursor: dragIndex !== -1 ? "grabbing" : "pointer",
                      transition: isBeingDragged ? "none" : "all 0.15s ease",
                      transform: isTappedWord
                        ? "scale(0.95)"
                        : isBeingDragged
                        ? "scale(1.1)"
                        : "scale(1)",
                      opacity: isBeingDragged ? 0.5 : 1,
                      animation: isGenerating && isTappedWord
                        ? "breathe 1.2s ease-in-out infinite"
                        : isGenerating && isPlaying
                        ? "breathe 1.2s ease-in-out infinite"
                        : "none",
                      WebkitTapHighlightColor: "transparent",
                      userSelect: "none",
                      position: "relative",
                      borderLeft: isDropSpot ? "3px solid #E85D3A" : "3px solid transparent",
                      paddingLeft: isDropSpot ? 4 : 0,
                    }}
                  >
                    {displayWord}
                  </span>
                );
              })}
            </div>
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
                  background: "#E85D3A",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s ease",
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
                TAP TO TALK
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
