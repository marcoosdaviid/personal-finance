import { useMemo, useState } from "react";
import { addMonths, format, parse } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardDescription>Resumo do mês</CardDescription>
            <CardTitle>{monthLabel(selectedMonth)}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <MetricTile
              label="Saldo"
              value={selectedSummary.balance}
              positive={selectedSummary.balance >= 0}
              helperText={selectedSummary.balance >= 0 ? "Positivo" : "Negativo"}
            />
            <MetricTile
              label="Despesa"
              value={selectedSummary.costTotal}
              helperText={`Débito ${currency.format(selectedSummary.debitCosts)} • Cartão ${currency.format(selectedSummary.creditCosts)}`}
            />
            <MetricTile
              label="Receita"
              value={selectedSummary.incomeTotal}
              positive
              helperText={`Fixa ${currency.format(selectedSummary.fixedSalary)} • Extras ${currency.format(selectedSummary.extraIncome)}`}
            />
          </CardContent>
        </Card>
        <MetricCard title="Saldo acumulado" value={accumulatedBalance} subtitle={`Próximos ${projectionSize} meses`} positive={accumulatedBalance >= 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fatura de cartão manual</CardTitle>
          <CardDescription>
            Ao informar a fatura manual de {monthLabel(selectedMonth)}, o cálculo ignora as despesas no crédito desse mês e usa somente o valor informado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:max-w-sm">
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Ex: 1850,00"
            value={manualInvoiceValue ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              setData((prev) => {
                const nextInvoices = { ...prev.manualCreditInvoices };
                if (value === "") {
                  delete nextInvoices[selectedMonth];
                } else {
                  nextInvoices[selectedMonth] = Number(value);
                }
                return {
                  ...prev,
                  manualCreditInvoices: nextInvoices,
                };
              });
            }}
          />
          <p className="text-xs text-muted-foreground">
            Deixe em branco para voltar ao cálculo automático da fatura ({currency.format(selectedSummary.calculatedCreditCosts)}).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Despesas separadas por tipo</CardTitle>
          <CardDescription>Detalhamento das despesas do mês selecionado.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile label="Despesa no Débito Fixa" value={selectedSummary.debitFixedCosts} />
          <MetricTile label="Despesa no Débito Pontual" value={selectedSummary.debitOneTimeCosts} />
          <MetricTile label="Despesa no Crédito Fixa" value={selectedSummary.creditFixedCosts} />
          <MetricTile label="Despesa no Crédito Pontual" value={selectedSummary.creditOneTimeCosts} />
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
