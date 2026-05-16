export const TARGET_CURRENCIES = ["USD", "EUR", "RUB"];
export const DISPLAY_CURRENCIES = ["BYN", "USD", "EUR", "RUB"];

export const SCALE_LABELS = {
  USD: 1,
  EUR: 1,
  RUB: 100,
};

export const CURRENCY_SYMBOLS = {
  BYN: "BYN",
  USD: "$",
  EUR: "€",
  RUB: "RUB",
};

export function parseRates(data) {
  if (!Array.isArray(data)) {
    return null;
  }

  const rates = {};
  let ratesDate = null;

  for (const item of data) {
    const code = item?.Cur_Abbreviation;
    if (!TARGET_CURRENCIES.includes(code)) {
      continue;
    }

    const scale = Number(item.Cur_Scale);
    const rate = Number(item.Cur_OfficialRate);
    const name = item.Cur_Name;

    if (
      !Number.isFinite(scale) ||
      scale <= 0 ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      typeof name !== "string"
    ) {
      return null;
    }

    rates[code] = { code, name, scale, rate };

    if (!ratesDate && typeof item.Date === "string") {
      ratesDate = item.Date.slice(0, 10);
    }
  }

  for (const code of TARGET_CURRENCIES) {
    if (!rates[code]) {
      return null;
    }
  }

  return { rates, ratesDate };
}

export function convert(amount, rateInfo) {
  if (!Number.isFinite(amount) || !rateInfo) {
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
  return (amount * rate) / scale;
}

export function convertFromBYN(amountInByn, rateInfo) {
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

export function parseBynPrice(value) {
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

  const prefixMatch = normalized.match(/^(от\s+)/i);
  const prefix = prefixMatch ? "от " : "";
  const withoutPrefix = prefixMatch
    ? normalized.slice(prefixMatch[0].length)
    : normalized;
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

  if (prefix) {
    return { amount: parsed, unitSuffix, prefix };
  }

  return { amount: parsed, unitSuffix };
}

export function formatDisplayPrice(amount, currency) {
  if (!Number.isFinite(amount) || !CURRENCY_SYMBOLS[currency]) {
    return null;
  }
  const rounded = Math.round(amount * 100) / 100;
  const numberText = new Intl.NumberFormat("ru-BY", {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  return `${numberText} ${CURRENCY_SYMBOLS[currency]}`;
}

export function formatRate(rate) {
  if (!Number.isFinite(rate)) {
    return "-";
  }
  return rate.toFixed(4);
}

export function formatRateLabel(code, scale) {
  if (!TARGET_CURRENCIES.includes(code)) {
    return "";
  }
  const resolvedScale =
    Number.isFinite(scale) && scale > 0 ? scale : (SCALE_LABELS[code] ?? 1);
  return `BYN за ${resolvedScale} ${code}`;
}

export function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "-";
  }
  return new Date(timestamp).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatTime(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "-";
  }
  return new Date(timestamp).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
