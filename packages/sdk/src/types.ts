export type DecimalString = `${number}`;

export interface Party {
  tin: string;
  name: string;
  registeredAddress: string;
  zipCode: string;
  foreignAddress?: string;
}

export interface WithholdingRow {
  incomePaymentDescription: string;
  atc: string;
  firstMonthAmount: DecimalString;
  secondMonthAmount: DecimalString;
  thirdMonthAmount: DecimalString;
  taxWithheldForQuarter: DecimalString;
}

export interface CertificationParty {
  signatureName?: string;
  accreditationNo?: string;
  issueDate?: string;
  expiryDate?: string;
}

export interface Form2307Input {
  period: { from: string; to: string };
  payee: Party;
  payor: Party;
  expandedWithholding: WithholdingRow[];
  businessTaxWithholding?: WithholdingRow[];
  certification?: {
    payor?: CertificationParty;
    payee?: CertificationParty;
  };
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
