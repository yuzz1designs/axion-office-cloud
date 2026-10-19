import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { BILLING_LABELS, type QuoteDocumentModel } from "./quoteDocument";

export interface QuotePdfAssets { background: Uint8Array; logo: Uint8Array; regular: Uint8Array; bold: Uint8Array; }
let assetPromise: Promise<QuotePdfAssets> | undefined;
export function loadQuotePdfAssets() {
  if (!assetPromise) assetPromise = Promise.all(["background.jpg", "logo.png", "Poppins-Regular.ttf", "Poppins-Bold.ttf"].map(async (file) => {
    const response = await fetch(`/quotes/${file}`);
    if (!response.ok) throw new Error("Não foi possível carregar o template. Tenta novamente.");
    return new Uint8Array(await response.arrayBuffer());
  })).then(([background, logo, regular, bold]) => ({ background, logo, regular, bold })).catch((error) => { assetPromise = undefined; throw error; });
  return assetPromise;
}

export async function createQuotePdf(model: QuoteDocumentModel, assets: QuotePdfAssets) {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  pdf.setTitle(`${model.reference} - ${model.title}`); pdf.setAuthor("AXION"); pdf.setSubject("Resumo comercial");
  const [regular, bold, background, logo] = await Promise.all([pdf.embedFont(assets.regular, { subset: true }), pdf.embedFont(assets.bold, { subset: true }), pdf.embedJpg(assets.background), pdf.embedPng(assets.logo)]);
  const W = 594.96, H = 841.92, L = 65.2, R = 530, bottom = 755, contentWidth = R - L;
  const white = rgb(1, 1, 1), muted = rgb(.73, .73, .73), lineColor = rgb(.34, .34, .34);
  const money = (value: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: model.currency }).format(value / 100).replace(/\u00a0/g, " ");
  const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-").reverse().join("/") : value;
  let page: PDFPage; let y = 100;
  function text(value: string, x: number, top: number, size = 8.5, font: PDFFont = regular, color = white) {
    page.drawText(value, { x, y: H - top - size, size, font, color });
  }
  function right(value: string, top: number, size = 8.5, font = regular) { text(value, R - font.widthOfTextAtSize(value, size), top, size, font); }
  function rule(top: number, from = L, to = R) { page.drawLine({ start: { x: from, y: H - top }, end: { x: to, y: H - top }, thickness: .5, color: lineColor }); }
  function newPage() {
    page = pdf.addPage([W, H]); page.drawImage(background, { x: 0, y: 0, width: W, height: H });
    page.drawImage(logo, { x: 64, y: H - 75, width: 68, height: 22 });
    right(model.issuedOn.slice(0, 4), 55, 13, bold); y = 100;
  }
  function ensure(height: number) { if (y + height > bottom) newPage(); }
  function wrap(value: string, width: number, size = 8.5, font = regular): string[] {
    const lines: string[] = [];
    for (const paragraph of value.replace(/\r/g, "").replace(/\t/g, "    ").split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) { current = candidate; continue; }
        if (current) { lines.push(current); current = ""; }
        for (const char of word) {
          if (current && font.widthOfTextAtSize(current + char, size) > width) { lines.push(current); current = ""; }
          current += char;
        }
      }
      lines.push(current);
    }
    return lines;
  }
  function paragraph(value: string, size = 8.5, color = white) {
    for (const row of wrap(value, contentWidth, size)) { ensure(13); text(row, L, y, size, regular, color); y += 12.5; }
    y += 8;
  }
  function heading(label: string) { ensure(52); text(label, L, y, 10); y += 26; }
  function tableHeader(recurring: boolean) {
    text("S E R V I Ç O", L, y, 6.6, regular, muted); text("D E S C R I Ç Ã O", 232, y, 6.6, regular, muted);
    right(recurring ? "V A L O R / C I C L O" : "V A L O R", y, 6.6); y += 17; rule(y); y += 9;
  }
  function table(items: QuoteDocumentModel["projectItems"], recurring = false) {
    ensure(55); tableHeader(recurring);
    if (!items.length) { paragraph(recurring ? "Sem serviços recorrentes neste orçamento." : "Sem serviços de pagamento único neste orçamento.", 8.5, muted); return; }
    for (const item of items) {
      const name = [item.name, item.quantity !== 1 ? `Quantidade: ${item.quantity}` : "", item.category].filter(Boolean).join("\n");
      const detail = [item.description, recurring ? `Periodicidade: ${BILLING_LABELS[item.interval]}` : ""].filter(Boolean).join("\n") || "-";
      const columns = [wrap(name, 150, 8.4), wrap(detail, 190, 8.4), wrap(money(item.amountCents), 95, 8.4)];
      let offset = 0; const length = Math.max(...columns.map((column) => column.length));
      while (offset < length) {
        if (y + 25 > bottom) { newPage(); tableHeader(recurring); }
        const count = Math.min(length - offset, Math.max(1, Math.floor((bottom - y - 13) / 12)));
        for (let row = 0; row < count; row++) {
          const top = y + row * 12;
          text(columns[0][offset + row] || "", L, top, 8.4);
          text(columns[1][offset + row] || "", 232, top, 8.4);
          right(columns[2][offset + row] || "", top, 8.4);
        }
        y += count * 12 + 12; rule(y - 4); offset += count;
      }
    }
    y += 4;
  }
  function total(label: string, value: number, strong = false) {
    const labels = wrap(label, 200, strong ? 9 : 8.4, strong ? bold : regular);
    ensure(labels.length * 12 + 12);
    if (strong) { rule(y - 4); }
    labels.forEach((row, index) => text(row, 232, y + index * 12, strong ? 9 : 8.4, strong ? bold : regular));
    right(money(value), y, strong ? 10 : 8.4, strong ? bold : regular); y += labels.length * 12 + 12;
  }

  newPage(); y = 120;
  text("COMPROVATIVO", L, y, 30, bold); text("DE OPERAÇÃO", L, y + 34, 30, bold); y = 214;
  const metadata = [["C L I E N T E", model.company], ["R E F E R Ê N C I A", model.reference], ["D A T A", date(model.issuedOn)]];
  const metadataLines = metadata.map(([, value]) => wrap(value, 145));
  const metadataLabels = () => { metadata.forEach(([label], i) => text(label, L + i * 160, y, 8.2)); y += 20; };
  metadataLabels();
  for (let row = 0; row < Math.max(...metadataLines.map((lines) => lines.length)); row++) {
    if (y + 13 > bottom) { newPage(); metadataLabels(); }
    metadataLines.forEach((lines, i) => text(lines[row] || "", L + i * 160, y)); y += 12;
  }
  y += 18;
  if (model.contact) paragraph(model.contact, 8, muted);
  if (model.validUntil) paragraph(`Válido até ${date(model.validUntil)}.`, 8, muted);
  heading("1  R E S U M O"); paragraph(model.title, 10);
  paragraph(model.summary || `Discriminação do investimento e dos serviços propostos pela AXION a ${model.company}, com referência ${model.reference}.`);
  paragraph(`Valores apresentados em ${model.currency}.`, 8, muted);
  heading("2  I N V E S T I M E N T O  I N I C I A L");
  paragraph("Valores únicos de conceção, desenvolvimento e implementação dos serviços propostos.");
  table(model.projectItems);
  ensure(110 + (model.discountLabels ? wrap(model.discountLabels, contentWidth, 7.5).length * 12.5 : 0));
  total("Subtotal do projeto", model.projectCents);
  if (model.firstCycleCents) total("Primeiro ciclo dos serviços recorrentes", model.firstCycleCents);
  if (model.discountsCents) { total("Descontos no pagamento inicial", -model.discountsCents); }
  total("Total inicial", model.initialNetCents, true);
  if (model.discountLabels) paragraph(`Descontos: ${model.discountLabels}. Aplicados ao pagamento inicial.`, 7.5, muted);

  newPage(); heading("3  C U S T O S  R E C O R R E N T E S");
  paragraph("Serviços recorrentes, cobrados de acordo com a periodicidade indicada em cada linha.");
  table(model.recurringItems, true); ensure(100);
  total("Total mensal equivalente", model.monthlyNetCents, true);
  if (model.commitmentMonths) paragraph(`Período mínimo: ${model.commitmentMonths} meses.`, 8, muted);
  if (model.recurringItems.some((item) => item.interval !== "monthly")) paragraph("O equivalente mensal serve de comparação. A cobrança segue o ciclo indicado (mensal, trimestral, semestral ou anual).", 7.5, muted);
  y += 10; ensure(135); heading("4  R E S U M O  D O  I N V E S T I M E N T O");
  const cards: [string, number, string][] = [["I N I C I A L", model.initialNetCents, "projeto + 1.º ciclo"], ["M E N S A L", model.monthlyNetCents, "equivalente mensal"], ["1 . º  A N O", model.firstYearCents, "estimativa de 12 meses"]];
  cards.forEach(([label, value, caption], index) => {
    const x = L + index * 160;
    page.drawRectangle({ x, y: H - y - 70, width: 145, height: 70, borderColor: lineColor, borderWidth: .6 });
    text(label, x + 12, y + 10, 6.6, regular, muted);
    let size = 16; while (bold.widthOfTextAtSize(money(value), size) > 121 && size > 8) size -= .5;
    text(money(value), x + 12, y + 25, size, bold);
    wrap(caption, 121, 6.8).forEach((row, i) => text(row, x + 12, y + 49 + i * 9, 6.8, regular, muted));
  }); y += 95;
  if (model.performanceItems.length) {
    heading("C O M P O N E N T E  D E  P E R F O R M A N C E");
    paragraph("Valores variáveis, excluídos dos totais garantidos apresentados neste documento.", 8, muted);
    for (const item of model.performanceItems) { ensure(40); paragraph(item.name, 10); paragraph([item.description, item.performance].filter(Boolean).join("\n") || "Condições por definir."); }
  }
  heading("5  C O N D I Ç Õ E S  D E  P A G A M E N T O"); paragraph(model.paymentTerms);
  if (model.notes) { heading("O B S E R V A Ç Õ E S"); paragraph(model.notes); }
  ensure(90); y += 30;
  const clientLines = wrap(`CLIENTE · ${model.company}`, 210, 8.5);
  ensure(Math.max(50, clientLines.length * 12 + 35));
  rule(y, L, L + 212); rule(y, 317, R); text("AXION", L, y + 8, 8.5, bold);
  clientLines.forEach((row, i) => text(row, 317, y + 8 + i * 12, 8.5));
  const signatureY = y + 14 + Math.max(1, clientLines.length) * 12;
  text("A S S I N A T U R A  E  D A T A", L, signatureY, 6.6, regular, muted); text("A S S I N A T U R A  E  D A T A", 317, signatureY, 6.6, regular, muted);
  pdf.getPages().forEach((entry, index) => {
    page = entry; text("axionportugal@gmail.com", L, 788, 9, bold); right("Portugal", 788, 9, bold);
    const counter = `${index + 1} / ${pdf.getPageCount()}`; text(counter, (W - regular.widthOfTextAtSize(counter, 7)) / 2, 790, 7, regular, muted);
  });
  return pdf.save();
}
