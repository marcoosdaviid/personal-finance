import { useEffect, useMemo, useState } from "react";
import { addMonths, format, parse } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useFinanceStore } from "@/hooks/use-finance-store";
import { buildProjection, computeMonth, getCurrentMonth, monthLabel } from "@/lib/finance";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function Dashboard() {
  const { data, setData } = useFinanceStore();
  const currentMonth = getCurrentMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [projectionSize, setProjectionSize] = useState<"6" | "12">("6");

  const monthOptions = useMemo(() => {
    const start = parse(`${currentMonth}-01`, "yyyy-MM-dd", new Date());
    return Array.from({ length: 24 }).map((_, idx) => format(addMonths(start, idx - 6), "yyyy-MM"));
  }, [currentMonth]);

  const selectedSummary = useMemo(() => computeMonth(data, selectedMonth), [data, selectedMonth]);
  const [manualInvoiceInput, setManualInvoiceInput] = useState("");

  useEffect(() => {
    const override = data.creditCardInvoiceOverrides[selectedMonth];
    setManualInvoiceInput(override === undefined ? "" : String(override));
  }, [data.creditCardInvoiceOverrides, selectedMonth]);

  const selectedMonthCosts = useMemo(() => selectedSummary.costs, [selectedSummary.costs]);
  const expenseGroups = useMemo(
    () => ({
      debitFixed: selectedMonthCosts.filter((cost) => cost.paymentType === "debit" && cost.nature === "fixed"),
      debitOneTime: selectedMonthCosts.filter((cost) => cost.paymentType === "debit" && cost.nature === "one_time"),
      creditFixed: selectedMonthCosts.filter((cost) => cost.paymentType === "credit" && cost.nature === "fixed"),
      creditOneTime: selectedMonthCosts.filter((cost) => cost.paymentType === "credit" && cost.nature === "one_time"),
    }),
    [selectedMonthCosts],
  );

  const updateManualInvoice = () => {
    const parsed = Number(manualInvoiceInput);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setData((prev) => ({
      ...prev,
      creditCardInvoiceOverrides: {
        ...prev.creditCardInvoiceOverrides,
        [selectedMonth]: parsed,
      },
    }));
  };

  const clearManualInvoice = () => {
    setData((prev) => {
      const nextOverrides = { ...prev.creditCardInvoiceOverrides };
      delete nextOverrides[selectedMonth];
      return {
        ...prev,
        creditCardInvoiceOverrides: nextOverrides,
      };
    });
    setManualInvoiceInput("");
  };

  const projection = useMemo(
    () => buildProjection(data, selectedMonth, Number(projectionSize)).map((m) => ({
      ...m,
      label: format(parse(`${m.month}-01`, "yyyy-MM-dd", new Date()), "MMM/yy"),
    })),
    [data, projectionSize, selectedMonth],
  );

  const accumulatedBalance = projection.reduce((sum, m) => sum + m.balance, 0);
  const manualInvoiceValue = data.manualCreditInvoices[selectedMonth];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Planejamento Financeiro</h1>
          <p className="text-muted-foreground">Resumo mensal + projeção futura de saldo.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((month) => (
                <SelectItem key={month} value={month}>
                  {monthLabel(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Custo total do mês"
          value={selectedSummary.costTotal}
          subtitle={`Débito ${currency.format(selectedSummary.debitCosts)} • Cartão ${currency.format(selectedSummary.effectiveCreditCosts)}`}
        />
        <MetricCard title="Receita total do mês" value={selectedSummary.incomeTotal} subtitle={`Fixa ${currency.format(selectedSummary.fixedSalary)} • Extras ${currency.format(selectedSummary.extraIncome)}`} positive />
        <MetricCard title="Saldo do mês" value={selectedSummary.balance} subtitle={monthLabel(selectedMonth)} positive={selectedSummary.balance >= 0} />
        <MetricCard title="Saldo acumulado" value={accumulatedBalance} subtitle={`Próximos ${projectionSize} meses`} positive={accumulatedBalance >= 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fatura manual do cartão ({monthLabel(selectedMonth)})</CardTitle>
          <CardDescription>
            Ao preencher manualmente, o saldo ignora despesas de cartão deste mês e usa apenas o valor informado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Valor atual em uso:{" "}
              {selectedSummary.creditCardInvoiceOverride === undefined
                ? `${currency.format(selectedSummary.creditCosts)} (calculado automaticamente)`
                : `${currency.format(selectedSummary.creditCardInvoiceOverride)} (manual)`}
            </p>
            <Input
              className="w-[220px]"
              type="number"
              min={0}
              step="0.01"
              value={manualInvoiceInput}
              placeholder="Ex: 2500,00"
              onChange={(e) => setManualInvoiceInput(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={updateManualInvoice}>
              Aplicar valor manual
            </Button>
            <Button variant="outline" onClick={clearManualInvoice}>
              Remover manual
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Despesas organizadas por tipo ({monthLabel(selectedMonth)})</CardTitle>
          <CardDescription>Separação entre débito/crédito e fixa/pontual para o mês selecionado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <ExpenseGroup title="Despesa no Débito Fixa" costs={expenseGroups.debitFixed} />
          <ExpenseGroup title="Despesa no Débito Pontual" costs={expenseGroups.debitOneTime} />
          <ExpenseGroup title="Despesa no Crédito Fixa" costs={expenseGroups.creditFixed} />
          <ExpenseGroup title="Despesa no Crédito Pontual" costs={expenseGroups.creditOneTime} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Projeção futura</CardTitle>
            <CardDescription>Considera custos fixos, parcelamentos, recorrências, salário e extras cadastrados.</CardDescription>
          </div>
          <Tabs value={projectionSize} onValueChange={(v) => setProjectionSize(v as "6" | "12")}>
            <TabsList>
              <TabsTrigger value="6">6 meses</TabsTrigger>
              <TabsTrigger value="12">12 meses</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection}>
                <defs>
                  <linearGradient id="saldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v) => currency.format(v)} width={90} />
                <Tooltip formatter={(value: number) => currency.format(value)} />
                <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#saldo)" name="Saldo" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projection.map((month) => (
              <div key={month.month} className="rounded-lg border p-3 bg-card">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{monthLabel(month.month)}</p>
                  <Badge variant={month.balance >= 0 ? "default" : "destructive"}>{month.balance >= 0 ? "Positivo" : "Negativo"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Receita: {currency.format(month.incomeTotal)}</p>
                <p className="text-sm text-muted-foreground">Custos: {currency.format(month.costTotal)}</p>
                <p className="text-base font-semibold mt-1">Saldo: {currency.format(month.balance)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExpenseGroup({ title, costs }: { title: string; costs: Array<{ id: string; name: string; amount: number }> }) {
  const total = costs.reduce((sum, cost) => sum + cost.amount, 0);
  return (
    <div className="rounded-lg border p-3">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mb-2">Total: {currency.format(total)}</p>
      {costs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma despesa neste grupo.</p>
      ) : (
        <div className="space-y-1">
          {costs.map((cost) => (
            <p key={cost.id} className="text-sm">
              {cost.name} — {currency.format(cost.amount)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, subtitle, positive }: { title: string; value: number; subtitle?: string; positive?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={`text-2xl ${positive === undefined ? "" : positive ? "text-emerald-600" : "text-red-600"}`}>{currency.format(value)}</CardTitle>
      </CardHeader>
      {subtitle ? <CardContent className="pt-0 text-xs text-muted-foreground">{subtitle}</CardContent> : null}
    </Card>
  );
}

function MetricTile({ label, value, helperText, positive }: { label: string; value: number; helperText?: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${positive === undefined ? "" : positive ? "text-emerald-600" : "text-red-600"}`}>{currency.format(value)}</p>
      {helperText ? <p className="mt-1 text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
