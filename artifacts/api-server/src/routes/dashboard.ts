import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, accountsTable, transactionsTable, categoriesTable, budgetsTable } from "@workspace/db";
import {
  GetDashboardSummaryQueryParams,
  GetDashboardSummaryResponse,
  GetSpendingByCategoryQueryParams,
  GetSpendingByCategoryResponse,
  GetMonthlyTrendResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const query = GetDashboardSummaryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const month = query.data.month ?? new Date().toISOString().slice(0, 7);

  const [balanceRow] = await db
    .select({ total: sql<number>`coalesce(sum(${accountsTable.balance}), 0)` })
    .from(accountsTable);

  const [incomeRow] = await db
    .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "income"),
        sql`${transactionsTable.date} like ${month + "-%"}`
      )
    );

  const [expenseRow] = await db
    .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
    .from(transactionsTable)
    .where(
      and(
        eq(transactionsTable.type, "expense"),
        sql`${transactionsTable.date} like ${month + "-%"}`
      )
    );

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactionsTable)
    .where(sql`${transactionsTable.date} like ${month + "-%"}`);

  const [budgetRow] = await db
    .select({ total: sql<number>`coalesce(sum(${budgetsTable.amount}), 0)` })
    .from(budgetsTable)
    .where(eq(budgetsTable.month, month));

  const totalBalance = balanceRow?.total ?? 0;
  const monthlyIncome = incomeRow?.total ?? 0;
  const monthlyExpenses = expenseRow?.total ?? 0;
  const totalBudgeted = budgetRow?.total ?? 0;
  const budgetUtilization = totalBudgeted > 0 ? (monthlyExpenses / totalBudgeted) * 100 : 0;

  res.json(GetDashboardSummaryResponse.parse({
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    netSavings: monthlyIncome - monthlyExpenses,
    transactionCount: Number(countRow?.count ?? 0),
    budgetUtilization,
  }));
});

router.get("/dashboard/spending-by-category", async (req, res): Promise<void> => {
  const query = GetSpendingByCategoryQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const month = query.data.month ?? new Date().toISOString().slice(0, 7);

  const rows = await db
    .select({
      categoryId: transactionsTable.categoryId,
      categoryName: categoriesTable.name,
      categoryIcon: categoriesTable.icon,
      categoryColor: categoriesTable.color,
      amount: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)`,
    })
    .from(transactionsTable)
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(
      and(
        eq(transactionsTable.type, "expense"),
        sql`${transactionsTable.date} like ${month + "-%"}`
      )
    )
    .groupBy(transactionsTable.categoryId, categoriesTable.name, categoriesTable.icon, categoriesTable.color)
    .orderBy(sql`sum(${transactionsTable.amount}) desc`);

  const totalExpenses = rows.reduce((sum, r) => sum + Number(r.amount), 0);

  const result = rows
    .filter((r) => r.categoryId != null)
    .map((r) => ({
      categoryId: r.categoryId as number,
      categoryName: r.categoryName ?? "Uncategorized",
      categoryIcon: r.categoryIcon ?? "circle",
      categoryColor: r.categoryColor ?? "#6B7280",
      amount: Number(r.amount),
      percentage: totalExpenses > 0 ? (Number(r.amount) / totalExpenses) * 100 : 0,
    }));

  res.json(GetSpendingByCategoryResponse.parse(result));
});

router.get("/dashboard/monthly-trend", async (_req, res): Promise<void> => {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const result = await Promise.all(
    months.map(async (month) => {
      const [incomeRow] = await db
        .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.type, "income"),
            sql`${transactionsTable.date} like ${month + "-%"}`
          )
        );

      const [expenseRow] = await db
        .select({ total: sql<number>`coalesce(sum(${transactionsTable.amount}), 0)` })
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.type, "expense"),
            sql`${transactionsTable.date} like ${month + "-%"}`
          )
        );

      const income = Number(incomeRow?.total ?? 0);
      const expenses = Number(expenseRow?.total ?? 0);

      return {
        month,
        income,
        expenses,
        savings: income - expenses,
      };
    })
  );

  res.json(GetMonthlyTrendResponse.parse(result));
});

export default router;
