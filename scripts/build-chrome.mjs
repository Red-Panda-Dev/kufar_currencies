import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const chromeDir = path.join(rootDir, "build", "chrome");
const manifestPath = path.join(rootDir, "manifest.json");

async function copyIfExists(relativePath) {
  const source = path.join(rootDir, relativePath);
  const destination = path.join(chromeDir, relativePath);
  try {
    await cp(source, destination, { recursive: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function buildChrome() {
  await rm(chromeDir, { recursive: true, force: true });
  await mkdir(chromeDir, { recursive: true });

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  delete manifest.browser_specific_settings;

  const backgroundScripts = manifest.background?.scripts;
  if (Array.isArray(backgroundScripts) && backgroundScripts[0]) {
    manifest.background = {
      service_worker: backgroundScripts[0],
      type: manifest.background.type ?? "module",
    };
  }

  const copyTargets = ["src", "icons", "examples/nbrb_response.json"];

  await Promise.all(copyTargets.map((target) => copyIfExists(target)));
  await writeFile(
    path.join(chromeDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  const chromeInstallNotes = [
    "Kufar.by Валюты (Chrome build)",
    "",
    "1. Open chrome://extensions",
    "2. Enable Developer mode",
    "3. Click Load unpacked",
    "4. Select build/chrome",
  ].join("\n");

  await writeFile(
    path.join(chromeDir, "README_CHROME_INSTALL.txt"),
    `${chromeInstallNotes}\n`,
  );
}

buildChrome();
