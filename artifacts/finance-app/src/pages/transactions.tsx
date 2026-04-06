import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFinanceStore } from "@/hooks/use-finance-store";
import { CostEntry, getCurrentMonth, monthLabel, uid } from "@/lib/finance";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type CostForm = Omit<CostEntry, "id">;

const emptyForm: CostForm = {
  owner: "",
  name: "",
  amount: 0,
  paymentType: "debit" as const,
  nature: "fixed" as const,
  category: "",
  referenceMonth: getCurrentMonth(),
  recurrenceMonths: 1,
  durationMonths: null,
  notes: "",
};

export default function Transactions() {
  const { data, setData } = useFinanceStore();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CostForm>(emptyForm);

  const monthCosts = useMemo(
    () => data.costs.filter((c) => c.referenceMonth <= selectedMonth),
    [data.costs, selectedMonth],
  );

  const sorted = [...monthCosts].sort((a, b) => b.referenceMonth.localeCompare(a.referenceMonth));
  const groupedCosts = sorted.reduce<Record<string, CostEntry[]>>((acc, cost) => {
    const owner = cost.owner || "Não informado";
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(cost);
    return acc;
  }, {});

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const saveCost = () => {
    const payload: CostEntry = {
      id: editingId ?? uid(),
      ...form,
      amount: Number(form.amount),
      recurrenceMonths: Number(form.recurrenceMonths),
      durationMonths: form.durationMonths === null ? null : Number(form.durationMonths),
    };

    if (!payload.owner || !payload.name || !payload.category || payload.amount <= 0) return;

    setData((prev) => ({
      ...prev,
      costs: editingId ? prev.costs.map((c) => (c.id === editingId ? payload : c)) : [payload, ...prev.costs],
    }));

    resetForm();
  };

  const editCost = (cost: CostEntry) => {
    setEditingId(cost.id);
    setForm(cost);
  };

  const deleteCost = (id: string) => {
    setData((prev) => ({ ...prev, costs: prev.costs.filter((c) => c.id !== id) }));
  };

  const totalMonth = sorted.filter((c) => c.referenceMonth === selectedMonth).reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Custos / Despesas</h1>
          <p className="text-muted-foreground">Cadastre custos fixos, pontuais, em débito ou cartão, com duração e recorrência.</p>
        </div>
        <div className="flex gap-2">
          <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-[180px]" />
          <Button variant="outline" onClick={resetForm}>
            <Plus className="h-4 w-4 mr-2" /> Limpar formulário
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar custo" : "Novo custo"}</CardTitle>
          <CardDescription>Preencha o formulário abaixo para cadastrar ou atualizar uma despesa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Dono da despesa</Label>
              <Input value={form.owner} onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))} placeholder="Ex: David ou Rute" />
            </div>
            <div className="md:col-span-2">
              <Label>Nome / descrição</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Valor</Label>
              <Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Ex: Moradia" />
            </div>
            <div>
              <Label>Pagamento</Label>
              <Select value={form.paymentType} onValueChange={(v: "debit" | "credit") => setForm((f) => ({ ...f, paymentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="credit">Cartão de crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.nature} onValueChange={(v: "fixed" | "one_time") => setForm((f) => ({ ...f, nature: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixo</SelectItem>
                  <SelectItem value="one_time">Pontual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mês de referência</Label>
              <Input type="month" value={form.referenceMonth} onChange={(e) => setForm((f) => ({ ...f, referenceMonth: e.target.value }))} />
            </div>
            <div>
              <Label>Recorrência (meses)</Label>
              <Input type="number" min={1} value={form.recurrenceMonths} onChange={(e) => setForm((f) => ({ ...f, recurrenceMonths: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2">
              <Label>Quantidade de parcelas / duração</Label>
              <Input
                type="number"
                min={1}
                disabled={form.durationMonths === null}
                value={form.durationMonths ?? ""}
                placeholder={form.durationMonths === null ? "Recorrência infinita" : ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((f) => ({ ...f, durationMonths: value ? Number(value) : 1 }));
                }}
              />
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.durationMonths === null}
                  onChange={(e) => setForm((f) => ({ ...f, durationMonths: e.target.checked ? null : 1 }))}
                />
                Recorrência infinita (sem quantidade de vezes)
              </label>
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveCost}>{editingId ? "Salvar alterações" : "Cadastrar custo"}</Button>
            {editingId ? (
              <Button variant="ghost" onClick={resetForm}>Cancelar edição</Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo de {monthLabel(selectedMonth)}</CardTitle>
          <CardDescription>Total do mês selecionado: {currency.format(totalMonth)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum custo cadastrado.</p>
          ) : (
            Object.entries(groupedCosts).map(([owner, costs]) => (
              <div key={owner} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{owner}</h3>
                {costs.map((cost) => (
                  <div key={cost.id} className="rounded-lg border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold">{cost.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {cost.category} • {cost.paymentType === "debit" ? "Débito" : "Cartão"} • {cost.nature === "fixed" ? "Fixo" : "Pontual"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Referência {monthLabel(cost.referenceMonth)} • Recorrência {cost.recurrenceMonths} mês(es) • Duração{" "}
                        {cost.durationMonths === null ? "Infinita" : `${cost.durationMonths} mês(es)`}
                      </p>
                      {cost.notes ? <p className="text-xs mt-1">Obs: {cost.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg min-w-[130px] text-right">{currency.format(cost.amount)}</p>
                      <Button variant="outline" size="icon" onClick={() => editCost(cost)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="icon" onClick={() => deleteCost(cost.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
