import { parseRates } from "./lib/rates.js";

globalThis.browser ??= globalThis.chrome;

const NBRB_URL = "https://api.nbrb.by/exrates/rates?periodicity=0";
const REFRESH_MINUTES = 240;
const FETCH_TIMEOUT_MS = 15000;

let fetchInProgress = null;

function buildRatesData(parsed) {
  return {
    base: "BYN",
    source: "NBRB",
    sourceUrl: NBRB_URL,
    fetchedAt: Date.now(),
    ratesDate: parsed.ratesDate,
    rates: parsed.rates,
  };
}

async function fetchRatesFromNbrb() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(NBRB_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`NBRB request failed: ${response.status}`);
    }

    const data = await response.json();
    const parsed = parseRates(data);
    if (!parsed) {
      throw new Error("Некорректный ответ НБРБ");
    }

    const ratesData = buildRatesData(parsed);
    await browser.storage.local.set({ ratesData, lastError: null });
    return ratesData;
  } catch (error) {
    const message =
      error?.name === "AbortError"
        ? "Превышено время ожидания"
        : String(error?.message || error);
    await browser.storage.local.set({
      lastError: {
        message,
        at: Date.now(),
      },
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshRates({ force = false } = {}) {
  if (!force && fetchInProgress) {
    return fetchInProgress;
  }

  fetchInProgress = fetchRatesFromNbrb().finally(() => {
    fetchInProgress = null;
  });

  return fetchInProgress;
}

async function ensureRates() {
  const { ratesData } = await browser.storage.local.get(["ratesData"]);
  if (ratesData) {
    return ratesData;
  }
  return refreshRates();
}

browser.runtime.onInstalled.addListener(() => {
  browser.alarms.create("refreshRates", { periodInMinutes: REFRESH_MINUTES });
  refreshRates().catch(() => {});
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm?.name !== "refreshRates") {
    return;
  }
  refreshRates().catch(() => {});
});

browser.runtime.onMessage.addListener((message) => {
  const action = message?.action;

  if (action === "getRates") {
    return browser.storage.local.get(["ratesData", "lastError"]);
  }

  if (action === "refreshRates") {
    return refreshRates({ force: true }).then(
      (ratesData) => ({ ok: true, ratesData }),
      () => ({ ok: false }),
    );
  }

  if (action === "ensureRates") {
    return ensureRates().then(
      (ratesData) => ({ ok: true, ratesData }),
      () => ({ ok: false }),
    );
  }

  return undefined;
});
