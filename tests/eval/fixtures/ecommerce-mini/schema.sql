-- ecommerce-mini fixture (8 tables) for NL2SQL golden set
-- Run inside test database: docker exec ... psql -U vibesql -d vibesql_test -f schema.sql

DROP SCHEMA IF EXISTS ecommerce_mini CASCADE;
CREATE SCHEMA ecommerce_mini;
SET search_path TO ecommerce_mini;

CREATE TABLE customers (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  city         TEXT,
  signup_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_vip       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE categories (
  id     SERIAL PRIMARY KEY,
  name   TEXT NOT NULL UNIQUE,
  parent_id INT REFERENCES categories(id)
);

CREATE TABLE products (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  category_id  INT REFERENCES categories(id),
  price        NUMERIC(12,2) NOT NULL,
  stock        INT NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  customer_id  INT NOT NULL REFERENCES customers(id),
  status       TEXT NOT NULL DEFAULT 'pending',
  total        NUMERIC(14,2) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INT NOT NULL REFERENCES products(id),
  quantity     INT NOT NULL,
  unit_price   NUMERIC(12,2) NOT NULL
);

CREATE TABLE reviews (
  id           SERIAL PRIMARY KEY,
  product_id   INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id  INT NOT NULL REFERENCES customers(id),
  rating       INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shipments (
  id           SERIAL PRIMARY KEY,
  order_id     INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  shipped_at   TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE TABLE returns (
  id           SERIAL PRIMARY KEY,
  order_id     INT NOT NULL REFERENCES orders(id),
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'requested',
  refund_amount NUMERIC(12,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_oi_order ON order_items(order_id);
CREATE INDEX idx_oi_product ON order_items(product_id);
CREATE INDEX idx_reviews_product ON reviews(product_id);

-- Seed minimal data (20 customers, 30 products, 80 orders)
INSERT INTO customers (name, email, city, is_vip)
SELECT
  'Customer ' || i,
  'cust' || i || '@example.com',
  CASE WHEN i % 3 = 0 THEN 'Seoul' WHEN i % 3 = 1 THEN 'Busan' ELSE 'Incheon' END,
  i % 5 = 0
FROM generate_series(1, 20) i;

INSERT INTO categories (name) VALUES ('Electronics'), ('Clothing'), ('Books'), ('Food');

INSERT INTO products (name, category_id, price, stock)
SELECT
  'Product ' || i,
  ((i - 1) % 4) + 1,
  (random() * 90 + 10)::numeric(12,2),
  (random() * 100)::int
FROM generate_series(1, 30) i;

INSERT INTO orders (customer_id, status, total, created_at)
SELECT
  ((i - 1) % 20) + 1,
  CASE WHEN i % 5 = 0 THEN 'cancelled' WHEN i % 4 = 0 THEN 'pending' ELSE 'completed' END,
  (random() * 500 + 50)::numeric(14,2),
  now() - (random() * interval '180 days')
FROM generate_series(1, 80) i;

INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT
  ((i - 1) % 80) + 1,
  ((i - 1) % 30) + 1,
  (random() * 5 + 1)::int,
  (random() * 90 + 10)::numeric(12,2)
FROM generate_series(1, 200) i;
