-- pgvector init for NL2SQL M1
-- Run: docker exec vibesql-postgres-1 psql -U vibesql -d vibesql -f /path/to/migration.sql

-- 1) Extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2) Vector columns on table_cards (256 dim — qwen3-embedding-0.6b on LM Studio, Matryoshka-truncated)
ALTER TABLE table_cards
  ADD COLUMN IF NOT EXISTS embedding vector(256);

CREATE INDEX IF NOT EXISTS idx_table_cards_embedding_hnsw
  ON table_cards USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 3) Vector columns on column_cards (192 dim — nomic-embed-text-v1.5 on LM Studio)
ALTER TABLE column_cards
  ADD COLUMN IF NOT EXISTS embedding vector(192);

CREATE INDEX IF NOT EXISTS idx_column_cards_embedding_hnsw
  ON column_cards USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4) FTS support for hybrid search (M2 prep)
ALTER TABLE table_cards
  ADD COLUMN IF NOT EXISTS content_tsv tsvector;
ALTER TABLE column_cards
  ADD COLUMN IF NOT EXISTS content_tsv tsvector;

CREATE INDEX IF NOT EXISTS idx_table_cards_tsv
  ON table_cards USING gin (content_tsv);
CREATE INDEX IF NOT EXISTS idx_column_cards_tsv
  ON column_cards USING gin (content_tsv);

-- 5) Trigger to auto-update content_tsv
CREATE OR REPLACE FUNCTION update_table_card_tsv() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.table_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.columns_summary, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_table_card_tsv ON table_cards;
CREATE TRIGGER trg_table_card_tsv
  BEFORE INSERT OR UPDATE ON table_cards
  FOR EACH ROW EXECUTE FUNCTION update_table_card_tsv();

CREATE OR REPLACE FUNCTION update_column_card_tsv() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv :=
    setweight(to_tsvector('simple', coalesce(NEW.column_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.data_type, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_column_card_tsv ON column_cards;
CREATE TRIGGER trg_column_card_tsv
  BEFORE INSERT OR UPDATE ON column_cards
  FOR EACH ROW EXECUTE FUNCTION update_column_card_tsv();
