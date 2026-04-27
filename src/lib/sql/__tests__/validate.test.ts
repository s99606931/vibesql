import { describe, it, expect } from "vitest";
import { validateSql, normalizeSqlForCompare, buildCatalog } from "../validate";

const catalog = buildCatalog({
  customers: ["id", "name", "email", "city", "is_vip", "signup_at"],
  orders: ["id", "customer_id", "status", "total", "created_at"],
  products: ["id", "name", "category_id", "price", "stock"],
});

describe("validateSql", () => {
  it("accepts a basic SELECT", () => {
    const r = validateSql("SELECT id, name FROM customers WHERE is_vip = true", "postgresql", catalog);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.tables).toContain("customers");
  });

  it("rejects DML — INSERT", () => {
    const r = validateSql("INSERT INTO customers (name) VALUES ('a')", "postgresql", catalog);
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe("NOT_SELECT");
  });

  it("rejects DML — UPDATE", () => {
    const r = validateSql("UPDATE customers SET name='x' WHERE id=1", "postgresql", catalog);
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe("NOT_SELECT");
  });

  it("rejects DML — DELETE", () => {
    const r = validateSql("DELETE FROM customers WHERE id=1", "postgresql", catalog);
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe("NOT_SELECT");
  });

  it("flags unknown table", () => {
    const r = validateSql("SELECT * FROM secret_table", "postgresql", catalog);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === "UNKNOWN_TABLE")).toBe(true);
  });

  it("flags unknown column", () => {
    const r = validateSql("SELECT customers.nonexistent FROM customers", "postgresql", catalog);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === "UNKNOWN_COLUMN")).toBe(true);
  });

  it("accepts valid join", () => {
    const r = validateSql(
      "SELECT c.name, o.total FROM customers c JOIN orders o ON o.customer_id = c.id WHERE c.is_vip = true",
      "postgresql",
      catalog,
    );
    expect(r.valid).toBe(true);
  });

  it("rejects empty SQL", () => {
    const r = validateSql("", "postgresql", catalog);
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe("EMPTY");
  });

  it("rejects multiple statements", () => {
    const r = validateSql(
      "SELECT 1; SELECT 2",
      "postgresql",
      catalog,
    );
    // node-sql-parser may parse multi-statement as array; we check we get one of these errors
    expect(r.valid).toBe(false);
  });

  it("accepts aggregation", () => {
    const r = validateSql(
      "SELECT city, COUNT(*) FROM customers GROUP BY city",
      "postgresql",
      catalog,
    );
    expect(r.valid).toBe(true);
  });

  it("validation works without catalog (skip whitelist)", () => {
    const r = validateSql("SELECT * FROM unknown_table", "postgresql");
    expect(r.valid).toBe(true);
  });
});

describe("normalizeSqlForCompare", () => {
  it("normalizes whitespace and case", () => {
    const a = normalizeSqlForCompare("SELECT id  FROM customers");
    const b = normalizeSqlForCompare("select id from customers");
    expect(a).toBe(b);
  });

  it("returns null on parse failure", () => {
    const r = normalizeSqlForCompare("not a valid sql at all !!!");
    expect(r).toBeNull();
  });
});
