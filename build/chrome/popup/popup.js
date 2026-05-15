import {
  DISPLAY_CURRENCIES,
  TARGET_CURRENCIES,
  convert,
  formatDate,
  formatDisplayPrice,
  formatRate,
  formatRateLabel,
  formatTime,
} from "../lib/rates.js";

globalThis.browser ??= globalThis.chrome;

const ALL_DOMAINS_HOST = "www.kufar.by";

const DOMAIN_REGISTRY = [
  {
    host: "auto.kufar.by",
    label: "Авто",
    supported: true,
    defaultEnabled: true,
  },
  {
    host: ALL_DOMAINS_HOST,
    label: "везде",
    displayHost: "kufar.by",
    supported: false,
    defaultEnabled: false,
    controlsSupportedDomains: true,
  },
  {
    host: "re.kufar.by",
    label: "Недвижимость",
    supported: false,
    defaultEnabled: false,
  },
  {
    host: "travel.kufar.by",
    label: "Путешествия",
    supported: false,
    defaultEnabled: false,
  },
  {
    host: "kufar.by",
    label: "Куфар (основной)",
    supported: false,
    defaultEnabled: false,
  },
];

const CURRENCY_FLAGS = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  RUB: "🇷🇺",
};

const DEFAULT_DOMAIN_SETTINGS = DOMAIN_REGISTRY.reduce((result, item) => {
  result[item.host] = item.defaultEnabled;
  return result;
}, {});

let ratesData = null;
let lastError = null;
let selectedCurrency = "USD";
let converterCurrency = "USD";
let domainSettings = { ...DEFAULT_DOMAIN_SETTINGS };
let isLoading = false;

function normalizeCurrency(code) {
  return DISPLAY_CURRENCIES.includes(code) ? code : "USD";
}

function normalizeConverterCurrency(code) {
  return TARGET_CURRENCIES.includes(code) ? code : "USD";
}

function mergeDomainSettings(storedSettings) {
  const merged = { ...DEFAULT_DOMAIN_SETTINGS };
  if (!storedSettings || typeof storedSettings !== "object") {
    return merged;
  }
  for (const item of DOMAIN_REGISTRY) {
    if (typeof storedSettings[item.host] === "boolean") {
      merged[item.host] = storedSettings[item.host];
    }
  }
  return merged;
}

function setHidden(id, hidden) {
  document.getElementById(id).hidden = hidden;
}

function hasRates() {
  return Boolean(ratesData?.rates);
}

function isDomainCheckboxDisabled(entry) {
  return !entry.supported && !entry.controlsSupportedDomains;
}

function syncAllDomainsSetting(settings) {
  const enabledDomains = DOMAIN_REGISTRY.filter(
    (entry) =>
      entry.host !== ALL_DOMAINS_HOST && !isDomainCheckboxDisabled(entry),
  );
  if (enabledDomains.length === 0) {
    return settings;
  }
  return {
    ...settings,
    [ALL_DOMAINS_HOST]: enabledDomains.every((entry) => settings[entry.host]),
  };
}

function renderDataState() {
  const ratesAvailable = hasRates();
  const message = lastError?.message || "";
  const status = document.getElementById("statusText");
  const errorText = document.getElementById("errorText");

  setHidden("loading", !isLoading || ratesAvailable);
  setHidden("rates-section", !ratesAvailable);
  setHidden("converter-section", !ratesAvailable);
  setHidden("error-section", !message || ratesAvailable || isLoading);

  errorText.textContent = message;
  status.classList.toggle(
    "header__status--warning",
    ratesAvailable && Boolean(message) && !isLoading,
  );

  if (isLoading && ratesAvailable) {
    status.textContent = "Обновление...";
  } else if (ratesAvailable && message) {
    status.textContent = "Показаны сохраненные данные";
  } else {
    status.textContent = "";
  }
}

function createRateRow(code, rateInfo) {
  const row = document.createElement("div");
  const flag = document.createElement("span");
  const codeNode = document.createElement("span");
  const value = document.createElement("span");

  row.className = "rate-row";
  flag.className = "rate-row__flag";
  codeNode.className = "rate-row__code";
  value.className = "rate-row__value";

  flag.textContent = CURRENCY_FLAGS[code] || "";
  codeNode.textContent = code;
  value.textContent = `${formatRate(rateInfo.rate)} ${formatRateLabel(
    code,
    rateInfo.scale,
  )}`;

  row.appendChild(flag);
  row.appendChild(codeNode);
  row.appendChild(value);
  return row;
}

function renderRates() {
  const list = document.getElementById("ratesList");
  list.textContent = "";

  if (!ratesData?.rates) {
    return;
  }

  for (const code of TARGET_CURRENCIES) {
    const rateInfo = ratesData.rates[code];
    if (!rateInfo) {
      continue;
    }
    list.appendChild(createRateRow(code, rateInfo));
  }
}

function renderLastUpdated() {
  const node = document.getElementById("lastUpdated");
  if (!ratesData?.fetchedAt) {
    node.textContent = "Обновлено: -";
    return;
  }
  const dateText = formatDate(ratesData.fetchedAt);
  const timeText = formatTime(ratesData.fetchedAt);
  node.textContent = `Обновлено: ${dateText}, ${timeText}`;
}

function renderConverter() {
  const input = document.getElementById("converterInput");
  const output = document.getElementById("converterOutput");
  const value = Number.parseFloat(input.value);

  if (!Number.isFinite(value)) {
    output.textContent = "-";
    return;
  }

  const rateInfo = ratesData?.rates?.[converterCurrency];
  const converted = convert(value, rateInfo);
  const formatted = formatDisplayPrice(converted, "BYN");
  output.textContent = formatted || "-";
}

function renderSelectedCurrency() {
  document.getElementById("selectedCurrency").value = selectedCurrency;
}

function renderConverterCurrency() {
  document.getElementById("converterCurrency").value = converterCurrency;
}

function renderDomains() {
  const list = document.getElementById("domainList");
  list.textContent = "";

  for (const entry of DOMAIN_REGISTRY) {
    const li = document.createElement("li");
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const text = document.createElement("span");
    const meta = document.createElement("span");

    li.className = "domain-list__item";
    label.className = "domain-list__label";
    checkbox.className = "domain-list__checkbox";
    meta.className = "domain-list__meta";

    checkbox.type = "checkbox";
    checkbox.checked = Boolean(domainSettings[entry.host]);
    checkbox.dataset.host = entry.host;
    checkbox.disabled = isDomainCheckboxDisabled(entry);

    text.textContent = entry.label;
    meta.textContent = entry.displayHost || entry.host;
    text.appendChild(meta);

    label.appendChild(checkbox);
    label.appendChild(text);
    li.appendChild(label);

    if (isDomainCheckboxDisabled(entry)) {
      const note = document.createElement("span");
      note.className = "domain-note";
      note.textContent = "планируется";
      li.appendChild(note);
    }

    list.appendChild(li);
  }
}

function renderApp() {
  renderDataState();
  renderRates();
  renderLastUpdated();
  renderSelectedCurrency();
  renderConverterCurrency();
  renderDomains();
  renderConverter();
}

function fillCurrencySelects() {
  const selectedCurrencyNode = document.getElementById("selectedCurrency");
  const converterCurrencyNode = document.getElementById("converterCurrency");

  for (const code of DISPLAY_CURRENCIES) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    selectedCurrencyNode.appendChild(option);
  }

  for (const code of TARGET_CURRENCIES) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    converterCurrencyNode.appendChild(option);
  }
}

async function readStoredState() {
  const state = await browser.storage.local.get([
    "ratesData",
    "lastError",
    "selectedCurrency",
    "domainSettings",
  ]);
  ratesData = state.ratesData || null;
  lastError = state.lastError || null;
  selectedCurrency = normalizeCurrency(state.selectedCurrency);
  converterCurrency = normalizeConverterCurrency(
    selectedCurrency === "BYN" ? converterCurrency : selectedCurrency,
  );
  domainSettings = mergeDomainSettings(state.domainSettings);
}

async function ensureInitialRates() {
  if (hasRates()) {
    return;
  }

  isLoading = true;
  renderApp();

  try {
    const response = await browser.runtime.sendMessage({
      action: "ensureRates",
    });
    if (response?.ratesData) {
      ratesData = response.ratesData;
      lastError = null;
    }
  } catch (error) {
    lastError = { message: String(error?.message || error) };
  } finally {
    const fresh = await browser.storage.local.get(["ratesData", "lastError"]);
    ratesData = fresh.ratesData || ratesData;
    lastError = fresh.lastError || lastError;
    isLoading = false;
    renderApp();
  }
}

function bindEvents() {
  document.getElementById("converterInput").addEventListener("input", () => {
    renderConverter();
  });

  document
    .getElementById("converterCurrency")
    .addEventListener("change", (event) => {
      converterCurrency = normalizeConverterCurrency(event.target.value);
      renderConverterCurrency();
      renderConverter();
    });

  document
    .getElementById("selectedCurrency")
    .addEventListener("change", async (event) => {
      selectedCurrency = normalizeCurrency(event.target.value);
      await browser.storage.local.set({ selectedCurrency });

      if (selectedCurrency !== "BYN") {
        converterCurrency = normalizeConverterCurrency(selectedCurrency);
      }

      renderSelectedCurrency();
      renderConverterCurrency();
      renderConverter();
    });

  document
    .getElementById("domainList")
    .addEventListener("change", async (event) => {
      const target = event.target;
      if (!target || target.type !== "checkbox") {
        return;
      }

      const host = target.dataset.host;
      const item = DOMAIN_REGISTRY.find((entry) => entry.host === host);
      if (!item || isDomainCheckboxDisabled(item)) {
        return;
      }

      if (item.controlsSupportedDomains) {
        domainSettings = { ...domainSettings, [host]: target.checked };
        for (const entry of DOMAIN_REGISTRY) {
          if (entry.host !== host && !isDomainCheckboxDisabled(entry)) {
            domainSettings[entry.host] = target.checked;
          }
        }
      } else {
        domainSettings = syncAllDomainsSetting({
          ...domainSettings,
          [host]: target.checked,
        });
      }
      await browser.storage.local.set({ domainSettings });
      renderDomains();
    });

  document
    .getElementById("refreshButton")
    .addEventListener("click", async () => {
      const button = document.getElementById("refreshButton");
      button.disabled = true;
      isLoading = true;
      renderApp();

      try {
        const response = await browser.runtime.sendMessage({
          action: "refreshRates",
        });
        if (response?.ratesData) {
          ratesData = response.ratesData;
          lastError = null;
        }
      } catch (error) {
        lastError = { message: String(error?.message || error) };
      } finally {
        const fresh = await browser.storage.local.get([
          "ratesData",
          "lastError",
        ]);
        ratesData = fresh.ratesData || ratesData;
        lastError = fresh.lastError || lastError;
        isLoading = false;
        button.disabled = false;
        renderApp();
      }
    });
}

async function init() {
  fillCurrencySelects();
  await readStoredState();
  bindEvents();
  renderApp();
  await ensureInitialRates();
}

init();
