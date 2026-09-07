#!/usr/bin/env node

import { cp, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const aliases = {
  utility: "utility-starter",
  "utility-starter": "utility-starter",
  data: "data-backed-starter",
  "data-backed": "data-backed-starter",
  "data-backed-starter": "data-backed-starter",
};

const [, , requestedTemplate, requestedTarget] = process.argv;
const templateName = aliases[requestedTemplate];

if (!templateName || !requestedTarget) {
  console.error("Usage: node scripts/create-starter.mjs <utility|data-backed> <target-directory>");
  process.exit(1);
}

const source = join(root, templateName);
const target = resolve(process.cwd(), requestedTarget);

try {
  await stat(target);
  console.error(`Target already exists: ${target}`);
  process.exit(1);
} catch {
  // Expected: destination should not exist yet.
}

await cp(source, target, { recursive: true, errorOnExist: true, force: false });

const packagePath = join(target, "package.json");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.name = basename(target)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-")
  .replace(/^-+|-+$/g, "") || packageJson.name;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log(`Created ${templateName} at ${target}`);
console.log("Next steps:");
console.log(`  cd ${target}`);
console.log("  npm install");
console.log("  npm run dev");
