import type { Form2307Input, ValidationIssue, ValidationResult, WithholdingRow } from "./types.js";

const DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const MONEY = /^-?\d+(?:\.\d{1,2})?$/;

export const normalizeTin = (value: string): string => value.replace(/\D/g, "");
export const normalizeDate = (value: string): string => value.trim();

export function centavos(value: string): bigint {
  if (!MONEY.test(value)) throw new Error(`Invalid money value: ${value}`);
  const negative = value.startsWith("-");
  const [wholeRaw, fractionRaw = ""] = value.replace("-", "").split(".");
  const result = BigInt(wholeRaw!) * 100n + BigInt(fractionRaw.padEnd(2, "0"));
  return negative ? -result : result;
}

export function formatMoney(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, "0");
  return `${negative ? "-" : ""}${whole.toLocaleString("en-US")}.${fraction}`;
}

export function rowTotal(row: WithholdingRow): bigint {
  return centavos(row.firstMonthAmount) + centavos(row.secondMonthAmount) + centavos(row.thirdMonthAmount);
}

export function validateForm2307(input: Form2307Input): ValidationResult {
  const issues: ValidationIssue[] = [];
  const issue = (path: string, message: string) => issues.push({ path, message });

  if (!DATE.test(input.period.from)) issue("period.from", "Use MM/DD/YYYY.");
  if (!DATE.test(input.period.to)) issue("period.to", "Use MM/DD/YYYY.");
  for (const [name, party] of [["payee", input.payee], ["payor", input.payor]] as const) {
    if (normalizeTin(party.tin).length !== 14) issue(`${name}.tin`, "TIN must contain 14 digits (3-3-3-5). Use trailing 00000 when applicable.");
    if (!party.name.trim()) issue(`${name}.name`, "Name is required.");
    if (!party.registeredAddress.trim()) issue(`${name}.registeredAddress`, "Registered address is required.");
    if (!/^\d{4}$/.test(party.zipCode)) issue(`${name}.zipCode`, "ZIP code must contain four digits.");
  }

  const validateRows = (path: string, rows: WithholdingRow[] | undefined) => {
    if (!rows) return;
    if (rows.length > 10) issue(path, "The official page has at most 10 rows; use an approved attachment for overflow.");
    rows.forEach((row, index) => {
      if (!row.incomePaymentDescription.trim()) issue(`${path}.${index}.incomePaymentDescription`, "Description is required.");
      if (!row.atc.trim()) issue(`${path}.${index}.atc`, "ATC is required.");
      for (const key of ["firstMonthAmount", "secondMonthAmount", "thirdMonthAmount", "taxWithheldForQuarter"] as const) {
        try { centavos(row[key]); } catch { issue(`${path}.${index}.${key}`, "Use a decimal string with at most two decimal places."); }
      }
    });
  };
  validateRows("expandedWithholding", input.expandedWithholding);
  validateRows("businessTaxWithholding", input.businessTaxWithholding);
  return { valid: issues.length === 0, issues };
}
