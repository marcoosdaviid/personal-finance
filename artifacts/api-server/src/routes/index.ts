import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import categoriesRouter from "./categories";
import transactionsRouter from "./transactions";
import budgetsRouter from "./budgets";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountsRouter);
router.use(categoriesRouter);
router.use(transactionsRouter);
router.use(budgetsRouter);
router.use(dashboardRouter);

export default router;
