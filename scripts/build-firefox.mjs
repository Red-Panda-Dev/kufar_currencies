import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const firefoxDir = path.join(rootDir, "build", "firefox");
const manifestPath = path.join(rootDir, "manifest.json");

async function copyIfExists(relativePath) {
  const source = path.join(rootDir, relativePath);
  const destination = path.join(firefoxDir, relativePath);
  try {
    await cp(source, destination, { recursive: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function removeAgentsFiles(dir) {
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

async function buildFirefox() {
  await rm(firefoxDir, { recursive: true, force: true });
  await mkdir(firefoxDir, { recursive: true });

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  const copyTargets = ["src", "icons", "examples/nbrb_response.json"];

  await Promise.all(copyTargets.map((target) => copyIfExists(target)));
  await writeFile(
    path.join(firefoxDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await removeAgentsFiles(firefoxDir);
}

buildFirefox();
