-- Salidas de caja en efectivo (gastos LOCAL ya existentes) y snapshot en el cierre.
ALTER TABLE "Expense" ADD COLUMN "paidWithCash" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Expense_origin_paidWithCash_spentAt_idx" ON "Expense"("origin", "paidWithCash", "spentAt");

ALTER TABLE "CashClosing" ADD COLUMN "cashOutTotal" INTEGER;
