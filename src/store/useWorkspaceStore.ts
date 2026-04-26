import { create } from "zustand";

type Row = Record<string, unknown>;
type WorkspaceStatus = "idle" | "generating" | "ready" | "running" | "success" | "error";

interface WorkspaceState {
  status: WorkspaceStatus;
  nlQuery: string;
  sql: string;
  results: Row[] | null;
  rowCount: number;
  duration: number | null;
  errorMessage: string | null;
  activeConnectionId: string | null;
  setNlQuery: (q: string) => void;
  setSql: (sql: string) => void;
  setStatus: (s: WorkspaceStatus) => void;
  setResults: (rows: Row[], count: number, duration: number) => void;
  setError: (msg: string) => void;
  reset: () => void;
  setActiveConnection: (id: string | null) => void;
}

const initialState = {
  status: "idle" as WorkspaceStatus,
  nlQuery: "",
  sql: "",
  results: null,
  rowCount: 0,
  duration: null,
  errorMessage: null,
  activeConnectionId: null,
};

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  ...initialState,

  setNlQuery: (q) => set({ nlQuery: q }),

  setSql: (sql) => set({ sql }),

  setStatus: (s) => set({ status: s }),

  setResults: (rows, count, duration) =>
    set({ results: rows, rowCount: count, duration, status: "success", errorMessage: null }),

  setError: (msg) =>
    set({ status: "error", errorMessage: msg, results: null }),

  reset: () => set(initialState),

  setActiveConnection: (id) => set({ activeConnectionId: id }),
}));
