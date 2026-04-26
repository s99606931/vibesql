"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, User, Loader2, Trash2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface AiChatPanelProps {
  open: boolean;
  onClose: () => void;
}

function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [dep]);
  return ref;
}

export function AiChatPanel({ open, onClose }: AiChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useAutoScroll(messages);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setLoading(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const history = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "오류가 발생했습니다." }))) as { error?: string };
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: err.error ?? "오류가 발생했습니다.", streaming: false }
              : m
          )
        );
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snap = accumulated;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: snap, streaming: true } : m
          )
        );
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: accumulated, streaming: false } : m
        )
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "응답을 받지 못했습니다. 다시 시도해주세요.", streaming: false }
            : m
        )
      );
    } finally {
      setLoading(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, loading, messages]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function handleClear() {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
    setInput("");
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 39,
            background: "transparent",
          }}
        />
      )}

      {/* Panel */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          background: "var(--ds-surface)",
          borderLeft: "1px solid var(--ds-border)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms cubic-bezier(0.4, 0, 0.2, 1)",
          willChange: "transform",
        }}
        aria-label="AI 챗봇"
        aria-hidden={!open}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--ds-sp-2)",
            padding: "var(--ds-sp-3) var(--ds-sp-4)",
            borderBottom: "1px solid var(--ds-border)",
            flexShrink: 0,
          }}
        >
          <Bot size={15} style={{ color: "var(--ds-accent)", flexShrink: 0 }} />
          <span
            style={{
              flex: 1,
              fontSize: "var(--ds-fs-13)",
              fontWeight: "var(--ds-fw-semibold)",
              color: "var(--ds-text)",
            }}
          >
            AI 어시스턴트
          </span>
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              title="대화 초기화"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: "var(--ds-r-6)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ds-text-faint)",
              }}
              className="hover:bg-fill hover:text-text-mute transition-colors duration-[var(--ds-dur-fast)]"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={onClose}
            title="닫기 (Esc)"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "var(--ds-r-6)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--ds-text-faint)",
            }}
            className="hover:bg-fill hover:text-text-mute transition-colors duration-[var(--ds-dur-fast)]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--ds-sp-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--ds-sp-4)",
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                gap: "var(--ds-sp-3)",
                textAlign: "center",
                padding: "var(--ds-sp-6)",
              }}
            >
              <Bot size={32} style={{ color: "var(--ds-text-faint)" }} />
              <div>
                <div
                  style={{
                    fontSize: "var(--ds-fs-13)",
                    fontWeight: "var(--ds-fw-medium)",
                    color: "var(--ds-text-mute)",
                    marginBottom: "var(--ds-sp-1)",
                  }}
                >
                  AI 어시스턴트
                </div>
                <div
                  style={{
                    fontSize: "var(--ds-fs-12)",
                    color: "var(--ds-text-faint)",
                    lineHeight: 1.5,
                  }}
                >
                  SQL, 데이터 분석, vibeSQL 사용법에 대해 물어보세요.
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--ds-sp-1)",
                  width: "100%",
                  marginTop: "var(--ds-sp-2)",
                }}
              >
                {[
                  "이 테이블의 중복 데이터를 찾는 SQL은?",
                  "GROUP BY와 HAVING의 차이는?",
                  "워크스페이스 사용법을 알려줘",
                ].map((hint) => (
                  <button
                    key={hint}
                    onClick={() => setInput(hint)}
                    style={{
                      padding: "var(--ds-sp-2) var(--ds-sp-3)",
                      borderRadius: "var(--ds-r-6)",
                      border: "1px solid var(--ds-border)",
                      background: "var(--ds-bg)",
                      color: "var(--ds-text-mute)",
                      fontSize: "var(--ds-fs-11)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                    className="hover:bg-fill hover:text-text transition-colors duration-[var(--ds-dur-fast)]"
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                gap: "var(--ds-sp-2)",
                flexDirection: msg.role === "user" ? "row-reverse" : "row",
                alignItems: "flex-start",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "var(--ds-r-full)",
                  background: msg.role === "user" ? "var(--ds-accent-soft)" : "var(--ds-fill)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {msg.role === "user" ? (
                  <User size={12} style={{ color: "var(--ds-accent)" }} />
                ) : (
                  <Bot size={12} style={{ color: "var(--ds-text-mute)" }} />
                )}
              </div>

              {/* Bubble */}
              <div
                style={{
                  maxWidth: "80%",
                  padding: "var(--ds-sp-2) var(--ds-sp-3)",
                  borderRadius: "var(--ds-r-8)",
                  background: msg.role === "user" ? "var(--ds-accent)" : "var(--ds-fill)",
                  color: msg.role === "user" ? "#fff" : "var(--ds-text)",
                  fontSize: "var(--ds-fs-12)",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  position: "relative",
                }}
              >
                {msg.content || (msg.streaming && (
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                ))}
                {msg.streaming && msg.content && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2,
                      height: "1em",
                      background: "currentColor",
                      marginLeft: 2,
                      animation: "blink 1s step-end infinite",
                      verticalAlign: "text-bottom",
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div
          style={{
            borderTop: "1px solid var(--ds-border)",
            padding: "var(--ds-sp-3) var(--ds-sp-4)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "var(--ds-sp-2)",
              alignItems: "flex-end",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              background: "var(--ds-bg)",
              padding: "var(--ds-sp-2) var(--ds-sp-2) var(--ds-sp-2) var(--ds-sp-3)",
              transition: "border-color var(--ds-dur-fast) var(--ds-ease)",
            }}
            className="focus-within:border-accent"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요... (Enter 전송, Shift+Enter 줄바꿈)"
              rows={1}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                color: "var(--ds-text)",
                fontSize: "var(--ds-fs-12)",
                resize: "none",
                outline: "none",
                fontFamily: "var(--ds-font-sans)",
                lineHeight: 1.5,
                maxHeight: 120,
                overflowY: "auto",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={() => void send()}
              disabled={!input.trim() || loading}
              title="전송 (Enter)"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: "var(--ds-r-6)",
                background: input.trim() && !loading ? "var(--ds-accent)" : "var(--ds-fill)",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                color: input.trim() && !loading ? "#fff" : "var(--ds-text-faint)",
                flexShrink: 0,
                transition: "background var(--ds-dur-fast) var(--ds-ease)",
              }}
            >
              {loading ? (
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Send size={13} />
              )}
            </button>
          </div>
          <div
            style={{
              fontSize: "var(--ds-fs-10)",
              color: "var(--ds-text-faint)",
              textAlign: "center",
              marginTop: "var(--ds-sp-1)",
            }}
          >
            설정된 AI 프로바이더로 응답합니다
          </div>
        </div>
      </aside>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
