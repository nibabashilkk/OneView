import { readFile } from "node:fs/promises";

const requestedTag = (process.argv[2] || "").trim();
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const tauri = JSON.parse(await readFile("src-tauri/tauri.conf.json", "utf8"));
const cargo = await readFile("src-tauri/Cargo.toml", "utf8");
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = {
  "package.json": pkg.version,
  "src-tauri/tauri.conf.json": tauri.version,
  "src-tauri/Cargo.toml": cargoVersion,
};

const unique = new Set(Object.values(versions));
if (unique.size !== 1 || unique.has(undefined)) {
  console.error("Project version mismatch:");
  for (const [file, value] of Object.entries(versions)) console.error(`  ${file}: ${value ?? "<missing>"}`);
  process.exit(1);
}

const version = pkg.version;
if (requestedTag) {
  const tagVersion = requestedTag.startsWith("v") ? requestedTag.slice(1) : requestedTag;
  if (tagVersion !== version) {
    console.error(`Release tag ${requestedTag} does not match project version ${version}.`);
    process.exit(1);
  }
}

console.log(`Version check OK: ${requestedTag || `v${version}`} (${version})`);
