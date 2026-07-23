import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const here = new URL(".", import.meta.url);
copyFileSync(fileURLToPath(new URL("../layout/form-2307.2018-01-ENCS-v3.json", here)), fileURLToPath(new URL("../packages/sdk/src/form-2307.2018-01-ENCS-v3.json", here)));
