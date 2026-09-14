export interface CrmCompany {
  id: string;
  company: string;
  website: string;
  sector: string;
  country: string;
  city: string;
  source: string;
  idealFit: string;
  priority: string;
  owner: string;
  leadStatus: string;
  createdAt: string;
  lastContact: string;
  nextAction: string;
  serviceInterest: string;
  estimatedMonthlyValue: string;
  notes: string;
}

export const CRM_COLUMNS = [
  { key: "id", label: "ID Empresa" },
  { key: "company", label: "Empresa" },
  { key: "website", label: "Website" },
  { key: "sector", label: "Setor" },
  { key: "country", label: "País" },
  { key: "city", label: "Cidade" },
  { key: "source", label: "Origem" },
  { key: "idealFit", label: "Adequação (1-5)" },
  { key: "priority", label: "Prioridade" },
  { key: "owner", label: "Responsável" },
  { key: "leadStatus", label: "Estado do Lead" },
  { key: "createdAt", label: "Data Criada" },
  { key: "lastContact", label: "Último Contacto" },
  { key: "nextAction", label: "Próxima Ação" },
  { key: "serviceInterest", label: "Serviço de Interesse" },
  { key: "estimatedMonthlyValue", label: "Valor Mensal Estimado (€)" },
  { key: "notes", label: "Notas" },
] as const satisfies ReadonlyArray<{ key: keyof CrmCompany; label: string }>;

export type CrmColumnKey = (typeof CRM_COLUMNS)[number]["key"];

export const DEFAULT_VISIBLE_CRM_COLUMNS: CrmColumnKey[] = [
  "id", "company", "sector", "city", "country", "owner", "leadStatus",
  "estimatedMonthlyValue", "lastContact",
];

export function rowToCompany(row: unknown[]): CrmCompany {
  const values = Array.from({ length: CRM_COLUMNS.length }, (_, index) => String(row[index] ?? ""));
  return Object.fromEntries(CRM_COLUMNS.map((column, index) => [column.key, values[index]])) as unknown as CrmCompany;
}

export function companyToRow(company: CrmCompany): string[] {
  return CRM_COLUMNS.map((column) => String(company[column.key] ?? ""));
}

export function createNextCompanyId(ids: string[]): string {
  const highest = ids.reduce((maximum, id) => {
    const match = /^CP-(\d+)$/i.exec(id.trim());
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `CP-${String(highest + 1).padStart(3, "0")}`;
}

export function findFirstEmptySheetRow(rows: unknown[][]): number {
  const emptyIndex = rows.findIndex((row) => !row.some((value) => String(value ?? "").trim()));
  return (emptyIndex === -1 ? rows.length : emptyIndex) + 2;
}

export function findCompanySheetRow(rows: unknown[][], id: string): number | null {
  const rowIndex = rows.findIndex((row) => String(row[0] ?? "").trim() === id);
  return rowIndex === -1 ? null : rowIndex + 2;
}
