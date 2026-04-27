"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Send, Bot, User, Loader2, Trash2, Zap, Copy, Check } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatContext } from "@/app/api/chat/route";

export type { ChatContext };

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface AiChatPanelProps {
  open: boolean;
  onClose: () => void;
  width?: number;
  onWidthChange?: (w: number) => void;
  minWidth?: number;
  maxWidth?: number;
  context?: ChatContext;
  onApplySql?: (sql: string) => void;
}

function makeMdComponents(onApplySql?: (sql: string) => void): Components {
  return {
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    ),
    code({ className, children, ...props }) {
      const isBlock = "node" in props;
      const lang = (className ?? "").replace("language-", "").toLowerCase();
      const isSql = lang === "sql" || lang === "postgresql" || lang === "mysql" || lang === "sqlite";
      const codeText = String(children).replace(/\n$/, "");

      if (!isBlock) {
        return <code className={className} {...props}>{children}</code>;
      }

      return (
        <SqlBlock
          code={codeText}
          lang={lang || "sql"}
          isSql={isSql}
          onApply={isSql ? onApplySql : undefined}
        />
      );
    },
  };
}

function SqlBlock({ code, lang, isSql, onApply }: { code: string; lang: string; isSql: boolean; onApply?: (sql: string) => void }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div style={{ position: "relative", margin: "0.5em 0" }}>
      <pre style={{
        background: "var(--ds-surface)", border: "1px solid var(--ds-border)",
        borderRadius: "var(--ds-r-8)", padding: "var(--ds-sp-3)",
        overflow: "auto", marginTop: 0,
        paddingTop: isSql && onApply ? "var(--ds-sp-5)" : "var(--ds-sp-3)",
      }}>
        <code style={{ fontFamily: "var(--ds-font-mono)", fontSize: "var(--ds-fs-11)", lineHeight: 1.6 }}>
          {code}
        </code>
      </pre>
      {/* Action bar */}
      <div style={{
        position: "absolute", top: 6, right: 6,
        display: "flex", gap: 4,
      }}>
        <button
          onClick={handleCopy}
          title="복사"
          style={{
            display: "flex", alignItems: "center", gap: 3,
            padding: "2px 6px", borderRadius: "var(--ds-r-6)",
            border: "1px solid var(--ds-border)", background: "var(--ds-surface-2, var(--ds-fill))",
            cursor: "pointer", fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)",
          }}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          <span>{copied ? "복사됨" : "복사"}</span>
        </button>
        {isSql && onApply && (
          <button
            onClick={() => onApply(code)}
            title="워크스페이스에 적용"
            style={{
              display: "flex", alignItems: "center", gap: 3,
              padding: "2px 6px", borderRadius: "var(--ds-r-6)",
              border: "1px solid var(--ds-accent)", background: "var(--ds-accent-soft)",
              cursor: "pointer", fontSize: "var(--ds-fs-10)", color: "var(--ds-accent)",
              fontWeight: "var(--ds-fw-medium)",
            }}
          >
            <Zap size={10} />
            <span>적용</span>
          </button>
        )}
      </div>
      {isSql && (
        <div style={{
          position: "absolute", top: 6, left: 8,
          fontSize: "var(--ds-fs-10)", color: "var(--ds-text-faint)",
          fontFamily: "var(--ds-font-mono)",
        }}>
          {lang}
        </div>
      )}
    </div>
  );
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

export function AiChatPanel({
  open,
  onClose,
  width = 380,
  onWidthChange,
  minWidth = 280,
  maxWidth = 720,
  context,
  onApplySql,
}: AiChatPanelProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useAutoScroll(messages);

  const mdComponents = makeMdComponents((sql) => {
    onApplySql?.(sql);
    router.push("/workspace");
  });

  // Abort in-flight request when panel closes or component unmounts
  useEffect(() => {
    if (!open) abortRef.current?.abort();
    return () => {
      abortRef.current?.abort();
      if (focusTimerRef.current !== null) clearTimeout(focusTimerRef.current);
    };
  }, [open]);

  // Drag-to-resize logic
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startW = width;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      const newW = Math.min(maxWidth, Math.max(minWidth, startW + delta));
      onWidthChange?.(newW);
    };
    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [width, minWidth, maxWidth, onWidthChange]);

  useEffect(() => {
    if (open) {
      focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 150);
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
        body: JSON.stringify({ messages: history, context }),
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

      if (!res.body) throw new Error("스트림 응답을 받지 못했습니다.");

      const reader = res.body.getReader();
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
      if ((err as Error).name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        );
        return;
      }
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
      focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 50);
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
      {/* No backdrop — main content shifts instead of overlapping */}

      {/* Panel */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          background: "var(--ds-surface)",
          borderLeft: "1px solid var(--ds-border)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: isResizing ? "none" : "transform 220ms cubic-bezier(0.4, 0, 0.2, 1), width 0ms",
          willChange: "transform",
          userSelect: isResizing ? "none" : "auto",
        }}
        aria-label="AI 챗봇"
        aria-hidden={!open}
      >
        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          title="드래그하여 너비 조절"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: 4,
            cursor: "col-resize",
            zIndex: 10,
            background: isResizing ? "var(--ds-accent)" : "transparent",
            transition: "background 0.15s",
          }}
          className="hover:bg-accent-soft"
        />
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
          {/* Context badge */}
          {(context?.sql || context?.schemaSnippet || context?.connectionName) && (
            <div
              title={[
                context.connectionName && `연결: ${context.connectionName}`,
                context.dialect && `방언: ${context.dialect}`,
                context.sql ? "SQL 컨텍스트 활성" : "",
                context.schemaSnippet ? "스키마 활성" : "",
              ].filter(Boolean).join(" | ")}
              style={{
                display: "flex", alignItems: "center", gap: 3,
                padding: "2px 7px", borderRadius: "var(--ds-r-full)",
                background: "var(--ds-accent-soft)", border: "1px solid var(--ds-accent)",
                fontSize: "var(--ds-fs-10)", color: "var(--ds-accent)",
                cursor: "default", flexShrink: 0,
              }}
            >
              <Zap size={9} />
              <span>컨텍스트</span>
            </div>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              title="대화 초기화"
              aria-label="대화 초기화"
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
            aria-label="닫기"
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
                  ...(context?.sql
                    ? [`현재 SQL을 최적화해줘`, `이 쿼리를 ${context.dialect ?? "SQL"}로 설명해줘`]
                    : []),
                  ...(context?.schemaSnippet
                    ? ["스키마 기반으로 유용한 쿼리를 추천해줘"]
                    : []),
                  ...(context?.nlQuery
                    ? [`"${context.nlQuery}" 관련 다른 방법을 알려줘`]
                    : []),
                  "이 테이블의 중복 데이터를 찾는 SQL은?",
                  "GROUP BY와 HAVING의 차이는?",
                  "워크스페이스 사용법을 알려줘",
                ].slice(0, 4).map((hint) => (
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
                  color: msg.role === "user" ? "var(--ds-text-on-accent)" : "var(--ds-text)",
                  fontSize: "var(--ds-fs-12)",
                  lineHeight: 1.6,
                  wordBreak: "break-word",
                  position: "relative",
                }}
                className={msg.role === "assistant" ? "ai-bubble" : undefined}
              >
                {!msg.content && msg.streaming ? (
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                ) : msg.role === "assistant" ? (
                  <>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={mdComponents}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    {msg.streaming && (
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
                  </>
                ) : (
                  <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
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
              maxLength={8000}
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
              aria-label="전송"
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
                color: input.trim() && !loading ? "var(--ds-text-on-accent)" : "var(--ds-text-faint)",
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
        .ai-bubble p { margin: 0 0 0.5em; }
        .ai-bubble p:last-child { margin-bottom: 0; }
        .ai-bubble h1, .ai-bubble h2, .ai-bubble h3 {
          font-size: var(--ds-fs-13);
          font-weight: var(--ds-fw-semibold);
          margin: 0.75em 0 0.25em;
          color: var(--ds-text);
        }
        .ai-bubble h1:first-child, .ai-bubble h2:first-child, .ai-bubble h3:first-child { margin-top: 0; }
        .ai-bubble ul, .ai-bubble ol {
          margin: 0.25em 0 0.5em;
          padding-left: 1.25em;
        }
        .ai-bubble li { margin-bottom: 0.15em; }
        .ai-bubble code {
          font-family: var(--ds-font-mono);
          font-size: var(--ds-fs-11);
          background: var(--ds-surface);
          border: 1px solid var(--ds-border);
          border-radius: var(--ds-r-6);
          padding: 1px 5px;
        }
        .ai-bubble pre {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border);
          border-radius: var(--ds-r-8);
          padding: var(--ds-sp-3);
          overflow-x: auto;
          margin: 0.5em 0;
        }
        .ai-bubble pre code {
          background: none;
          border: none;
          padding: 0;
          font-size: var(--ds-fs-11);
          line-height: 1.6;
        }
        .ai-bubble blockquote {
          border-left: 3px solid var(--ds-accent);
          margin: 0.5em 0;
          padding: 0 var(--ds-sp-3);
          color: var(--ds-text-mute);
          font-style: italic;
        }
        .ai-bubble hr {
          border: none;
          border-top: 1px solid var(--ds-border);
          margin: 0.5em 0;
        }
        .ai-bubble table {
          border-collapse: collapse;
          width: 100%;
          font-size: var(--ds-fs-11);
          margin: 0.5em 0;
        }
        .ai-bubble th, .ai-bubble td {
          border: 1px solid var(--ds-border);
          padding: 4px 8px;
          text-align: left;
        }
        .ai-bubble th { background: var(--ds-surface); font-weight: var(--ds-fw-semibold); }
        .ai-bubble strong { font-weight: var(--ds-fw-semibold); color: var(--ds-text); }
        .ai-bubble a { color: var(--ds-accent); text-decoration: underline; }
      `}</style>
    </>
  );
}
