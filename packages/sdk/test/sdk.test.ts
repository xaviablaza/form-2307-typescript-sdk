import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { centavos, formatMoney, form2307Layout, normalizeTin, renderForm2307, rowTotal, validateForm2307, type Form2307Input } from "../src/index.js";

const valid: Form2307Input = {
  period: { from: "01/01/2026", to: "03/31/2026" },
  payee: { tin: "123-456-789-00000", name: "ACME PAYEE INC.", registeredAddress: "Makati City", zipCode: "1227" },
  payor: { tin: "987-654-321-00000", name: "MOCHI PAYOR INC.", registeredAddress: "Taguig City", zipCode: "1630" },
  expandedWithholding: [{ incomePaymentDescription: "Professional fees", atc: "WI010", firstMonthAmount: "1000.00", secondMonthAmount: "2000.00", thirdMonthAmount: "3000.00", taxWithheldForQuarter: "600.00" }]
};

describe("Form 2307 domain", () => {
  it("uses the inspected official page geometry and hash", () => {
    expect(form2307Layout.page).toEqual({ number: 1, width: 612, height: 936 });
    expect(form2307Layout.templateSha256).toBe("eca9476c5f6346939b973e693d35d635f6dd82519b87092c717c21965b0b90f9");
    expect(form2307Layout.tables.expandedWithholding?.rowCount).toBe(10);
    expect(form2307Layout.fields["period.from"]?.segments?.map(({ digits }) => digits)).toEqual([2, 2, 4]);
    expect(form2307Layout.fields["payee.tin"]?.segments?.map(({ digits }) => digits)).toEqual([3, 3, 3, 5]);
    expect(form2307Layout.fields["payee.zipCode"]?.segments?.map(({ digits }) => digits)).toEqual([1, 1, 1, 1]);
  });
  it("normalizes TINs and performs money arithmetic without floating point", () => {
    expect(normalizeTin("123-456-789-00000")).toBe("12345678900000");
    expect(centavos("1234.56")).toBe(123456n);
    expect(formatMoney(123456n)).toBe("1,234.56");
    expect(rowTotal(valid.expandedWithholding[0]!)).toBe(600000n);
  });
  it("validates a complete input and rejects row overflow", () => {
    expect(validateForm2307(valid)).toEqual({ valid: true, issues: [] });
    expect(validateForm2307({ ...valid, expandedWithholding: Array(11).fill(valid.expandedWithholding[0]!) }).valid).toBe(false);
  });
  it("renders a validated payload onto a two-page 612 × 936 template", async () => {
    const template = await PDFDocument.create();
    template.addPage([612, 936]);
    template.addPage([612, 936]);

    const output = await renderForm2307(valid, await template.save());
    const rendered = await PDFDocument.load(output);

    expect(rendered.getPageCount()).toBe(2);
    expect(rendered.getPage(0).getSize()).toEqual({ width: 612, height: 936 });
    expect(rendered.getTitle()).toBe("BIR Form 2307 – Certificate of Creditable Tax Withheld at Source");
    expect(rendered.getSubject()).toBe(`Generated with layout ${form2307Layout.version}`);
    expect(output.byteLength).toBeGreaterThan(2_000);
  });
});
