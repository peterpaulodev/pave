-- AlterTable
ALTER TABLE "budget_cycles" ADD COLUMN     "recurring_applied_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "recurring_expense_id" UUID;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "last_reminder_sent_on" DATE,
ADD COLUMN     "reminder_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminder_hour" INTEGER NOT NULL DEFAULT 20;

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "bucket" "bucket" NOT NULL,
    "day_of_month" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_checkins" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_expenses_user_id_active_idx" ON "recurring_expenses"("user_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_checkins_user_id_date_key" ON "daily_checkins"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_recurring_expense_id_cycle_id_key" ON "expenses"("recurring_expense_id", "cycle_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_expense_id_fkey" FOREIGN KEY ("recurring_expense_id") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CheckConstraint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_amount_positive" CHECK ("amount_cents" > 0);

-- CheckConstraint
ALTER TABLE "recurring_expenses" ADD CONSTRAINT "recurring_day_range" CHECK ("day_of_month" BETWEEN 1 AND 31);

-- CheckConstraint
ALTER TABLE "user_settings" ADD CONSTRAINT "reminder_hour_range" CHECK ("reminder_hour" BETWEEN 0 AND 23);

-- Não aplicar contas fixas retroativamente em ciclos que já existem
UPDATE "budget_cycles" SET "recurring_applied_at" = now() WHERE "recurring_applied_at" IS NULL;
