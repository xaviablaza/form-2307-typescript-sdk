# Form 2307 TypeScript SDK

Prototype TypeScript SDK for typed BIR Form 2307 validation and deterministic PDF overlay rendering, with a versioned coordinate manifest and a minimal Rust/Axum validation environment.

## Status

This repository is a technical prototype, not production tax, legal, filing, or signature software. The coordinate layout has been visually calibrated against the official January 2018 ENCS v3 form, but production use still requires finance/tax-operator approval, security and privacy review, template-integrity controls, and golden-image testing.

The TypeScript SDK renders PDFs. The Rust `/v1/forms/2307/render` endpoint intentionally returns `501 Not Implemented`; it must not be presented as a production rendering API.

## Implemented capabilities

- strict `Form2307Input` TypeScript types;
- required-field, date, TIN, money, and row-limit validation;
- 14-digit TIN normalization;
- decimal-string money converted to integer centavos with `bigint`;
- row and withholding-section total calculation;
- PDF overlay rendering with caller-supplied official template bytes;
- 10-row mappings for expanded withholding and business-tax withholding;
- canonical, versioned JSON coordinate manifest;
- Rust health, layout, validation, and prototype browser endpoints;
- synthetic two-page sample generation.

## Official template

The official BIR PDF is **not bundled** with this repository. Download Form 2307 January 2018 ENCS v3 from the [official BIR URL](https://bir-cdn.bir.gov.ph/local/pdf/2307%20Jan%202018%20ENCS%20v3.pdf).

Expected SHA-256 at the time of calibration:

```text
eca9476c5f6346939b973e693d35d635f6dd82519b87092c717c21965b0b90f9
```

The inspected template has:

- two pages;
- page dimensions of `612 × 936` PDF points (8.5 × 13 inches);
- no AcroForm fields and no embedded JavaScript.

The SDK rejects templates that do not have two pages or whose first page is not `612 × 936` points. A production system should also enforce the approved template hash or a controlled template-version policy before rendering.

## Requirements

- Node.js 20 or newer
- npm
- Rust 1.88 or newer
- Poppler tools such as `pdfinfo` and `pdftotext` for the optional command-line verification examples

## Install and verify

```bash
npm install
npm run check
npm run build
```

`npm run check` runs the TypeScript type checker, Vitest suite, and Rust tests.

## Generate a synthetic sample

```bash
curl -fsSL \
  'https://bir-cdn.bir.gov.ph/local/pdf/2307%20Jan%202018%20ENCS%20v3.pdf' \
  -o /tmp/form-2307.pdf

sha256sum /tmp/form-2307.pdf
npm run example -- /tmp/form-2307.pdf ./examples/output/sample-2307.pdf
pdfinfo ./examples/output/sample-2307.pdf
pdftotext ./examples/output/sample-2307.pdf -
```

The generated example contains synthetic names, TINs, addresses, and amounts. Files under `examples/output/` are intentionally ignored by Git.

## SDK usage

```ts
import { readFile, writeFile } from "node:fs/promises";
import {
  renderForm2307,
  type Form2307Input
} from "@navegante/form-2307-sdk";

const input: Form2307Input = {
  period: { from: "01/01/2026", to: "03/31/2026" },
  payee: {
    tin: "123-456-789-00000",
    name: "ACME PAYEE INC.",
    registeredAddress: "Makati City",
    zipCode: "1227"
  },
  payor: {
    tin: "987-654-321-00000",
    name: "MOCHI PAYOR INC.",
    registeredAddress: "Taguig City",
    zipCode: "1630"
  },
  expandedWithholding: [{
    incomePaymentDescription: "Professional fees",
    atc: "WI010",
    firstMonthAmount: "1000.00",
    secondMonthAmount: "2000.00",
    thirdMonthAmount: "3000.00",
    taxWithheldForQuarter: "600.00"
  }]
};

const template = await readFile("/tmp/form-2307.pdf");
const completed = await renderForm2307(input, template);
await writeFile("2307.pdf", completed);
```

The SDK validates the payload before modifying the template and throws an error containing structured validation issues when the input is invalid.

## Coordinate model

The canonical manifest is `layout/form-2307.2018-01-ENCS-v3.json`, validated by `layout/form-2307.layout.schema.json`. Coordinates use PDF points with a top-left origin. Rendering converts them to the PDF bottom-left coordinate system using:

```text
pdfY = pageHeight - yTop - boxHeight
```

The layout was calibrated from a 144-DPI raster, where two raster pixels equal one PDF point. Before production approval, use raster-diff fixtures at 144 and 300 DPI covering long names, maximum expected money values, all rows, empty optional fields, and approved signature variants.

Run `node scripts/sync-layout.mjs` after changing the canonical manifest. Package build, typecheck, and test commands run this synchronization automatically.

## Rust web environment

Start the prototype server:

```bash
cargo run --manifest-path crates/server/Cargo.toml
```

Available routes:

- `GET /` — prototype browser page;
- `GET /health` — service status and version;
- `GET /v1/forms/2307/layout` — canonical layout metadata;
- `POST /v1/forms/2307/validate` — JSON payload validation;
- `POST /v1/forms/2307/render` — deliberately unimplemented pending a hardened server renderer.

Example checks:

```bash
curl http://127.0.0.1:8787/health
curl http://127.0.0.1:8787/v1/forms/2307/layout
```

A production service would additionally require authentication, tenant isolation, rate limiting, request IDs, redacted logs, safe template retrieval and caching, explicit retention/deletion rules, and operational monitoring.

## Repository structure

```text
layout/                  canonical coordinate manifest and schema
packages/sdk/            TypeScript SDK source and tests
crates/server/           Rust/Axum prototype environment
examples/                synthetic sample generator
scripts/sync-layout.mjs  validates and synchronizes the layout
```

## Boundaries

The SDK does not:

- determine tax rates or choose ATCs;
- decide whether a taxpayer has a filing obligation;
- sign on behalf of a payor or payee;
- submit documents to BIR;
- replace review by an authorized finance, tax, or legal operator;
- bundle or redistribute the official BIR PDF.

## Provenance and licensing

- Official form source: Bureau of Internal Revenue PDF linked above.
- Related clean-room architecture reference: [`xaviablaza/ebirforms-rebuilt-rs-oss`](https://github.com/xaviablaza/ebirforms-rebuilt-rs-oss).
- No source code from that repository is copied here.
- This prototype is licensed under the [Functional Source License, Version 1.1, ALv2 Future License](LICENSE.md) (`FSL-1.1-ALv2`). Subject to its terms, the future license becomes Apache License 2.0 on the second anniversary of the date a version is made available.
