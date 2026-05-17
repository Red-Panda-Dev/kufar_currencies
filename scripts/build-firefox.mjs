import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  removeAgentsFiles,
  createZip,
  buildCopyFilter,
} from "./build-utils.mjs";

const rootDir = process.cwd();
const firefoxDir = path.join(rootDir, "build", "firefox");
const manifestPath = path.join(rootDir, "manifest.json");
const EXT_NAME = "kufar-currencies";

async function copyIfExists(relativePath) {
  const source = path.join(rootDir, relativePath);
  const destination = path.join(firefoxDir, relativePath);
  try {
    await cp(source, destination, {
      recursive: true,
      filter: buildCopyFilter,
    });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function buildFirefox() {
  await rm(firefoxDir, { recursive: true, force: true });
  await mkdir(firefoxDir, { recursive: true });

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  const copyTargets = ["src", "icons"];

  await Promise.all(copyTargets.map((target) => copyIfExists(target)));
  await writeFile(
    path.join(firefoxDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await removeAgentsFiles(firefoxDir);

  await createZip(firefoxDir, path.join(rootDir, `${EXT_NAME}-firefox.zip`));
}

buildFirefox();
