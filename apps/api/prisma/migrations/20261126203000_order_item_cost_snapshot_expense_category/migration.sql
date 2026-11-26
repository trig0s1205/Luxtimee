-- Costo unitario al momento de la venta. Nulo en filas históricas (no se rellena).
ALTER TABLE "OrderItem" ADD COLUMN "unitCostSnapshot" INTEGER;

-- Categoría opcional del gasto (por ejemplo NOMINA). Nula en gastos existentes.
ALTER TABLE "Expense" ADD COLUMN "category" TEXT;
