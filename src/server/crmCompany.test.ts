import assert from "node:assert/strict";
import test from "node:test";
import {
  CRM_COLUMNS,
  companyToRow,
  createNextCompanyId,
  findCompanySheetRow,
  findFirstEmptySheetRow,
  rowToCompany,
  type CrmCompany,
} from "./crmCompany";

const completeCompany: CrmCompany = {
  id: "CP-021",
  company: "Empresa Nova",
  website: "https://example.pt",
  sector: "Tecnologia",
  country: "Portugal",
  city: "Lisboa",
  source: "Dashboard AXION",
  idealFit: "5",
  priority: "Alta",
  owner: "Nelson Afonso",
  leadStatus: "Em pesquisa",
  createdAt: "02/09/2026",
  lastContact: "",
  nextAction: "Telefonar",
  serviceInterest: "Website",
  estimatedMonthlyValue: "2450",
  notes: "Criada no Office",
};

test("preserva as 17 colunas da folha ao converter empresa para linha e обратно", () => {
  const row = companyToRow(completeCompany);

  assert.equal(CRM_COLUMNS.length, 17);
  assert.equal(row.length, 17);
  assert.deepEqual(rowToCompany(row), completeCompany);
});

test("associa Responsável à décima coluna da folha", () => {
  const row = companyToRow(completeCompany);

  assert.equal(row[9], "Nelson Afonso");
  assert.equal(rowToCompany(row).owner, "Nelson Afonso");
});

test("gera o próximo ID a partir do maior ID existente e não da quantidade de linhas", () => {
  assert.equal(createNextCompanyId(["CP-001", "CP-020", "CP-007", "manual"]), "CP-021");
});

test("escreve na primeira linha totalmente vazia mesmo quando existem linhas formatadas abaixo", () => {
  const rows = [["CP-001", "Primeira"], ["CP-002", "Segunda"], [], [], ["", "", "valor residual"]];

  assert.equal(findFirstEmptySheetRow(rows), 4);
});

test("mantém o número real da linha ao localizar uma empresa depois de linhas vazias", () => {
  const rows = [["CP-001", "Primeira"], [], [], ["CP-021", "Nova"]];

  assert.equal(findCompanySheetRow(rows, "CP-021"), 5);
});
