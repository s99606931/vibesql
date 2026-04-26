import { NextResponse } from "next/server";
import { getConnection } from "@/lib/connections/store";

interface TableMeta {
  name: string;
  rows: string;
  columns: number;
  description: string;
  cols: string[];
  fks: string[];
  pii: boolean;
}

const mockTables: TableMeta[] = [
  {
    name: "orders",
    rows: "8.4M",
    columns: 18,
    description: "주문 트랜잭션 테이블.",
    cols: ["id", "user_id", "status", "amount", "created_at", "updated_at"],
    fks: ["customers", "products"],
    pii: true,
  },
  {
    name: "customers",
    rows: "1.2M",
    columns: 12,
    description: "고객 계정 정보.",
    cols: ["id", "email", "name", "country", "plan", "created_at"],
    fks: [],
    pii: true,
  },
  {
    name: "products",
    rows: "4,832",
    columns: 9,
    description: "상품 카탈로그.",
    cols: ["id", "name", "category", "price", "stock", "active"],
    fks: [],
    pii: false,
  },
  {
    name: "payments",
    rows: "9.1M",
    columns: 14,
    description: "결제 처리 이력.",
    cols: ["id", "order_id", "method", "status", "amount", "processed_at"],
    fks: ["orders"],
    pii: true,
  },
  {
    name: "audit_logs",
    rows: "22.3M",
    columns: 7,
    description: "쿼리 실행 감사 로그.",
    cols: ["id", "user_id", "query", "rows_affected", "duration_ms", "created_at"],
    fks: ["customers"],
    pii: false,
  },
  {
    name: "glossary_terms",
    rows: "143",
    columns: 6,
    description: "회사 용어 사전.",
    cols: ["id", "term", "definition", "mapped_columns", "category", "created_by"],
    fks: [],
    pii: false,
  },
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("connectionId");

  if (connectionId) {
    const conn = getConnection(connectionId);
    if (conn && conn.type === "postgresql") {
      // Real scan would go here — fall through to mock for now
    }
  }

  return NextResponse.json({ data: mockTables });
}
