import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, transactionsTable, accountsTable, categoriesTable } from "@workspace/db";
import {
  ListTransactionsQueryParams,
  ListTransactionsResponse,
  CreateTransactionBody,
  GetTransactionParams,
  GetTransactionResponse,
  UpdateTransactionParams,
  UpdateTransactionBody,
  UpdateTransactionResponse,
  DeleteTransactionParams,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

const withJoins = (baseQuery: ReturnType<typeof db.select>) =>
  baseQuery
    .from(transactionsTable)
    .leftJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id));

const transactionFields = {
  id: transactionsTable.id,
  accountId: transactionsTable.accountId,
  categoryId: transactionsTable.categoryId,
  type: transactionsTable.type,
  amount: transactionsTable.amount,
  description: transactionsTable.description,
  date: transactionsTable.date,
  notes: transactionsTable.notes,
  createdAt: transactionsTable.createdAt,
  accountName: accountsTable.name,
  categoryName: categoriesTable.name,
  categoryIcon: categoriesTable.icon,
  categoryColor: categoriesTable.color,
};

router.get("/transactions", async (req, res): Promise<void> => {
  const query = ListTransactionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { accountId, categoryId, type, limit, offset } = query.data;

  const conditions = [];
  if (accountId != null) conditions.push(eq(transactionsTable.accountId, accountId));
  if (categoryId != null) conditions.push(eq(transactionsTable.categoryId, categoryId));
  if (type != null) conditions.push(eq(transactionsTable.type, type));

  const rows = await db
    .select(transactionFields)
    .from(transactionsTable)
    .leftJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactionsTable.date), desc(transactionsTable.createdAt))
    .limit(limit ?? 100)
    .offset(offset ?? 0);

  res.json(ListTransactionsResponse.parse(serializeDates(rows)));
});

router.post("/transactions", async (req, res): Promise<void> => {
  const parsed = CreateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [transaction] = await db.insert(transactionsTable).values(parsed.data).returning();

  const [row] = await db
    .select(transactionFields)
    .from(transactionsTable)
    .leftJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(eq(transactionsTable.id, transaction.id));

  res.status(201).json(GetTransactionResponse.parse(serializeDates(row)));
});

router.get("/transactions/:id", async (req, res): Promise<void> => {
  const params = GetTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select(transactionFields)
    .from(transactionsTable)
    .leftJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(eq(transactionsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.json(GetTransactionResponse.parse(serializeDates(row)));
});

router.patch("/transactions/:id", async (req, res): Promise<void> => {
  const params = UpdateTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [transaction] = await db.update(transactionsTable).set(parsed.data).where(eq(transactionsTable.id, params.data.id)).returning();
  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  const [row] = await db
    .select(transactionFields)
    .from(transactionsTable)
    .leftJoin(accountsTable, eq(transactionsTable.accountId, accountsTable.id))
    .leftJoin(categoriesTable, eq(transactionsTable.categoryId, categoriesTable.id))
    .where(eq(transactionsTable.id, transaction.id));

  res.json(UpdateTransactionResponse.parse(serializeDates(row)));
});

router.delete("/transactions/:id", async (req, res): Promise<void> => {
  const params = DeleteTransactionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [transaction] = await db.delete(transactionsTable).where(eq(transactionsTable.id, params.data.id)).returning();
  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
