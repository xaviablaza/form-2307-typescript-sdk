import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { form2307Layout, type FieldLayout, type TableLayout } from "./layout.js";
import { centavos, formatMoney, normalizeTin, rowTotal, validateForm2307 } from "./validate.js";
import type { Form2307Input, WithholdingRow } from "./types.js";

function drawBoxText(page: PDFPage, font: PDFFont, value: string, field: FieldLayout): void {
  let size = field.fontSize;
  const padding = 2;
  while (size > 5 && font.widthOfTextAtSize(value, size) > field.width - padding * 2) size -= 0.25;
  const textWidth = font.widthOfTextAtSize(value, size);
  const x = field.align === "center" ? field.x + (field.width - textWidth) / 2 : field.align === "right" ? field.x + field.width - textWidth - padding : field.x + padding;
  const y = form2307Layout.page.height - field.y - field.height + Math.max(2, (field.height - size) / 2);
  page.drawText(value, { x, y, size, font, color: rgb(0, 0, 0), maxWidth: field.width - padding * 2 });
}

function drawTin(page: PDFPage, font: PDFFont, tin: string, field: FieldLayout): void {
  const digits = normalizeTin(tin);
  let offset = 0;
  for (const segment of field.segments ?? []) {
    const value = digits.slice(offset, offset + segment.digits);
    drawBoxText(page, font, value, { ...field, x: segment.x, width: segment.width, align: "center" });
    offset += segment.digits;
  }
}

function drawTable(page: PDFPage, font: PDFFont, rows: WithholdingRow[], table: TableLayout): void {
  rows.slice(0, table.rowCount).forEach((row, index) => {
    const y = table.firstRowY + table.rowHeight * index;
    const values: Record<string, string> = {
      description: row.incomePaymentDescription,
      atc: row.atc,
      month1: formatMoney(centavos(row.firstMonthAmount)),
      month2: formatMoney(centavos(row.secondMonthAmount)),
      month3: formatMoney(centavos(row.thirdMonthAmount)),
      total: formatMoney(rowTotal(row)),
      taxWithheld: formatMoney(centavos(row.taxWithheldForQuarter))
    };
    for (const [name, column] of Object.entries(table.columns)) {
      drawBoxText(page, font, values[name] ?? "", { x: column.x, y, width: column.width, height: table.rowHeight, kind: "text", fontSize: name === "description" ? 5.5 : 5.25, align: ["month1","month2","month3","total","taxWithheld"].includes(name) ? "right" : "left" });
    }
  });
  const totals = { month1: 0n, month2: 0n, month3: 0n, total: 0n, taxWithheld: 0n };
  for (const row of rows) {
    totals.month1 += centavos(row.firstMonthAmount); totals.month2 += centavos(row.secondMonthAmount); totals.month3 += centavos(row.thirdMonthAmount); totals.total += rowTotal(row); totals.taxWithheld += centavos(row.taxWithheldForQuarter);
  }
  for (const name of Object.keys(totals) as Array<keyof typeof totals>) {
    const column = table.columns[name]; if (!column) continue;
    drawBoxText(page, font, formatMoney(totals[name]), { x: column.x, y: table.totalY, width: column.width, height: table.rowHeight, kind: "money", fontSize: 5.5, align: "right" });
  }
}

export async function renderForm2307(input: Form2307Input, officialTemplateBytes: Uint8Array): Promise<Uint8Array> {
  const validation = validateForm2307(input);
  if (!validation.valid) throw new Error(`Invalid Form 2307 input: ${JSON.stringify(validation.issues)}`);
  const pdf = await PDFDocument.load(officialTemplateBytes);
  if (pdf.getPageCount() !== 2) throw new Error("Expected the two-page January 2018 ENCS v3 template.");
  const page = pdf.getPage(0);
  const { width, height } = page.getSize();
  if (width !== 612 || height !== 936) throw new Error(`Unexpected template size: ${width}x${height}.`);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fields = form2307Layout.fields;
  drawBoxText(page, font, input.period.from, fields["period.from"]!); drawBoxText(page, font, input.period.to, fields["period.to"]!);
  drawTin(page, font, input.payee.tin, fields["payee.tin"]!); drawBoxText(page, font, input.payee.name, fields["payee.name"]!); drawBoxText(page, font, input.payee.registeredAddress, fields["payee.registeredAddress"]!); drawBoxText(page, font, input.payee.zipCode, fields["payee.zipCode"]!);
  if (input.payee.foreignAddress) drawBoxText(page, font, input.payee.foreignAddress, fields["payee.foreignAddress"]!);
  drawTin(page, font, input.payor.tin, fields["payor.tin"]!); drawBoxText(page, font, input.payor.name, fields["payor.name"]!); drawBoxText(page, font, input.payor.registeredAddress, fields["payor.registeredAddress"]!); drawBoxText(page, font, input.payor.zipCode, fields["payor.zipCode"]!);
  const cert = input.certification;
  for (const party of ["payor", "payee"] as const) {
    const values = cert?.[party]; if (!values) continue;
    for (const key of ["signatureName", "accreditationNo", "issueDate", "expiryDate"] as const) {
      const value = values[key]; if (value) drawBoxText(page, font, value, fields[`certification.${party}.${key}`]!);
    }
  }
  drawTable(page, font, input.expandedWithholding, form2307Layout.tables.expandedWithholding!);
  drawTable(page, font, input.businessTaxWithholding ?? [], form2307Layout.tables.businessTaxWithholding!);
  pdf.setTitle("BIR Form 2307 – Certificate of Creditable Tax Withheld at Source");
  pdf.setSubject(`Generated with layout ${form2307Layout.version}`);
  return pdf.save({ useObjectStreams: false });
}
