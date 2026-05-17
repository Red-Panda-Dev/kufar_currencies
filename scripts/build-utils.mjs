import { execFile } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

const ICON_FILE_RE = /^icon\.svg$|^icon-\d{2,3}\.png$/;

export function buildCopyFilter(src) {
  const parts = src.split(path.sep);
  const iconsIdx = parts.lastIndexOf("icons");
  if (iconsIdx === -1) return true;
  if (iconsIdx === parts.length - 1) return true;
  return ICON_FILE_RE.test(parts[parts.length - 1]);
}

export async function removeAgentsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await removeAgentsFiles(fullPath);
    } else if (entry.name === "AGENTS.md") {
      await rm(fullPath);
    }
  }
}

export async function createZip(sourceDir, outputPath) {
  await rm(outputPath, { force: true });
  await execFileAsync("zip", ["-r", outputPath, "."], { cwd: sourceDir });
}
