import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, budgetsTable, categoriesTable, transactionsTable } from "@workspace/db";
import {
  ListBudgetsQueryParams,
  ListBudgetsResponse,
  CreateBudgetBody,
  UpdateBudgetParams,
  UpdateBudgetBody,
  UpdateBudgetResponse,
  DeleteBudgetParams,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/budgets", async (req, res): Promise<void> => {
  const query = ListBudgetsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const month = query.data.month ?? new Date().toISOString().slice(0, 7);

  const budgets = await db
    .select({
      id: budgetsTable.id,
      categoryId: budgetsTable.categoryId,
      amount: budgetsTable.amount,
      month: budgetsTable.month,
      createdAt: budgetsTable.createdAt,
      categoryName: categoriesTable.name,
      categoryIcon: categoriesTable.icon,
      categoryColor: categoriesTable.color,
    })
    .from(budgetsTable)
    .leftJoin(categoriesTable, eq(budgetsTable.categoryId, categoriesTable.id))
    .where(eq(budgetsTable.month, month));

  const result = await Promise.all(
    budgets.map(async (budget) => {
      const [spendingRow] = await db
        .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.categoryId, budget.categoryId),
            eq(transactionsTable.type, "expense"),
            sql`${transactionsTable.date} like ${month + "-%"}`
          )
        );

      const spent = Number(spendingRow?.total ?? 0);
      return {
        ...serializeDates(budget),
        spent,
        remaining: budget.amount - spent,
        categoryName: budget.categoryName ?? "",
        categoryIcon: budget.categoryIcon ?? "",
        categoryColor: budget.categoryColor ?? "",
      };
    })
  );

  res.json(ListBudgetsResponse.parse(result));
});

router.post("/budgets", async (req, res): Promise<void> => {
  const parsed = CreateBudgetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [budget] = await db.insert(budgetsTable).values(parsed.data).returning();
  res.status(201).json(serializeDates(budget));
});

router.patch("/budgets/:id", async (req, res): Promise<void> => {
  const params = UpdateBudgetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateBudgetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [budget] = await db.update(budgetsTable).set(parsed.data).where(eq(budgetsTable.id, params.data.id)).returning();
  if (!budget) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }
  res.json(UpdateBudgetResponse.parse(serializeDates(budget)));
});

router.delete("/budgets/:id", async (req, res): Promise<void> => {
  const params = DeleteBudgetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [budget] = await db.delete(budgetsTable).where(eq(budgetsTable.id, params.data.id)).returning();
  if (!budget) {
    res.status(404).json({ error: "Budget not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
