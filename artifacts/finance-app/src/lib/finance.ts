import { addMonths, differenceInCalendarMonths, format, parse } from "date-fns";

export type PaymentType = "debit" | "credit";
export type CostNature = "fixed" | "one_time";
export type IncomeType = "fixed" | "additional" | "bonus" | "one_time";

export type CostEntry = {
  id: string;
  owner: string;
  name: string;
  amount: number;
  paid: boolean;
  paymentType: PaymentType;
  nature: CostNature;
  category: string;
  referenceMonth: string; // yyyy-MM
  recurrenceMonths: number;
  durationMonths: number;
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
};

const STORAGE_KEY = "finflow.v2.finance";

export const emptyFinanceData: FinanceData = {
  costs: [],
  incomes: [],
  salaryHistory: [],
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
        paid: cost.paid ?? false,
      })),
      incomes: (parsed.incomes ?? []).map((income) => ({ ...income, owner: income.owner ?? "Não informado" })),
      salaryHistory: (parsed.salaryHistory ?? [])
        .map((salary) => ({ ...salary, owner: salary.owner ?? "Não informado" }))
        .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth)),
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

function activeInMonth(startMonth: string, recurrenceMonths: number, durationMonths: number, targetMonth: string) {
  const diff = differenceInCalendarMonths(
    parse(`${targetMonth}-01`, "yyyy-MM-dd", new Date()),
    parse(`${startMonth}-01`, "yyyy-MM-dd", new Date()),
  );

  return diff >= 0 && diff < durationMonths && diff % Math.max(1, recurrenceMonths) === 0;
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
  const paidCostTotal = costs.filter((c) => c.paid).reduce((sum, c) => sum + c.amount, 0);
  const debitCosts = costs.filter((c) => c.paymentType === "debit").reduce((sum, c) => sum + c.amount, 0);
  const creditCosts = costs.filter((c) => c.paymentType === "credit").reduce((sum, c) => sum + c.amount, 0);

  const extraIncome = extras.reduce((sum, i) => sum + i.amount, 0);
  const incomeTotal = fixedSalary + extraIncome;

  return {
    month,
    costTotal,
    incomeTotal,
    balance: incomeTotal - costTotal,
    partialBalance: incomeTotal - paidCostTotal,
    paidCostTotal,
    debitCosts,
    creditCosts,
    fixedSalary,
    extraIncome,
  };
}

export function buildProjection(data: FinanceData, startMonth: string, months: number) {
  const start = parse(`${startMonth}-01`, "yyyy-MM-dd", new Date());
  return Array.from({ length: months }).map((_, idx) => {
    const month = format(addMonths(start, idx), "yyyy-MM");
    return computeMonth(data, month);
  });
}
