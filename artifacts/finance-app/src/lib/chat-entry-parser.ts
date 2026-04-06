import { getCurrentMonth, type CostEntry, type IncomeEntry, type SalaryChange } from "@/lib/finance";

export type ParsedChatEntry =
  | { kind: "cost"; payload: Omit<CostEntry, "id"> }
  | { kind: "income"; payload: Omit<IncomeEntry, "id"> }
  | { kind: "salary"; payload: Omit<SalaryChange, "id" | "createdAt"> };

const MONTHS_PT: Record<string, string> = {
  janeiro: "01",
  fevereiro: "02",
  marco: "03",
  março: "03",
  abril: "04",
  maio: "05",
  junho: "06",
  julho: "07",
  agosto: "08",
  setembro: "09",
  outubro: "10",
  novembro: "11",
  dezembro: "12",
};

const CATEGORY_HINTS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /aluguel|condom[ií]nio|luz|energia|água|internet|moradia/i, category: "Moradia" },
  { pattern: /mercado|supermercado|feira|padaria/i, category: "Alimentação" },
  { pattern: /uber|99|gasolina|combust[ií]vel|transporte/i, category: "Transporte" },
  { pattern: /farm[aá]cia|m[eé]dico|sa[uú]de|plano de sa[uú]de/i, category: "Saúde" },
  { pattern: /netflix|spotify|streaming|assinatura/i, category: "Assinaturas" },
];

function toMonth(value: string | undefined): string {
  if (!value) return getCurrentMonth();

  const normalized = value.trim().toLowerCase();

  const slashMatch = normalized.match(/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const mm = slashMatch[1].padStart(2, "0");
    return `${slashMatch[2]}-${mm}`;
  }

  const yyyyMmMatch = normalized.match(/(\d{4})-(\d{2})/);
  if (yyyyMmMatch) return `${yyyyMmMatch[1]}-${yyyyMmMatch[2]}`;

  const monthExtenso = normalized.match(
    /(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de?\s*(\d{4})/,
  );

  if (monthExtenso) {
    const month = MONTHS_PT[monthExtenso[1]];
    return `${monthExtenso[2]}-${month}`;
  }

  return getCurrentMonth();
}

function extractAmount(message: string): number | null {
  const moneyMatch = message.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);
  if (!moneyMatch) return null;
  const normalized = moneyMatch[1].replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractOwner(message: string): string {
  const ownerMatch = message.match(/(?:dono(?:\s+da|\s+do)?|para|de)\s+([a-zà-ÿ]+(?:\s+[a-zà-ÿ]+)?)/i);
  return ownerMatch?.[1]?.trim() ?? "Não informado";
}

function extractMonth(message: string): string {
  const monthMatch = message.match(
    /(\d{1,2}\/\d{4}|\d{4}-\d{2}|(?:janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de?\s*\d{4})/i,
  );
  return toMonth(monthMatch?.[1]);
}

function extractRecurrence(message: string): number {
  const recurrence = message.match(/recorr[êe]ncia\s*(?:de)?\s*(\d+)\s*m[eê]s/i);
  return recurrence ? Number(recurrence[1]) : 1;
}

function extractDuration(message: string): number | null {
  if (/infinita|indeterminada|sem fim/i.test(message)) return null;
  const duration = message.match(/dura[cç][aã]o\s*(?:de)?\s*(\d+)\s*m[eê]s/i);
  return duration ? Number(duration[1]) : 1;
}

function inferCategory(message: string): string {
  const explicit = message.match(/categoria\s*[:=-]?\s*([\wÀ-ÿ ]+)/i);
  if (explicit?.[1]) return explicit[1].trim();
  const mapped = CATEGORY_HINTS.find(({ pattern }) => pattern.test(message));
  return mapped?.category ?? "Geral";
}

function inferDescription(message: string, fallback: string) {
  const desc = message.match(/(?:descri[cç][aã]o|nome)\s*[:=-]?\s*([\wÀ-ÿ ]+)/i);
  return desc?.[1]?.trim() || fallback;
}

export function parseChatEntry(message: string): ParsedChatEntry {
  const text = message.trim();
  if (!text) {
    throw new Error("Mensagem vazia.");
  }

  const amount = extractAmount(text);
  if (!amount || amount <= 0) {
    throw new Error("Não encontrei um valor válido na mensagem.");
  }

  const referenceMonth = extractMonth(text);
  const owner = extractOwner(text);

  if (/sal[aá]rio|receita fixa|mudan[cç]a de receita/i.test(text)) {
    return {
      kind: "salary",
      payload: {
        owner,
        effectiveMonth: referenceMonth,
        value: amount,
        notes: text,
      },
    };
  }

  if (/receita|ganhei|recebi|b[oô]nus|bonus|entrada/i.test(text)) {
    const type: IncomeEntry["type"] = /b[oô]nus|bonus/i.test(text)
      ? "bonus"
      : /fixa|mensal/i.test(text)
        ? "fixed"
        : /pontual|avulsa|uma vez/i.test(text)
          ? "one_time"
          : "additional";

    return {
      kind: "income",
      payload: {
        owner,
        name: inferDescription(text, "Receita via chat"),
        amount,
        type,
        referenceMonth,
        recurrenceMonths: extractRecurrence(text),
        durationMonths: extractDuration(text) ?? 1,
        notes: text,
      },
    };
  }

  const paymentType: CostEntry["paymentType"] = /cr[eé]dito|cart[aã]o/i.test(text) ? "credit" : "debit";
  const nature: CostEntry["nature"] = /pontual|avulsa|uma vez/i.test(text) ? "one_time" : "fixed";

  return {
    kind: "cost",
    payload: {
      owner,
      name: inferDescription(text, "Despesa via chat"),
      amount,
      paymentType,
      nature,
      category: inferCategory(text),
      referenceMonth,
      recurrenceMonths: extractRecurrence(text),
      durationMonths: extractDuration(text),
      notes: text,
    },
  };
}
