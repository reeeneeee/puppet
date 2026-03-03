"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { isRealWord } from "@/lib/words";
import { loadCorrections, saveCorrections, correctAll, isKnownCorrection } from "@/lib/corrections";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const VOICE_ID = "vS9XlXILmWaAX70P8jqb";

// --- Draggable + tappable word ---
function DraggableWord({ id, word, displayWord, gibberish, onTap, isTappedWord, isGenerating }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  // Only use translate, not scale — dnd-kit's default scale squishes words
  const translateOnly = transform
    ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
    : "";
  const tapScale = isTappedWord && !isDragging ? " scale(0.95)" : "";

  const style = {
    transform: `${translateOnly}${tapScale}`.trim() || undefined,
    transition,
    color: isDragging ? "#E85D3A" : gibberish ? "#E53E3E" : "#1A1A18",
    cursor: isDragging ? "grabbing" : "pointer",
    opacity: isDragging ? 0.8 : 1,
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    touchAction: "none",
    zIndex: isDragging ? 10 : 1,
    animation: isGenerating && isTappedWord
      ? "breathe 1.2s ease-in-out infinite"
      : "none",
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) onTap();
      }}
    >
      {displayWord}
    </span>
  );
}

export default function Home() {
  const [wordItems, setWordItems] = useState([]);
  const nextId = useRef(0);

  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [upperCase, setUpperCase] = useState(true);
  const [playingWord, setPlayingWord] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDraggingAny, setIsDraggingAny] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [corrections, setCorrections] = useState({});
  const [showTranslations, setShowTranslations] = useState(false);
  const [newFrom, setNewFrom] = useState("");
  const [newTo, setNewTo] = useState("");
  const wordsBeforeRef = useRef([]);

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const wordAudioRef = useRef(null);
  const listenStartedAt = useRef(0);
  const correctionsRef = useRef({});

  // Load corrections on mount
  useEffect(() => {
    const c = loadCorrections();
    setCorrections(c);
    correctionsRef.current = c;
  }, []);

  const words = wordItems.map((w) => w.text);
  const text = words.join(" ");

  // dnd-kit sensors — short tap = soundboard, long-press/drag = reorder
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  // --- Speech recognition ---
  const sttConstructorRef = useRef(null);
  const isIOSRef = useRef(false);
  const shouldListenRef = useRef(false);
  const sessionIdRef = useRef(0);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    sttConstructorRef.current = SR;
    isIOSRef.current = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }, []);

  // Creates & starts a fresh SpeechRecognition instance
  const startRecognition = useCallback((sessionId) => {
    const SR = sttConstructorRef.current;
    if (!SR) return;

    // Abort if this session was already stopped
    if (sessionId !== sessionIdRef.current) return;

    // Stop any existing instance first
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const r = new SR();
    r.continuous = !isIOSRef.current;
    r.interimResults = true;
    r.lang = "en-US";

    // Track finalized word count for iOS interim display
    let finalizedCount = 0;

    r.onresult = (event) => {
      if (sessionId !== sessionIdRef.current) return;
      const corr = correctionsRef.current;
      const before = wordsBeforeRef.current;
      setWordItems((prev) => {
        if (isIOSRef.current) {
          const finalized = prev.slice(0, before.length + finalizedCount);
          const allWords = [];
          let newFinalizedCount = finalizedCount;

          for (let i = 0; i < event.results.length; i++) {
            const words = event.results[i][0].transcript.trim().split(/\s+/).filter(Boolean);
            allWords.push(...words);
            if (event.results[i].isFinal) {
              newFinalizedCount = finalized.length - before.length + allWords.length;
            }
          }
          finalizedCount = newFinalizedCount;

          const corrected = correctAll(allWords, corr);
          const interimItems = corrected.map(w => ({ id: `w-${nextId.current++}`, text: w }));
          return [...finalized, ...interimItems];
        }
        // Desktop continuous: replace with full transcript
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        const rawWords = transcript.trim().split(/\s+/).filter(Boolean);
        const corrected = correctAll(rawWords, corr);
        const newItems = corrected.map((w, i) => {
          const idx = before.length + i;
          if (idx < prev.length && prev[idx].text === w) return prev[idx];
          return { id: `w-${nextId.current++}`, text: w };
        });
        return [...before, ...newItems];
      });
    };

    r.onerror = (event) => {
      if (sessionId !== sessionIdRef.current) return;
      console.error("STT error:", event.error);
      if (event.error !== "no-speech" && event.error !== "aborted" && event.error !== "network") {
        shouldListenRef.current = false;
        setIsListening(false);
      }
    };

    r.onend = () => {
      // Only restart if this is still the active session
      if (sessionId !== sessionIdRef.current) return;
      if (shouldListenRef.current) {
        setTimeout(() => {
          if (shouldListenRef.current && sessionId === sessionIdRef.current) {
            startRecognition(sessionId);
          }
        }, 50);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = r;

    try {
      r.start();
    } catch (e) {
      console.warn("start failed:", e.message);
      shouldListenRef.current = false;
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    sessionIdRef.current++; // Invalidate any pending restarts
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setCountdown(0);
  }, []);

  const toggleListening = useCallback(() => {
    if (!sttConstructorRef.current) return;

    if (isListening || countdown > 0) {
      stopListening();
      setCountdown(0);
    } else {
      // Save existing words to append after
      wordsBeforeRef.current = [...wordItems];

      // Start countdown 3-2-1, then begin listening
      // Start the recognition engine during countdown so it's warmed up
      shouldListenRef.current = true;
      const sid = ++sessionIdRef.current;
      startRecognition(sid);

      setCountdown(3);
      let count = 3;
      const tick = () => {
        setTimeout(() => {
          count--;
          if (count <= 0) {
            setCountdown(0);
            listenStartedAt.current = Date.now();
            setIsListening(true);
          } else {
            setCountdown(count);
            tick();
          }
        }, 700);
      };
      tick();
    }
  }, [isListening, countdown, wordItems, stopListening, startRecognition]);

  // --- TTS full sentence ---
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

  // --- TTS single word ---
  const handleWordTap = useCallback(async (word, index) => {
    if (isPlaying || isDraggingAny) return;
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
  }, [isPlaying, isDraggingAny, stopListening]);

  const handleClear = () => {
    setWordItems([]);
    wordsBeforeRef.current = [];
    nextId.current = 0;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    if (wordAudioRef.current) { wordAudioRef.current.pause(); wordAudioRef.current.src = ""; }
    setIsPlaying(false);
    setPlayingWord(null);
  };

  // --- dnd-kit handlers ---
  const handleDragStart = useCallback(() => {
    setIsDraggingAny(true);
  }, []);

  const handleDragEnd = useCallback((event) => {
    setIsDraggingAny(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setWordItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  }, []);

  const handleDragCancel = useCallback(() => {
    setIsDraggingAny(false);
  }, []);

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

      {/* Countdown overlay */}
      {countdown > 0 && (
        <div
          onClick={() => { stopListening(); setCountdown(0); }}
          style={{
            position: "fixed",
            inset: 0,
            background: "#E85D3A",
            zIndex: 101,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <span style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 120,
            fontWeight: 700,
            color: "#FAFAF8",
          }}>
            {countdown}
          </span>
        </div>
      )}

      {/* Translations modal */}
      {showTranslations && (
        <div
          onClick={() => setShowTranslations(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#FAFAF8",
              borderRadius: 16,
              width: "100%",
              maxWidth: 480,
              maxHeight: "80vh",
              overflow: "auto",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: "#1A1A18" }}>
                Translations
              </span>
              <button
                onClick={() => setShowTranslations(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#E85D3A" }}
              >
                Done
              </button>
            </div>

            {/* Add new row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Heard"
                value={newFrom}
                onChange={(e) => setNewFrom(e.target.value)}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8,
                  border: "none", background: "#F0EFEB",
                  fontFamily: "'Inter', sans-serif", fontSize: 15, color: "#1A1A18",
                  outline: "none",
                }}
              />
              <span style={{ color: "#9B9890", fontSize: 14, fontWeight: 600 }}>&rarr;</span>
              <input
                type="text"
                placeholder="Spelling"
                value={newTo}
                onChange={(e) => setNewTo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFrom.trim() && newTo.trim()) {
                    const updated = { ...corrections, [newFrom.trim().toLowerCase()]: newTo.trim() };
                    setCorrections(updated);
                    correctionsRef.current = updated;
                    saveCorrections(updated);
                    setNewFrom("");
                    setNewTo("");
                  }
                }}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 8,
                  border: "none", background: "#F0EFEB",
                  fontFamily: "'Inter', sans-serif", fontSize: 15, color: "#1A1A18",
                  outline: "none",
                }}
              />
              <button
                onClick={() => {
                  if (!newFrom.trim() || !newTo.trim()) return;
                  const updated = { ...corrections, [newFrom.trim().toLowerCase()]: newTo.trim() };
                  setCorrections(updated);
                  correctionsRef.current = updated;
                  saveCorrections(updated);
                  setNewFrom("");
                  setNewTo("");
                }}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  background: (newFrom.trim() && newTo.trim()) ? "#E85D3A" : "#F0EFEB",
                  border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: (newFrom.trim() && newTo.trim()) ? "#FAFAF8" : "#9B9890",
                  fontSize: 18, fontWeight: 700,
                }}
              >
                +
              </button>
            </div>

            {/* Existing translations */}
            {Object.keys(corrections).length === 0 ? (
              <p style={{ color: "#9B9890", fontSize: 14, textAlign: "center", padding: 20 }}>No translations yet</p>
            ) : (
              Object.entries(corrections).sort(([a], [b]) => a.localeCompare(b)).map(([from, to]) => (
                <div key={from} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid #F0EFEB",
                }}>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 500, color: "#1A1A18" }}>{from}</span>
                  <span style={{ color: "#9B9890", fontSize: 12, fontWeight: 600 }}>&rarr;</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: "#E85D3A" }}>{to}</span>
                  <span style={{ flex: 1 }} />
                  <button
                    onClick={() => {
                      const updated = { ...corrections };
                      delete updated[from];
                      setCorrections(updated);
                      correctionsRef.current = updated;
                      saveCorrections(updated);
                    }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#9B9890", fontSize: 18, opacity: 0.5, padding: "0 4px",
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Recording overlay */}
      {isListening && (
        <div
          onClick={() => {
            // Guard: ignore taps within 500ms of starting — prevents mobile
            // touch event from bleeding through the button into the overlay
            if (Date.now() - listenStartedAt.current < 500) return;
            stopListening();
          }}
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
          }}
        >
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
              flex: 1,
              display: "flex",
              alignItems: "center",
            }}>
              <span>{upperCase ? text.toUpperCase() : text}</span>
            </div>
          )}

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

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={() => setShowTranslations(true)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              fontSize: 16,
              color: "#9B9890",
            }}
            title="Translations"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
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
          </div>
        </header>

        {/* Text area */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
        }}>
          {wordItems.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={wordItems.map((w) => w.id)}
                strategy={horizontalListSortingStrategy}
              >
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
                  {wordItems.map((item, i) => (
                    <DraggableWord
                      key={item.id}
                      id={item.id}
                      word={item.text}
                      displayWord={upperCase ? item.text.toUpperCase() : item.text}
                      gibberish={!isRealWord(item.text, corrections)}
                      onTap={() => handleWordTap(item.text, i)}
                      isTappedWord={playingWord === i}
                      isGenerating={isGenerating}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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
        {wordItems.length > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            flexShrink: 0,
          }}>
            <button onClick={toggleListening} style={{
              width: 56, height: 56, borderRadius: 28,
              background: "#F0EFEB", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z" fill="#9B9890"/>
                <path d="M17 12C17 14.76 14.76 17 12 17C9.24 17 7 14.76 7 12H5C5 15.53 7.61 18.43 11 18.93V22H13V18.93C16.39 18.43 19 15.53 19 12H17Z" fill="#9B9890"/>
              </svg>
            </button>

            <button onClick={handlePlay} disabled={isPlaying} style={{
              width: 72, height: 72, borderRadius: 36,
              background: isPlaying ? "#9B9890" : "#E85D3A",
              border: "none", cursor: isPlaying ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s ease",
              animation: isGenerating && isPlaying ? "breathe 1.2s ease-in-out infinite" : "none",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M8 5V19L19 12L8 5Z" fill="#FAFAF8"/>
              </svg>
            </button>

            <button onClick={handleClear} style={{
              width: 56, height: 56, borderRadius: 28,
              background: "#F0EFEB", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
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
