import { parseRates } from "./lib/rates.js";

globalThis.browser ??= globalThis.chrome;

export const NBRB_URL = "https://api.nbrb.by/exrates/rates?periodicity=0";
export const REFRESH_MINUTES = 240;
export const FETCH_TIMEOUT_MS = 15000;

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

export function mergeCustomRates(ratesData, customRates) {
  if (!customRates || typeof customRates !== "object") {
    return ratesData;
  }
  const keys = Object.keys(customRates);
  if (keys.length === 0) {
    return ratesData;
  }
  const merged = { ...ratesData };
  const rates = { ...merged.rates };
  for (const code of keys) {
    if (rates[code] && Number.isFinite(customRates[code])) {
      rates[code] = { ...rates[code], rate: customRates[code] };
    }
  }
  merged.rates = rates;
  return merged;
}

export async function fetchRatesFromNbrb() {
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
    const { customRates } = await browser.storage.local.get(["customRates"]);
    const merged = mergeCustomRates(ratesData, customRates);
    await browser.storage.local.set({ ratesData: merged, lastError: null });
    return merged;
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

export async function refreshRates({ force = false } = {}) {
  if (!force && fetchInProgress) {
    return fetchInProgress;
  }

  fetchInProgress = fetchRatesFromNbrb().finally(() => {
    fetchInProgress = null;
  });

  return fetchInProgress;
}

export async function ensureRates() {
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

  if (action === "getCustomRates") {
    return browser.storage.local
      .get(["customRates"])
      .then(({ customRates = null }) => ({ ok: true, customRates }));
  }

  if (action === "saveCustomRate") {
    const { code, rate } = message;
    if (typeof code !== "string" || !Number.isFinite(rate) || rate <= 0) {
      return Promise.resolve({ ok: false });
    }
    return browser.storage.local
      .get(["customRates", "ratesData"])
      .then(({ customRates = {}, ratesData }) => {
        const updated = { ...customRates, [code]: rate };
        const merged = mergeCustomRates(ratesData, updated);
        return browser.storage.local
          .set({ customRates: updated, ratesData: merged })
          .then(() => ({ ok: true, ratesData: merged }));
      });
  }

  if (action === "clearCustomRate") {
    const { code } = message;
    if (typeof code !== "string") {
      return Promise.resolve({ ok: false });
    }
    return browser.storage.local
      .get(["customRates", "ratesData"])
      .then(({ customRates, ratesData }) => {
        if (!customRates || typeof customRates !== "object") {
          return { ok: true, ratesData };
        }
        const updated = { ...customRates };
        delete updated[code];
        const toStore = Object.keys(updated).length === 0 ? null : updated;
        const merged = mergeCustomRates(ratesData, toStore);
        return browser.storage.local
          .set({ customRates: toStore, ratesData: merged })
          .then(() => ({ ok: true, ratesData: merged }));
      });
  }

  return undefined;
});
