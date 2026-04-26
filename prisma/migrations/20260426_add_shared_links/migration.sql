CREATE TABLE "shared_links" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT,
  "sql" TEXT,
  "nl_query" TEXT,
  "dialect" TEXT NOT NULL DEFAULT 'postgresql',
  "title" TEXT,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "user_id" TEXT NOT NULL,
  CONSTRAINT "shared_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "shared_links_token_key" ON "shared_links"("token");
ALTER TABLE "shared_links" ADD CONSTRAINT "shared_links_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
