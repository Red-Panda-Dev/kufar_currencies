(function initKufarCurrencyContentScript() {
  globalThis.browser ??= globalThis.chrome;

  const DOMAIN_REGISTRY = [
    { host: "www.kufar.by", supported: false, defaultEnabled: false },
    { host: "auto.kufar.by", supported: true, defaultEnabled: true },
    { host: "re.kufar.by", supported: true, defaultEnabled: true },
    { host: "travel.kufar.by", supported: false, defaultEnabled: false },
    { host: "kufar.by", supported: false, defaultEnabled: false },
  ];

  const DEFAULT_DOMAIN_SETTINGS = DOMAIN_REGISTRY.reduce((result, item) => {
    result[item.host] = item.defaultEnabled;
    return result;
  }, {});

  const NEGATIVE_LABELS = [
    "Договорная",
    "Бесплатно",
    "Обмен",
    "Цена не указана",
  ];

  let ratesData = null;
  let selectedCurrency = "USD";
  let domainSettings = { ...DEFAULT_DOMAIN_SETTINGS };
  let observer = null;
  let applyScheduled = false;

  function normalizeCurrency(value) {
    return ["BYN", "USD", "EUR", "RUB"].includes(value) ? value : "USD";
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

  function isHostActive() {
    let host = "";
    try {
      host = location.hostname.toLowerCase();
    } catch {
      return false;
    }
    const entry = DOMAIN_REGISTRY.find((item) => item.host === host);
    if (!entry || !entry.supported) {
      return false;
    }
    return Boolean(domainSettings[host]);
  }

  function parseBynPrice(value) {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value
      .replace(/[\u00A0\u202F]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (/(^|\s)до\s+\d/i.test(normalized)) {
      return null;
    }

    if (NEGATIVE_LABELS.some((label) => normalized.includes(label))) {
      return null;
    }

    if (/[$€]/.test(normalized) && !/р\.?|BYN|бел\.\s*руб/i.test(normalized)) {
      return null;
    }

    const withoutPrefix = normalized.replace(/^от\s+/i, "");
    const match = withoutPrefix.match(
      /(^|\D)(\d[\d\s]*([.,]\d+)?)\s*(BYN\b|бел\.\s*руб\.?|[рp]\.?(?=\s|$))/i,
    );
    if (!match) {
      return null;
    }

    const numberValue = match[2].replace(/\s+/g, "").replace(",", ".");
    const parsed = Number.parseFloat(numberValue);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    const matchedEnd = match.index + match[0].length;
    const remainder = withoutPrefix.slice(matchedEnd).trim();
    const unitSuffix = remainder ? ` ${remainder}` : "";

    return { amount: parsed, unitSuffix };
  }

  function convertFromBYN(amountInByn, rateInfo) {
    if (!Number.isFinite(amountInByn) || !rateInfo) {
      return null;
    }
    const scale = Number(rateInfo.scale);
    const rate = Number(rateInfo.rate);
    if (
      !Number.isFinite(scale) ||
      scale <= 0 ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      return null;
    }
    return (amountInByn * scale) / rate;
  }

  function formatDisplayPrice(amount, currency) {
    if (!Number.isFinite(amount)) {
      return null;
    }
    const symbols = { USD: "$", EUR: "€", RUB: "RUB" };
    const symbol = symbols[currency];
    if (!symbol) {
      return null;
    }

    const rounded = Math.round(amount * 100) / 100;
    const numberText = new Intl.NumberFormat("ru-BY", {
      minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(rounded);

    return `${numberText} ${symbol}`;
  }

  function getPriceNodes() {
    if (!globalThis.document || !document.querySelectorAll) {
      return [];
    }
    const safeContainers = document.querySelectorAll(
      [
        "a[data-testid='kufar-ad']",
        "a[data-testid^='kufar-realty-card']",
        "#adview_content",
        "[data-name='ad-view-fixed-footer']",
        "[data-name='ad-view-sidebar']",
        "[data-name='av_right_sidebar']",
        "main",
        "section",
      ].join(","),
    );

    const nodes = [];
    for (const container of safeContainers) {
      const textElements = container.querySelectorAll("span, p, div, strong");
      for (const element of textElements) {
        if (!element.childElementCount && element.textContent) {
          nodes.push(element);
        }
      }
    }

    return Array.from(new Set(nodes));
  }

  function restoreAll() {
    if (!globalThis.document || !document.querySelectorAll) {
      return;
    }
    const tracked = document.querySelectorAll(
      "[data-kufar-original-price-text]",
    );
    for (const node of tracked) {
      const original = node.dataset.kufarOriginalPriceText;
      if (typeof original === "string") {
        node.textContent = original;
      }
    }
  }

  function applyConversion() {
    if (!isHostActive()) {
      restoreAll();
      return;
    }

    if (selectedCurrency === "BYN") {
      restoreAll();
      return;
    }

    const targetRate = ratesData?.rates?.[selectedCurrency];
    if (!targetRate) {
      return;
    }

    for (const node of getPriceNodes()) {
      if (!node.dataset.kufarOriginalPriceText) {
        const parsed = parseBynPrice(node.textContent);
        if (!parsed || !Number.isFinite(parsed.amount)) {
          continue;
        }
        node.dataset.kufarOriginalPriceText = node.textContent;
        node.dataset.kufarOriginalPriceAmount = String(parsed.amount);
        node.dataset.kufarOriginalPriceUnit = parsed.unitSuffix;
      }

      const amountByn = Number.parseFloat(
        node.dataset.kufarOriginalPriceAmount || "",
      );
      if (!Number.isFinite(amountByn)) {
        continue;
      }

      const converted = convertFromBYN(amountByn, targetRate);
      const formatted = formatDisplayPrice(converted, selectedCurrency);
      if (formatted) {
        const unitSuffix = node.dataset.kufarOriginalPriceUnit || "";
        node.textContent = formatted + unitSuffix;
      }
    }
  }

  function scheduleApply() {
    if (applyScheduled) {
      return;
    }
    applyScheduled = true;
    const run = () => {
      applyScheduled = false;
      applyConversion();
    };
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
  }

  async function ensureRatesIfNeeded() {
    if (!isHostActive()) {
      return;
    }

    if (ratesData?.rates) {
      return;
    }

    const result = await browser.runtime.sendMessage({ action: "ensureRates" });
    if (result?.ok && result.ratesData) {
      ratesData = result.ratesData;
    }
  }

  function setupStorageListener() {
    browser.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      if (changes.ratesData) {
        ratesData = changes.ratesData.newValue || null;
      }
      if (changes.selectedCurrency) {
        selectedCurrency = normalizeCurrency(changes.selectedCurrency.newValue);
      }
      if (changes.domainSettings) {
        domainSettings = mergeDomainSettings(changes.domainSettings.newValue);
      }

      scheduleApply();
    });
  }

  function setupObserver() {
    if (!globalThis.document || !document.body) {
      return;
    }
    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(() => {
      scheduleApply();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  async function start() {
    const state = await browser.storage.local.get([
      "ratesData",
      "selectedCurrency",
      "domainSettings",
    ]);
    ratesData = state.ratesData || null;
    selectedCurrency = normalizeCurrency(state.selectedCurrency);
    domainSettings = mergeDomainSettings(state.domainSettings);

    if (!isHostActive()) {
      restoreAll();
      setupStorageListener();
      return;
    }

    await ensureRatesIfNeeded();
    setupStorageListener();
    setupObserver();
    scheduleApply();
  }

  start();
})();
