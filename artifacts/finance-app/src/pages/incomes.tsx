import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useFinanceStore } from "@/hooks/use-finance-store";
import { useToast } from "@/hooks/use-toast";
import { IncomeEntry, SalaryChange, getCurrentMonth, monthLabel, uid } from "@/lib/finance";
import { parseChatEntry } from "@/lib/chat-entry-parser";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type IncomeForm = Omit<IncomeEntry, "id">;

const extraInitial: IncomeForm = {
  owner: "",
  name: "",
  amount: 0,
  type: "additional" as const,
  referenceMonth: getCurrentMonth(),
  recurrenceMonths: 1,
  durationMonths: 1,
  notes: "",
};

export default function Incomes() {
  const { data, setData } = useFinanceStore();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [extraForm, setExtraForm] = useState<IncomeForm>(extraInitial);
  const [salaryForm, setSalaryForm] = useState({ owner: "", effectiveMonth: getCurrentMonth(), value: 0, notes: "" });
  const [chatInput, setChatInput] = useState("");
  const groupedIncomes = data.incomes.reduce<Record<string, IncomeEntry[]>>((acc, income) => {
    const owner = income.owner || "Não informado";
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(income);
    return acc;
  }, {});
  const groupedSalaryHistory = data.salaryHistory.reduce<Record<string, SalaryChange[]>>((acc, salary) => {
    const owner = salary.owner || "Não informado";
    if (!acc[owner]) acc[owner] = [];
    acc[owner].push(salary);
    return acc;
  }, {});

  const saveExtra = () => {
    const payload: IncomeEntry = {
      id: editingId ?? uid(),
      ...extraForm,
      amount: Number(extraForm.amount),
      recurrenceMonths: Number(extraForm.recurrenceMonths),
      durationMonths: Number(extraForm.durationMonths),
    };
    if (!payload.owner || !payload.name || payload.amount <= 0) return;

    setData((prev) => ({
      ...prev,
      incomes: editingId ? prev.incomes.map((i) => (i.id === editingId ? payload : i)) : [payload, ...prev.incomes],
    }));
    setExtraForm(extraInitial);
    setEditingId(null);
  };

  const saveSalary = () => {
    if (!salaryForm.owner || salaryForm.value <= 0) return;
    const payload: SalaryChange = {
      id: uid(),
      owner: salaryForm.owner,
      effectiveMonth: salaryForm.effectiveMonth,
      value: Number(salaryForm.value),
      notes: salaryForm.notes,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      salaryHistory: [...prev.salaryHistory, payload].sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth)),
    }));
    setSalaryForm({ owner: "", effectiveMonth: getCurrentMonth(), value: 0, notes: "" });
  };

  const insertFromChat = () => {
    try {
      const parsed = parseChatEntry(chatInput);
      if (parsed.kind === "cost") {
        toast({
          title: "Mensagem reconhecida como despesa",
          description: "Use a página de despesas para lançar esse item via chat.",
          variant: "destructive",
        });
        return;
      }

      if (parsed.kind === "salary") {
        setData((prev) => ({
          ...prev,
          salaryHistory: [
            ...prev.salaryHistory,
            { id: uid(), ...parsed.payload, createdAt: new Date().toISOString() },
          ].sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth)),
        }));
        toast({
          title: "Mudança salarial registrada",
          description: `${parsed.payload.owner} • ${currency.format(parsed.payload.value)}`,
        });
      } else {
        setData((prev) => ({
          ...prev,
          incomes: [{ id: uid(), ...parsed.payload }, ...prev.incomes],
        }));
        toast({
          title: "Receita cadastrada por chat",
          description: `${parsed.payload.name} • ${currency.format(parsed.payload.amount)}`,
        });
      }

      setChatInput("");
    } catch (error) {
      toast({
        title: "Não consegui interpretar a mensagem",
        description: error instanceof Error ? error.message : "Inclua valor, tipo e dono na mensagem.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Lançamento por chat (LLM)</CardTitle>
          <CardDescription>
            Exemplo: &quot;Recebi bônus de R$ 1200 para Rute em abril de 2026&quot; ou &quot;Novo salário de R$ 8500 para David a partir de maio de 2026&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Digite a receita ou mudança salarial em linguagem natural..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <Button onClick={insertFromChat}>Inserir receita via chat</Button>
        </CardContent>
      </Card>

      <div>
        <h1 className="text-3xl font-bold">Receitas</h1>
        <p className="text-muted-foreground">Cadastre receitas fixas, adicionais, bônus e entradas pontuais com histórico de alterações salariais.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Histórico da receita fixa mensal</CardTitle>
              <CardDescription>Mantenha mudanças de salário por mês de vigência.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setSalaryForm({ owner: "", effectiveMonth: getCurrentMonth(), value: 0, notes: "" })}>
              <Plus className="h-4 w-4 mr-2" /> Limpar formulário
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-lg border p-4">
              <p className="font-medium">Registrar mudança de receita fixa</p>
              <div>
                <Label>Dono da receita fixa</Label>
                <Input value={salaryForm.owner} onChange={(e) => setSalaryForm((f) => ({ ...f, owner: e.target.value }))} placeholder="Ex: David ou Rute" />
              </div>
              <div>
                <Label>A partir do mês</Label>
                <Input type="month" value={salaryForm.effectiveMonth} onChange={(e) => setSalaryForm((f) => ({ ...f, effectiveMonth: e.target.value }))} />
              </div>
              <div>
                <Label>Novo valor da receita fixa</Label>
                <Input type="number" min={0} step="0.01" value={salaryForm.value} onChange={(e) => setSalaryForm((f) => ({ ...f, value: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={salaryForm.notes} onChange={(e) => setSalaryForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
              <Button onClick={saveSalary}>Salvar mudança</Button>
            </div>
            {data.salaryHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem histórico de salário ainda.</p>
            ) : (
              Object.entries(groupedSalaryHistory).map(([owner, changes]) => (
                <div key={owner} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{owner}</p>
                  {changes.map((change) => (
                    <div key={change.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">A partir de {monthLabel(change.effectiveMonth)}</p>
                        <p className="text-lg font-semibold">{currency.format(change.value)}</p>
                        {change.notes ? <p className="text-xs text-muted-foreground">{change.notes}</p> : null}
                      </div>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() =>
                          setData((prev) => ({
                            ...prev,
                            salaryHistory: prev.salaryHistory.filter((salaryChange) => salaryChange.id !== change.id),
                          }))
                        }
                        aria-label={`Remover mudança salarial de ${owner}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Receitas extras</CardTitle>
              <CardDescription>Receita adicional, bônus e entradas pontuais.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => { setExtraForm(extraInitial); setEditingId(null); }}>
              <Plus className="h-4 w-4 mr-2" /> Limpar formulário
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4 rounded-lg border p-4">
              <p className="font-medium">{editingId ? "Editar receita extra" : "Nova receita extra"}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Dono da receita</Label>
                  <Input value={extraForm.owner} onChange={(e) => setExtraForm((f) => ({ ...f, owner: e.target.value }))} placeholder="Ex: David ou Rute" />
                </div>
                <div className="md:col-span-2">
                  <Label>Nome</Label>
                  <Input value={extraForm.name} onChange={(e) => setExtraForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input type="number" min={0} step="0.01" value={extraForm.amount} onChange={(e) => setExtraForm((f) => ({ ...f, amount: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={extraForm.type} onValueChange={(v: IncomeEntry["type"]) => setExtraForm((f) => ({ ...f, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Receita fixa mensal</SelectItem>
                      <SelectItem value="additional">Receita adicional</SelectItem>
                      <SelectItem value="bonus">Bônus / extra</SelectItem>
                      <SelectItem value="one_time">Entrada pontual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mês de referência</Label>
                  <Input type="month" value={extraForm.referenceMonth} onChange={(e) => setExtraForm((f) => ({ ...f, referenceMonth: e.target.value }))} />
                </div>
                <div>
                  <Label>Recorrência (meses)</Label>
                  <Input type="number" min={1} value={extraForm.recurrenceMonths} onChange={(e) => setExtraForm((f) => ({ ...f, recurrenceMonths: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>Duração (meses)</Label>
                  <Input type="number" min={1} value={extraForm.durationMonths} onChange={(e) => setExtraForm((f) => ({ ...f, durationMonths: Number(e.target.value) }))} />
                </div>
                <div className="md:col-span-2">
                  <Label>Observações</Label>
                  <Textarea value={extraForm.notes} onChange={(e) => setExtraForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveExtra}>{editingId ? "Salvar alterações" : "Cadastrar receita"}</Button>
                {editingId ? (
                  <Button variant="ghost" onClick={() => { setExtraForm(extraInitial); setEditingId(null); }}>Cancelar edição</Button>
                ) : null}
              </div>
            </div>
            {data.incomes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem receitas extras cadastradas.</p>
            ) : (
              Object.entries(groupedIncomes).map(([owner, incomes]) => (
                <div key={owner} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{owner}</p>
                  {incomes.map((income) => (
                    <div key={income.id} className="rounded-lg border p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{income.name}</p>
                        <p className="text-xs text-muted-foreground">{income.type} • {monthLabel(income.referenceMonth)} • {income.durationMonths} mês(es)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{currency.format(income.amount)}</p>
                        <Button variant="outline" size="icon" onClick={() => { setEditingId(income.id); setExtraForm(income); }}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="destructive" size="icon" onClick={() => setData((prev) => ({ ...prev, incomes: prev.incomes.filter((i) => i.id !== income.id) }))}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
