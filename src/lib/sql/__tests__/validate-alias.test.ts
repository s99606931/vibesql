import { describe, it, expect } from "vitest";
import { validateSql, buildCatalog } from "../validate";

const catalog = buildCatalog({
  customers: ["id", "name", "email", "city", "is_vip", "signup_at"],
  orders: ["id", "customer_id", "status", "total", "created_at"],
  products: ["id", "name", "category_id", "price", "stock"],
  order_items: ["id", "order_id", "product_id", "quantity", "unit_price"],
});

describe("validateSql — SELECT alias and CTE handling", () => {
  it("accepts COUNT(*) AS order_count + ORDER BY order_count", () => {
    const r = validateSql(
      "SELECT c.id, c.name, COUNT(o.id) AS order_count FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id, c.name ORDER BY order_count DESC LIMIT 5",
      "postgresql",
      catalog,
    );
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("accepts SUM(total) AS total_sales + HAVING total_sales > 100", () => {
    const r = validateSql(
      "SELECT customer_id, SUM(total) AS total_sales FROM orders GROUP BY customer_id HAVING SUM(total) > 100 ORDER BY total_sales DESC",
      "postgresql",
      catalog,
    );
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("accepts CTE — WITH monthly AS (...) SELECT ... FROM monthly", () => {
    const r = validateSql(
      "WITH monthly AS (SELECT date_trunc('month', created_at) AS m, COUNT(*) AS cnt FROM orders GROUP BY 1) SELECT m, cnt FROM monthly ORDER BY m",
      "postgresql",
      catalog,
    );
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("accepts MIN(...) AS first_order with GROUP BY", () => {
    const r = validateSql(
      "SELECT c.id, c.name, MIN(o.created_at) AS first_order FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id, c.name",
      "postgresql",
      catalog,
    );
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("still rejects truly unknown column", () => {
    const r = validateSql(
      "SELECT customers.nonexistent_column FROM customers",
      "postgresql",
      catalog,
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === "UNKNOWN_COLUMN")).toBe(true);
  });
});
