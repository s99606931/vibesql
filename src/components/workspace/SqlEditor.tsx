"use client";

import dynamic from "next/dynamic";
import { sql as sqlLang } from "@codemirror/lang-sql";

const CodeMirror = dynamic(
  () => import("@uiw/react-codemirror").then((m) => m.default),
  { ssr: false, loading: () => <div style={{ height: 160, background: "var(--ds-fill)" }} /> }
);

interface SqlEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  minHeight?: number;
  maxHeight?: number;
}

export function SqlEditor({
  value,
  onChange,
  readOnly = false,
  minHeight = 120,
  maxHeight = 280,
}: SqlEditorProps) {
  return (
    <div
      style={{
        fontFamily: "var(--ds-font-mono)",
        fontSize: "var(--ds-fs-13)",
        lineHeight: 1.55,
        minHeight,
        maxHeight,
        overflow: "auto",
      }}
    >
      <CodeMirror
        value={value}
        extensions={[sqlLang()]}
        onChange={onChange}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightActiveLine: true,
        }}
        style={{
          background: "transparent",
          minHeight,
          maxHeight,
          overflow: "auto",
        }}
        theme="none"
      />
    </div>
  );
}
