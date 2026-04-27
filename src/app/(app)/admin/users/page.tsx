"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopBar } from "@/components/shell/TopBar";
import { Button } from "@/components/ui-vs/Button";
import { Crown, ShieldCheck, User, Trash2, AlertTriangle, Search, Download } from "lucide-react";
import type { UserRole } from "@/lib/auth/jwt";

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay === 0) return "오늘";
  if (diffDay === 1) return "어제";
  if (diffDay < 30) return `${diffDay}일 전`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}개월 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "var(--ds-r-full)",
        fontSize: "var(--ds-fs-11)",
        fontWeight: "var(--ds-fw-medium)",
        background: role === "ADMIN" ? "var(--ds-accent-soft)" : "var(--ds-fill)",
        color: role === "ADMIN" ? "var(--ds-accent)" : "var(--ds-text-mute)",
      }}
    >
      {role === "ADMIN" ? <Crown size={10} /> : <User size={10} />}
      {role === "ADMIN" ? "관리자" : "사용자"}
    </span>
  );
}

function exportUsersCsv(users: UserRow[]) {
  const headers = ["이름", "이메일", "역할", "가입일"];
  const esc = (v: string) => (v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = users.map((u) => [
    u.name ?? "", u.email, u.role, new Date(u.createdAt).toLocaleString("ko-KR"),
  ].map(esc).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [confirmRole, setConfirmRole] = useState<{ user: UserRow; nextRole: UserRole } | null>(null);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data, isLoading, error } = useQuery<UserRow[]>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("권한이 없습니다.");
      const json = await res.json() as { data: UserRow[] };
      return json.data;
    },
  });

  const roleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const j = await res.json() as { error: string };
        throw new Error(j.error);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json() as { error: string };
        throw new Error(j.error);
      }
    },
    onSuccess: () => {
      setConfirmDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TopBar
        title="사용자 관리"
        breadcrumbs={[{ label: "vibeSQL" }, { label: "관리자" }, { label: "사용자 관리" }]}
        actions={
          data && data.length > 0 ? (
            <Button variant="ghost" size="sm" icon={<Download size={13} />} onClick={() => exportUsersCsv(data)}>
              CSV
            </Button>
          ) : undefined
        }
      />

      <div style={{ flex: 1, overflow: "auto", padding: "var(--ds-sp-6)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)", marginBottom: "var(--ds-sp-4)" }}>
          <ShieldCheck size={18} style={{ color: "var(--ds-warn)" }} />
          <h2 style={{ fontSize: "var(--ds-fs-16)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", margin: 0 }}>
            사용자 목록
          </h2>
          {data && (
            <span style={{
              padding: "2px 8px", borderRadius: "var(--ds-r-full)",
              background: "var(--ds-fill)", fontSize: "var(--ds-fs-11)", color: "var(--ds-text-mute)",
            }}>
              {data.length}명
            </span>
          )}
        </div>
        <div style={{ position: "relative", maxWidth: 300, marginBottom: "var(--ds-sp-4)" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ds-text-faint)", pointerEvents: "none" }} />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일 검색... (⌘F)"
            style={{ width: "100%", paddingLeft: 32, paddingRight: "var(--ds-sp-3)", paddingTop: "var(--ds-sp-2)", paddingBottom: "var(--ds-sp-2)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", background: "var(--ds-surface)", color: "var(--ds-text)", fontSize: "var(--ds-fs-12)", outline: "none", fontFamily: "var(--ds-font-sans)", boxSizing: "border-box" }}
          />
        </div>

        {isLoading && (
          <div style={{ padding: "var(--ds-sp-8)", textAlign: "center", color: "var(--ds-text-mute)" }}>
            불러오는 중...
          </div>
        )}

        {error && (
          <div style={{
            display: "flex", alignItems: "center", gap: "var(--ds-sp-2)",
            padding: "var(--ds-sp-4)", borderRadius: "var(--ds-r-8)",
            background: "var(--ds-danger-soft)",
            color: "var(--ds-danger)",
          }}>
            <AlertTriangle size={16} />
            {error instanceof Error ? error.message : "오류가 발생했습니다."}
          </div>
        )}

        {data && (
          <div
            style={{
              background: "var(--ds-surface)",
              border: "1px solid var(--ds-border)",
              borderRadius: "var(--ds-r-8)",
              overflow: "hidden",
            }}
          >
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 140px 120px 60px",
                gap: "var(--ds-sp-3)",
                padding: "var(--ds-sp-3) var(--ds-sp-4)",
                borderBottom: "1px solid var(--ds-border)",
                background: "var(--ds-surface-2)",
                fontSize: "var(--ds-fs-11)",
                fontWeight: "var(--ds-fw-semibold)",
                color: "var(--ds-text-mute)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <div>이름</div>
              <div>이메일</div>
              <div>역할</div>
              <div>가입일</div>
              <div />
            </div>

            {data.filter((u) =>
              !search ||
              (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
              u.email.toLowerCase().includes(search.toLowerCase())
            ).length === 0 && (
              <div style={{ padding: "var(--ds-sp-8)", textAlign: "center", color: "var(--ds-text-faint)" }}>
                {search ? "검색 결과가 없습니다." : "사용자가 없습니다."}
              </div>
            )}

            {data.filter((u) =>
              !search ||
              (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
              u.email.toLowerCase().includes(search.toLowerCase())
            ).map((user, idx, filtered) => (
              <div
                key={user.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 140px 120px 60px",
                  gap: "var(--ds-sp-3)",
                  padding: "var(--ds-sp-3) var(--ds-sp-4)",
                  borderBottom: idx < filtered.length - 1 ? "1px solid var(--ds-border)" : "none",
                  alignItems: "center",
                  fontSize: "var(--ds-fs-13)",
                }}
              >
                {/* Name */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--ds-sp-2)" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "var(--ds-r-full)",
                    background: user.role === "ADMIN" ? "var(--ds-accent-soft)" : "var(--ds-fill)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "var(--ds-fs-11)", fontWeight: "var(--ds-fw-semibold)",
                    color: user.role === "ADMIN" ? "var(--ds-accent)" : "var(--ds-text-mute)",
                    flexShrink: 0,
                  }}>
                    {user.role === "ADMIN" ? <Crown size={12} /> : (user.name ?? user.email).charAt(0).toUpperCase()}
                  </div>
                  <span style={{ color: "var(--ds-text)", fontWeight: "var(--ds-fw-medium)" }}>
                    {user.name ?? "(이름 없음)"}
                  </span>
                </div>

                {/* Email */}
                <div style={{ color: "var(--ds-text-mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>

                {/* Role toggle */}
                <div>
                  <RoleBadge role={user.role} />
                </div>

                {/* Joined */}
                <div
                  title={new Date(user.createdAt).toLocaleDateString("ko-KR")}
                  style={{ color: "var(--ds-text-faint)", fontSize: "var(--ds-fs-12)" }}
                >
                  {formatRelativeDate(user.createdAt)}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    title={user.role === "ADMIN" ? "사용자로 변경" : "관리자로 변경"}
                    disabled={roleMutation.isPending}
                    onClick={() => setConfirmRole({ user, nextRole: user.role === "ADMIN" ? "USER" : "ADMIN" })}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 26, height: 26, borderRadius: "var(--ds-r-6)",
                      background: "transparent", border: "1px solid var(--ds-border)",
                      cursor: "pointer", color: "var(--ds-text-mute)",
                    }}
                  >
                    <ShieldCheck size={12} />
                  </button>
                  <button
                    title="삭제"
                    disabled={deleteMutation.isPending}
                    onClick={() => setConfirmDelete(user)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center",
                      width: 26, height: 26, borderRadius: "var(--ds-r-6)",
                      background: "transparent", border: "1px solid var(--ds-border)",
                      cursor: "pointer", color: "var(--ds-text-mute)",
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role change confirm dialog */}
      {confirmRole && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirmRole(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setConfirmRole(null); }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-10)", padding: "var(--ds-sp-6)", maxWidth: 400, width: "100%" }}>
            <h3 style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", margin: "0 0 var(--ds-sp-2)" }}>
              역할 변경
            </h3>
            <p style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", margin: "0 0 var(--ds-sp-1)" }}>
              <strong style={{ color: "var(--ds-text)" }}>{confirmRole.user.name ?? confirmRole.user.email}</strong>
            </p>
            <p style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", margin: "0 0 var(--ds-sp-4)" }}>
              {confirmRole.user.email} 계정을{" "}
              <strong style={{ color: confirmRole.nextRole === "ADMIN" ? "var(--ds-accent)" : "var(--ds-text-mute)" }}>
                {confirmRole.nextRole === "ADMIN" ? "관리자" : "일반 사용자"}
              </strong>로 변경하시겠습니까?
            </p>
            <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmRole(null)} style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)" }}>취소</button>
              <button
                onClick={() => { roleMutation.mutate({ id: confirmRole.user.id, role: confirmRole.nextRole }); setConfirmRole(null); }}
                disabled={roleMutation.isPending}
                style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-accent)", border: "none", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-accent-on)", fontWeight: "var(--ds-fw-medium)", fontFamily: "var(--ds-font-sans)" }}
              >
                변경
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirmDelete(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setConfirmDelete(null); }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--ds-surface)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-10)", padding: "var(--ds-sp-6)", maxWidth: 380, width: "100%" }}>
            <h3 style={{ fontSize: "var(--ds-fs-15)", fontWeight: "var(--ds-fw-semibold)", color: "var(--ds-text)", margin: "0 0 var(--ds-sp-2)" }}>
              사용자 삭제
            </h3>
            <p style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", margin: "0 0 var(--ds-sp-1)" }}>
              <strong style={{ color: "var(--ds-text)" }}>{confirmDelete.name ?? confirmDelete.email}</strong>
            </p>
            <p style={{ fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", margin: "0 0 var(--ds-sp-4)" }}>
              {confirmDelete.email} 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: "var(--ds-sp-2)", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-fill)", border: "1px solid var(--ds-border)", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-text-mute)", fontFamily: "var(--ds-font-sans)" }}>취소</button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                style={{ padding: "var(--ds-sp-2) var(--ds-sp-4)", background: "var(--ds-danger)", border: "none", borderRadius: "var(--ds-r-6)", cursor: "pointer", fontSize: "var(--ds-fs-13)", color: "var(--ds-bg)", fontWeight: "var(--ds-fw-medium)", fontFamily: "var(--ds-font-sans)" }}
              >
                {deleteMutation.isPending ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
