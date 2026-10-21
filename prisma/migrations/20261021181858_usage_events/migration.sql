-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "props" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_name_created_at_idx" ON "events"("name", "created_at");

-- CreateIndex
CREATE INDEX "events_user_id_created_at_idx" ON "events"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: usuários que já concluíram o onboarding antes desta migration
-- entram na métrica de conclusão (design.md, Open Questions). Usa
-- onboarded_at como data do evento; props vazio (sem dados do usuário).
INSERT INTO "events" ("id", "user_id", "name", "props", "created_at")
SELECT gen_random_uuid(), "user_id", 'onboarding_completed', '{}'::jsonb, "onboarded_at"
  FROM "user_settings"
 WHERE "onboarded_at" IS NOT NULL;
