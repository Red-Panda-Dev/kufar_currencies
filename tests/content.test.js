import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const contentSource = readFileSync(
  resolve(process.cwd(), "content", "kufar.js"),
  "utf8",
);

const sampleRates = {
  rates: {
    USD: { rate: 2.8186, scale: 1 },
    EUR: { rate: 3.2937, scale: 1 },
    RUB: { rate: 3.7556, scale: 100 },
  },
};

function createBrowserMock(initialState, options = {}) {
  const state = { ...initialState };
  const listeners = [];
  const messages = [];

  const browser = {
    storage: {
      local: {
        async get(keys) {
          if (!Array.isArray(keys)) {
            return { ...state };
          }
          const result = {};
          for (const key of keys) {
            result[key] = state[key];
          }
          return result;
        },
        async set(update) {
          const changes = {};
          for (const [key, value] of Object.entries(update)) {
            changes[key] = { oldValue: state[key], newValue: value };
            state[key] = value;
          }
          for (const listener of listeners) {
            listener(changes, "local");
          }
        },
      },
      onChanged: {
        addListener(listener) {
          listeners.push(listener);
        },
      },
    },
    runtime: {
      async sendMessage(payload) {
        messages.push(payload);
        if (options.sendMessage) {
          return options.sendMessage(payload, state);
        }
        return { ok: true, ratesData: state.ratesData || sampleRates };
      },
    },
  };

  return { browser, state, messages };
}

async function bootstrapContentScript(html, initialState, options = {}) {
  const dom = new JSDOM(html, {
    url: options.url || "https://auto.kufar.by/",
    runScripts: "outside-only",
  });

  const browserMock = createBrowserMock(initialState, options);
  const rafTimers = new Set();
  dom.window.browser = browserMock.browser;
  dom.window.chrome = browserMock.browser;
  dom.window.requestAnimationFrame = (cb) => {
    const timer = setTimeout(() => {
      rafTimers.delete(timer);
      cb();
    }, 0);
    rafTimers.add(timer);
    return timer;
  };

  dom.window.eval(contentSource);
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));

  return {
    dom,
    browserMock,
    cleanup() {
      for (const timer of rafTimers) {
        clearTimeout(timer);
      }
      rafTimers.clear();
      dom.window.close();
    },
  };
}

describe("content/kufar.js", () => {
  const indexHtml = readFileSync(
    resolve(process.cwd(), "examples", "auto", "index_page.html"),
    "utf8",
  );
  const itemHtml = readFileSync(
    resolve(process.cwd(), "examples", "auto", "item_page.html"),
    "utf8",
  );
  const realEstateIndexHtml = readFileSync(
    resolve(process.cwd(), "examples", "real_estate", "index_page.html"),
    "utf8",
  );
  const realEstateItemHtml = readFileSync(
    resolve(process.cwd(), "examples", "real_estate", "item_page.html"),
    "utf8",
  );
  const realEstateFilterHtml = readFileSync(
    resolve(process.cwd(), "examples", "real_estate", "filter_page.html"),
    "utf8",
  );

  it("converts BYN text on auto.kufar.by", async () => {
    const session = await bootstrapContentScript(indexHtml, {
      ratesData: sampleRates,
      selectedCurrency: "USD",
      domainSettings: { "auto.kufar.by": true },
    });

    try {
      const converted =
        session.dom.window.document.body.textContent.includes("$");
      expect(converted).toBe(true);
    } finally {
      session.cleanup();
    }
  });

  it("converts item page sidebar and similar listing prices", async () => {
    const session = await bootstrapContentScript(itemHtml, {
      ratesData: sampleRates,
      selectedCurrency: "USD",
      domainSettings: { "auto.kufar.by": true },
    });

    try {
      const sidebarPrice = session.dom.window.document.querySelector(
        ".styles_main__eFbJH",
      );
      expect(sidebarPrice.dataset.kufarOriginalPriceText).toBe("66 057 р.");
      expect(sidebarPrice.textContent).toContain("$");

      const similarPrices = session.dom.window.document.querySelectorAll(
        ".styles_price__anAen > span:first-child",
      );
      expect(similarPrices.length).toBeGreaterThan(0);
      expect(similarPrices[0].dataset.kufarOriginalPriceAmount).toBeDefined();
      expect(similarPrices[0].textContent).toContain("$");

      const sellerBadges = Array.from(
        session.dom.window.document.querySelectorAll(
          ".styles_security_badges__aCAPX p",
        ),
      );
      const sellerSince = sellerBadges.find((node) =>
        node.textContent.includes("На Куфаре с"),
      );
      expect(sellerSince.dataset.kufarOriginalPriceText).toBeUndefined();

      const vehicleParams = session.dom.window.document.querySelectorAll(
        ".styles_params__xAj6w",
      );
      expect(vehicleParams.length).toBeGreaterThan(0);
      for (const params of vehicleParams) {
        expect(params.dataset.kufarOriginalPriceText).toBeUndefined();
      }
    } finally {
      session.cleanup();
    }
  });

  it("does not run conversion on unsupported host", async () => {
    const session = await bootstrapContentScript(
      indexHtml,
      {
        ratesData: sampleRates,
        selectedCurrency: "USD",
        domainSettings: { "auto.kufar.by": true },
      },
      { url: "https://www.kufar.by/" },
    );

    try {
      expect(
        session.browserMock.messages.some(
          (msg) => msg.action === "ensureRates",
        ),
      ).toBe(false);
      const tracked = session.dom.window.document.querySelectorAll(
        "[data-kufar-original-price-text]",
      );
      expect(tracked.length).toBe(0);
    } finally {
      session.cleanup();
    }
  });

  it("requests ensureRates when active and rates missing", async () => {
    const session = await bootstrapContentScript(indexHtml, {
      selectedCurrency: "USD",
      domainSettings: { "auto.kufar.by": true },
    });

    try {
      expect(
        session.browserMock.messages.some(
          (msg) => msg.action === "ensureRates",
        ),
      ).toBe(true);
    } finally {
      session.cleanup();
    }
  });

  it("restores BYN when selectedCurrency switches to BYN", async () => {
    const session = await bootstrapContentScript(indexHtml, {
      ratesData: sampleRates,
      selectedCurrency: "USD",
      domainSettings: { "auto.kufar.by": true },
    });

    try {
      await session.browserMock.browser.storage.local.set({
        selectedCurrency: "BYN",
      });
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 0));
      expect(session.dom.window.document.body.textContent.includes("р.")).toBe(
        true,
      );
    } finally {
      session.cleanup();
    }
  });

  describe("re.kufar.by", () => {
    it("converts BYN text on real estate index page", async () => {
      const session = await bootstrapContentScript(
        realEstateIndexHtml,
        {
          ratesData: sampleRates,
          selectedCurrency: "USD",
          domainSettings: { "re.kufar.by": true },
        },
        { url: "https://re.kufar.by/" },
      );

      try {
        const convertedNode = session.dom.window.document.querySelector(
          "[data-kufar-original-price-amount='355436']",
        );
        expect(convertedNode).toBeTruthy();
        expect(convertedNode.textContent).toContain("$");
      } finally {
        session.cleanup();
      }
    });

    it("converts item page prices on real estate host", async () => {
      const session = await bootstrapContentScript(
        realEstateItemHtml,
        {
          ratesData: sampleRates,
          selectedCurrency: "USD",
          domainSettings: { "re.kufar.by": true },
        },
        { url: "https://re.kufar.by/" },
      );

      try {
        const convertedNode = session.dom.window.document.querySelector(
          "[data-kufar-original-price-amount='418697']",
        );
        expect(convertedNode).toBeTruthy();
        expect(convertedNode.textContent).toContain("$");
      } finally {
        session.cleanup();
      }
    });

    it("does not convert negative labels on real estate pages", async () => {
      const negativeLabelsHtml = `
        <main>
          <a data-testid="kufar-realty-card-1">
            <span>Обмен</span>
            <span>Бесплатно</span>
            <span>355 436 р.</span>
          </a>
        </main>
      `;
      const session = await bootstrapContentScript(
        negativeLabelsHtml,
        {
          ratesData: sampleRates,
          selectedCurrency: "USD",
          domainSettings: { "re.kufar.by": true },
        },
        { url: "https://re.kufar.by/" },
      );

      try {
        const nodes = Array.from(
          session.dom.window.document.querySelectorAll("span, p, div, strong"),
        );
        const barterLabel = nodes.find((node) => node.textContent === "Обмен");
        const freeLabel = nodes.find(
          (node) => node.textContent === "Бесплатно",
        );

        expect(barterLabel).toBeTruthy();
        expect(freeLabel).toBeTruthy();
        expect(barterLabel.dataset.kufarOriginalPriceText).toBeUndefined();
        expect(freeLabel.dataset.kufarOriginalPriceText).toBeUndefined();
      } finally {
        session.cleanup();
      }
    });

    it("converts per-month prices on real estate pages", async () => {
      const session = await bootstrapContentScript(
        realEstateFilterHtml,
        {
          ratesData: sampleRates,
          selectedCurrency: "USD",
          domainSettings: { "re.kufar.by": true },
        },
        { url: "https://re.kufar.by/" },
      );

      try {
        const perMonthNode = session.dom.window.document.querySelector(
          "[data-kufar-original-price-amount='1246']",
        );
        expect(perMonthNode).toBeTruthy();
        expect(perMonthNode.dataset.kufarOriginalPriceText).toContain("мес");
        expect(perMonthNode.textContent).toContain("$");
      } finally {
        session.cleanup();
      }
    });
  });
});
