import { Router, type IRouter } from "express";
import { db, categoriesTable } from "@workspace/db";
import {
  ListCategoriesResponse,
  CreateCategoryBody,
} from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/categories", async (_req, res): Promise<void> => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(ListCategoriesResponse.parse(serializeDates(categories)));
});

router.post("/categories", async (req, res): Promise<void> => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [category] = await db.insert(categoriesTable).values(parsed.data).returning();
  res.status(201).json(serializeDates(category));
});

export default router;
