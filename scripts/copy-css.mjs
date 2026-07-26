import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist", "styles");
mkdirSync(outDir, { recursive: true });
cpSync(join(root, "src", "styles", "index.css"), join(outDir, "index.css"));
