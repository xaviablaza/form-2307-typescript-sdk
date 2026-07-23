import layoutJson from "./form-2307.2018-01-ENCS-v3.json" with { type: "json" };

export interface FieldLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: string;
  fontSize: number;
  align?: "left" | "center" | "right";
  segments?: Array<{ x: number; width: number; digits: number }>;
}

export interface ColumnLayout { x: number; width: number }
export interface TableLayout {
  rowCount: number;
  firstRowY: number;
  rowHeight: number;
  totalY: number;
  columns: Record<string, ColumnLayout>;
}

export const form2307Layout = layoutJson as unknown as {
  form: string;
  version: string;
  sourceUrl: string;
  templateSha256: string;
  page: { number: number; width: number; height: number };
  fields: Record<string, FieldLayout>;
  tables: Record<string, TableLayout>;
  calibration: { status: string };
};
