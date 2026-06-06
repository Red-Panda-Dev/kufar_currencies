import {
  DISPLAY_CURRENCIES,
  TARGET_CURRENCIES,
  convert,
  formatDate,
  formatConverterResult,
  formatRate,
  formatRateLabel,
  formatTime,
} from "../lib/rates.js";

globalThis.browser ??= globalThis.chrome;

const ALL_DOMAINS_HOST = "__all__";

const DOMAIN_REGISTRY = [
  {
    host: ALL_DOMAINS_HOST,
    label: "Везде",
    supported: false,
    defaultEnabled: false,
    controlsSupportedDomains: true,
  },
  {
    host: "www.kufar.by",
    label: "Основной",
    supported: true,
    defaultEnabled: false,
    displayHost: "kufar.by",
  },
  {
    host: "auto.kufar.by",
    label: "Авто",
    supported: true,
    defaultEnabled: true,
  },
  {
    host: "re.kufar.by",
    label: "Недвижимость",
    supported: true,
    defaultEnabled: true,
  },
  {
    host: "travel.kufar.by",
    label: "Путешествия",
    supported: true,
    defaultEnabled: true,
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
let customRates = null;

function normalizeCurrency(code) {
  return DISPLAY_CURRENCIES.includes(code) ? code : "USD";
}

function normalizeConverterCurrency(code) {
  return TARGET_CURRENCIES.includes(code) ? code : "USD";
}

function migrateDomainSettings(storedSettings) {
  if (!storedSettings || typeof storedSettings !== "object") {
    return storedSettings;
  }
  if (!("__all__" in storedSettings) && "www.kufar.by" in storedSettings) {
    return {
      ...storedSettings,
      __all__: storedSettings["www.kufar.by"],
      "www.kufar.by": false,
    };
  }
  return storedSettings;
}

function mergeDomainSettings(storedSettings) {
  const migrated = migrateDomainSettings(storedSettings);
  const merged = { ...DEFAULT_DOMAIN_SETTINGS };
  if (!migrated || typeof migrated !== "object") {
    return merged;
  }
  for (const item of DOMAIN_REGISTRY) {
    if (typeof migrated[item.host] === "boolean") {
      merged[item.host] = migrated[item.host];
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
  const editBtn = document.createElement("button");

  const isCustom = customRates && code in customRates;
  const displayRate = isCustom ? customRates[code] : rateInfo.rate;

  row.className = "rate-row" + (isCustom ? " rate-row--custom" : "");
  flag.className = "rate-row__flag";
  codeNode.className = "rate-row__code";
  value.className = "rate-row__value";
  editBtn.className = "rate-row__edit";

  flag.textContent = CURRENCY_FLAGS[code] || "";
  codeNode.textContent = code;
  value.textContent = `${formatRate(displayRate)} ${formatRateLabel(
    code,
    rateInfo.scale,
  )}`;
  editBtn.textContent = "✎";
  editBtn.type = "button";
  editBtn.setAttribute("aria-label", `Изменить курс ${code}`);
  editBtn.dataset.currency = code;

  editBtn.addEventListener("click", () => {
    enterRateEditMode(row, code, displayRate);
  });

  row.appendChild(flag);
  row.appendChild(codeNode);
  row.appendChild(value);
  row.appendChild(editBtn);
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

function enterRateEditMode(row, code, currentValue) {
  if (row.classList.contains("rate-row--editing")) {
    return;
  }

  row.classList.add("rate-row--editing");

  const input = document.createElement("input");
  input.className = "rate-row__input";
  input.type = "number";
  input.step = "any";
  input.min = "0.001";
  input.value = currentValue;
  input.setAttribute("aria-label", `Новый курс ${code}`);

  const acceptBtn = document.createElement("button");
  acceptBtn.className = "rate-row__accept";
  acceptBtn.textContent = "✓";
  acceptBtn.type = "button";
  acceptBtn.setAttribute("aria-label", `Сохранить курс ${code}`);

  const dropBtn = document.createElement("button");
  dropBtn.className = "rate-row__drop";
  dropBtn.textContent = "✕";
  dropBtn.type = "button";
  dropBtn.setAttribute("aria-label", `Отменить изменение курса ${code}`);

  const editBtn = row.querySelector(".rate-row__edit");

  let blurSave = true;

  acceptBtn.addEventListener("mousedown", () => {
    blurSave = false;
  });
  dropBtn.addEventListener("mousedown", () => {
    blurSave = false;
  });

  acceptBtn.addEventListener("click", () => {
    saveCustomRateEdit(code, input.value, row);
  });

  dropBtn.addEventListener("click", () => {
    clearCustomRateEdit(code, row);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      blurSave = false;
      saveCustomRateEdit(code, input.value, row);
    } else if (e.key === "Escape") {
      blurSave = false;
      cancelRateEdit(row);
    }
  });

  input.addEventListener("blur", () => {
    if (blurSave) {
      cancelRateEdit(row);
    }
  });

  row.insertBefore(input, editBtn);
  row.insertBefore(acceptBtn, editBtn);
  row.insertBefore(dropBtn, editBtn);
  input.focus();
  input.select();
}

async function saveCustomRateEdit(code, rawValue, row) {
  const rate = Number.parseFloat(rawValue);
  if (!Number.isFinite(rate) || rate <= 0) {
    cancelRateEdit(row);
    return;
  }
  try {
    const response = await browser.runtime.sendMessage({
      action: "saveCustomRate",
      code,
      rate,
    });
    if (response?.ok && response.ratesData) {
      ratesData = response.ratesData;
      if (!customRates) customRates = {};
      customRates[code] = rate;
    }
  } catch {
    // ignore
  }
  renderRates();
  renderConverter();
}

async function clearCustomRateEdit(code, row) {
  try {
    const response = await browser.runtime.sendMessage({
      action: "clearCustomRate",
      code,
    });
    if (response?.ok && response.ratesData) {
      ratesData = response.ratesData;
      if (customRates) delete customRates[code];
      if (customRates && Object.keys(customRates).length === 0) {
        customRates = null;
      }
    }
  } catch {
    // ignore
  }
  renderRates();
  renderConverter();
}

function cancelRateEdit(row) {
  row.classList.remove("rate-row--editing");
  const input = row.querySelector(".rate-row__input");
  const accept = row.querySelector(".rate-row__accept");
  const drop = row.querySelector(".rate-row__drop");
  if (input) input.remove();
  if (accept) accept.remove();
  if (drop) drop.remove();
}

function renderLastUpdated() {
  const node = document.getElementById("lastUpdated");
  if (!ratesData?.fetchedAt) {
    node.textContent = "Обновлено: -";
    return;
  }
  const dateText = formatDate(ratesData.fetchedAt);
  const timeText = formatTime(ratesData.fetchedAt);
  node.textContent = `Обновлено: ${dateText} ${timeText}`;
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
  if (!rateInfo) {
    output.textContent = "-";
    return;
  }
  const effectiveRate = customRates?.[converterCurrency] ?? rateInfo.rate;
  const effectiveRateInfo = { ...rateInfo, rate: effectiveRate };
  const converted = convert(value, effectiveRateInfo);
  const formatted = formatConverterResult(converted);
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
    if (!entry.controlsSupportedDomains) {
      meta.textContent = entry.displayHost || entry.host;
      text.appendChild(meta);
    }

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
  if (
    state.domainSettings &&
    typeof state.domainSettings === "object" &&
    !("__all__" in state.domainSettings)
  ) {
    await browser.storage.local.set({ domainSettings });
  }

  try {
    const response = await browser.runtime.sendMessage({
      action: "getCustomRates",
    });
    if (response?.ok) {
      customRates = response.customRates || null;
    }
  } catch {
    // ignore
  }
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
