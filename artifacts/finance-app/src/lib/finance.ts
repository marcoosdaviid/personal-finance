import { addMonths, differenceInCalendarMonths, format, parse } from "date-fns";

export type PaymentType = "debit" | "credit";
export type CostNature = "fixed" | "one_time";
export type IncomeType = "fixed" | "additional" | "bonus" | "one_time";

export type CostEntry = {
  id: string;
  owner: string;
  name: string;
  amount: number;
  paymentType: PaymentType;
  nature: CostNature;
  category: string;
  referenceMonth: string; // yyyy-MM
  recurrenceMonths: number;
  durationMonths: number | null;
  notes?: string;
};

export type IncomeEntry = {
  id: string;
  owner: string;
  name: string;
  amount: number;
  type: IncomeType;
  referenceMonth: string;
  recurrenceMonths: number;
  durationMonths: number;
  notes?: string;
};

export type SalaryChange = {
  id: string;
  owner: string;
  effectiveMonth: string;
  value: number;
  notes?: string;
  createdAt: string;
};

export type FinanceData = {
  costs: CostEntry[];
  incomes: IncomeEntry[];
  salaryHistory: SalaryChange[];
  creditCardInvoiceOverrides: Record<string, number>;
};

const STORAGE_KEY = "finflow.v2.finance";

export const emptyFinanceData: FinanceData = {
  costs: [],
  incomes: [],
  salaryHistory: [],
  creditCardInvoiceOverrides: {},
};

export function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadFinanceData(): FinanceData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyFinanceData;
    const parsed = JSON.parse(raw) as Partial<FinanceData>;
    return {
      costs: (parsed.costs ?? []).map((cost) => ({
        ...cost,
        owner: cost.owner ?? "Não informado",
        durationMonths: cost.durationMonths ?? 1,
      })),
      incomes: (parsed.incomes ?? []).map((income) => ({ ...income, owner: income.owner ?? "Não informado" })),
      salaryHistory: (parsed.salaryHistory ?? [])
        .map((salary) => ({ ...salary, owner: salary.owner ?? "Não informado" }))
        .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth)),
      creditCardInvoiceOverrides: parsed.creditCardInvoiceOverrides ?? {},
    };
  } catch {
    return emptyFinanceData;
  }
}

export function saveFinanceData(data: FinanceData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getCurrentMonth() {
  return format(new Date(), "yyyy-MM");
}

export function monthLabel(month: string) {
  return format(parse(`${month}-01`, "yyyy-MM-dd", new Date()), "MMM yyyy");
}

function activeInMonth(startMonth: string, recurrenceMonths: number, durationMonths: number | null, targetMonth: string) {
  const diff = differenceInCalendarMonths(
    parse(`${targetMonth}-01`, "yyyy-MM-dd", new Date()),
    parse(`${startMonth}-01`, "yyyy-MM-dd", new Date()),
  );

  const recurrence = Math.max(1, recurrenceMonths);
  const hasDurationLimit = typeof durationMonths === "number" && Number.isFinite(durationMonths) && durationMonths > 0;
  if (diff < 0 || diff % recurrence !== 0) return false;
  if (!hasDurationLimit) return true;
  return diff < durationMonths;
}

export function computeMonth(data: FinanceData, month: string) {
  const fixedSalary = Object.values(
    data.salaryHistory
      .filter((s) => s.effectiveMonth <= month)
      .reduce<Record<string, SalaryChange>>((acc, salary) => {
        const current = acc[salary.owner];
        if (!current || current.effectiveMonth <= salary.effectiveMonth) {
          acc[salary.owner] = salary;
        }
        return acc;
      }, {}),
  ).reduce((sum, salary) => sum + salary.value, 0);

  const costs = data.costs.filter((c) =>
    activeInMonth(c.referenceMonth, c.recurrenceMonths, c.durationMonths, month),
  );

  const extras = data.incomes.filter((i) =>
    activeInMonth(i.referenceMonth, i.recurrenceMonths, i.durationMonths, month),
  );

  const costTotal = costs.reduce((sum, c) => sum + c.amount, 0);
  const debitCosts = costs.filter((c) => c.paymentType === "debit").reduce((sum, c) => sum + c.amount, 0);
  const creditCosts = costs.filter((c) => c.paymentType === "credit").reduce((sum, c) => sum + c.amount, 0);
  const creditCardInvoiceOverride = data.creditCardInvoiceOverrides[month];
  const effectiveCreditCosts = creditCardInvoiceOverride ?? creditCosts;
  const effectiveCostTotal = debitCosts + effectiveCreditCosts;

  const extraIncome = extras.reduce((sum, i) => sum + i.amount, 0);
  const incomeTotal = fixedSalary + extraIncome;

  return {
    month,
    costTotal: effectiveCostTotal,
    incomeTotal,
    balance: incomeTotal - effectiveCostTotal,
    debitCosts,
    creditCosts,
    effectiveCreditCosts,
    creditCardInvoiceOverride,
    fixedSalary,
    extraIncome,
    costs,
  };
}

export function buildProjection(data: FinanceData, startMonth: string, months: number) {
  const start = parse(`${startMonth}-01`, "yyyy-MM-dd", new Date());
  return Array.from({ length: months }).map((_, idx) => {
    const month = format(addMonths(start, idx), "yyyy-MM");
    return computeMonth(data, month);
  });
}
