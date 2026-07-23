import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { renderForm2307, type Form2307Input } from "../packages/sdk/src/index.js";

const template = process.argv[2] ?? resolve("../work/form2307/form-2307.pdf");
const output = process.argv[3] ?? resolve("examples/output/sample-2307.pdf");
const input: Form2307Input = {
  period: { from: "01/01/2026", to: "03/31/2026" },
  payee: { tin: "123-456-789-00000", name: "ACME PAYEE CORPORATION", registeredAddress: "7F Example Center, Salcedo Village, Makati City", zipCode: "1227" },
  payor: { tin: "987-654-321-00000", name: "MOCHI SAMPLE PAYOR INC.", registeredAddress: "Bonifacio Global City, Taguig", zipCode: "1630" },
  expandedWithholding: [
    { incomePaymentDescription: "Professional fees", atc: "WI010", firstMonthAmount: "10000.00", secondMonthAmount: "12000.00", thirdMonthAmount: "8000.00", taxWithheldForQuarter: "3000.00" },
    { incomePaymentDescription: "Rental", atc: "WI100", firstMonthAmount: "5000.00", secondMonthAmount: "5000.00", thirdMonthAmount: "5000.00", taxWithheldForQuarter: "750.00" }
  ],
  certification: { payor: { signatureName: "SAMPLE ONLY — NOT FOR FILING" } }
};
async function main(): Promise<void> {
  await mkdir(resolve(output, ".."), { recursive: true });
  const result = await renderForm2307(input, await readFile(template));
  await writeFile(output, result);
  console.log(`Wrote ${result.length} bytes to ${output}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
