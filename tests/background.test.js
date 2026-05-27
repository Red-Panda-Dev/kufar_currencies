import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/rates.js", () => ({
  parseRates: vi.fn(),
}));

function createStorageMock(initialState = {}) {
  const state = { ...initialState };
  return {
    state,
    storage: {
      local: {
        async get(keys) {
          if (!Array.isArray(keys)) return { ...state };
          const result = {};
          for (const key of keys) {
            if (key in state) result[key] = state[key];
          }
          return result;
        },
        async set(update) {
          Object.assign(state, update);
        },
      },
    },
  };
}

function createEventEmitter() {
  const listeners = [];
  return {
    addListener(fn) {
      listeners.push(fn);
    },
    async fire(...args) {
      const results = [];
      for (const fn of listeners) {
        results.push(await fn(...args));
      }
      return results;
    },
    get size() {
      return listeners.length;
    },
  };
}

const mockFetch = vi.fn();
const mockStorage = createStorageMock();
const mockOnInstalled = createEventEmitter();
const mockOnAlarm = createEventEmitter();
const mockOnMessage = createEventEmitter();
const mockAlarms = { create: vi.fn(), onAlarm: mockOnAlarm };

const browserMock = {
  storage: mockStorage.storage,
  alarms: mockAlarms,
  runtime: {
    onInstalled: mockOnInstalled,
    onAlarm: mockOnAlarm,
    onMessage: mockOnMessage,
  },
};

globalThis.browser = browserMock;
globalThis.chrome = browserMock;
globalThis.fetch = mockFetch;

const { parseRates } = await import("../src/lib/rates.js");
const {
  fetchRatesFromNbrb,
  refreshRates,
  ensureRates,
  NBRB_URL,
  REFRESH_MINUTES,
  FETCH_TIMEOUT_MS,
} = await import("../src/background.js");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  parseRates.mockReset();
  mockFetch.mockReset();
  mockAlarms.create.mockReset();
  for (const k of Object.keys(mockStorage.state)) delete mockStorage.state[k];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("background.js", () => {
  describe("buildRatesData (via fetchRatesFromNbrb)", () => {
    it("returns correct shape with base, source, rates", async () => {
      const parsed = {
        ratesDate: "2026-05-28",
        rates: {
          USD: { code: "USD", rate: 2.8186, scale: 1 },
        },
      };
      parseRates.mockReturnValue(parsed);
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const result = await fetchRatesFromNbrb();

      expect(result.base).toBe("BYN");
      expect(result.source).toBe("NBRB");
      expect(result.sourceUrl).toBe(NBRB_URL);
      expect(typeof result.fetchedAt).toBe("number");
      expect(result.ratesDate).toBe("2026-05-28");
      expect(result.rates).toEqual(parsed.rates);
    });

    it("sets fetchedAt to current time", async () => {
      const now = 1700000000000;
      vi.setSystemTime(now);
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const result = await fetchRatesFromNbrb();

      expect(result.fetchedAt).toBe(now);
    });

    it("stores ratesData and clears lastError on success", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockStorage.state.lastError = { message: "old error", at: 1 };
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await fetchRatesFromNbrb();

      expect(mockStorage.state.ratesData).toBeDefined();
      expect(mockStorage.state.lastError).toBeNull();
    });
  });

  describe("fetchRatesFromNbrb (error paths)", () => {
    it("stores lastError and throws on non-OK response", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      await expect(fetchRatesFromNbrb()).rejects.toThrow(
        "NBRB request failed: 500",
      );
      expect(mockStorage.state.lastError.message).toBe(
        "NBRB request failed: 500",
      );
      expect(typeof mockStorage.state.lastError.at).toBe("number");
    });

    it("stores timeout message on AbortError", async () => {
      const abortError = new DOMException(
        "The operation was aborted.",
        "AbortError",
      );
      mockFetch.mockRejectedValue(abortError);

      await expect(fetchRatesFromNbrb()).rejects.toBe(abortError);
      expect(mockStorage.state.lastError.message).toBe(
        "Превышено время ожидания",
      );
    });

    it("stores error message when parseRates returns null with OK response", async () => {
      parseRates.mockReturnValue(null);
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await expect(fetchRatesFromNbrb()).rejects.toThrow(
        "Некорректный ответ НБРБ",
      );
      expect(mockStorage.state.lastError.message).toBe(
        "Некорректный ответ НБРБ",
      );
    });

    it("stores error message on generic network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network failure"));

      await expect(fetchRatesFromNbrb()).rejects.toThrow("Network failure");
      expect(mockStorage.state.lastError.message).toBe("Network failure");
    });

    it("clears timeout in finally block on success", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      await fetchRatesFromNbrb();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("refreshRates", () => {
    it("triggers fetchRatesFromNbrb on first call", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const result = await refreshRates();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.rates).toBeDefined();
    });

    it("deduplicates concurrent calls without force", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      let resolveFetch;
      mockFetch.mockReturnValue(
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
      );

      const p1 = refreshRates();
      const p2 = refreshRates();

      expect(mockFetch).toHaveBeenCalledTimes(1);

      resolveFetch({ ok: true, json: async () => [] });
      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(r2);
    });

    it("starts new fetch with force even when one is in progress", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      let resolveFirst;
      mockFetch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      );
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const p1 = refreshRates();
      const p2 = refreshRates({ force: true });

      expect(mockFetch).toHaveBeenCalledTimes(2);

      resolveFirst({ ok: true, json: async () => [] });
      await Promise.all([p1, p2]);
    });

    it("resets fetchInProgress after completion allowing new fetch", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await refreshRates();
      await refreshRates();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("ensureRates", () => {
    it("returns cached ratesData without fetching", async () => {
      const cached = {
        base: "BYN",
        rates: { USD: { rate: 1 } },
        fetchedAt: 1700000000000,
      };
      mockStorage.state.ratesData = cached;

      const result = await ensureRates();

      expect(result).toEqual(cached);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("fetches when ratesData is missing", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const result = await ensureRates();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.rates).toBeDefined();
    });

    it("fetches when ratesData is null", async () => {
      mockStorage.state.ratesData = null;
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const result = await ensureRates();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.rates).toBeDefined();
    });
  });

  describe("onInstalled listener", () => {
    it("creates refreshRates alarm with correct interval", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await mockOnInstalled.fire();

      expect(mockAlarms.create).toHaveBeenCalledWith("refreshRates", {
        periodInMinutes: REFRESH_MINUTES,
      });
    });

    it("triggers initial refreshRates", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await mockOnInstalled.fire();

      expect(mockFetch).toHaveBeenCalled();
    });

    it("swallows errors from initial refreshRates", async () => {
      mockFetch.mockRejectedValue(new Error("fail"));

      await expect(mockOnInstalled.fire()).resolves.toBeDefined();
    });
  });

  describe("onAlarm listener", () => {
    it("refreshes on refreshRates alarm", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await mockOnAlarm.fire({ name: "refreshRates" });

      expect(mockFetch).toHaveBeenCalled();
    });

    it("ignores other alarm names", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await mockOnAlarm.fire({ name: "otherAlarm" });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("onMessage listener", () => {
    it("returns ratesData and lastError for getRates", async () => {
      const cached = { base: "BYN", rates: {} };
      const err = { message: "err", at: 1 };
      mockStorage.state.ratesData = cached;
      mockStorage.state.lastError = err;

      const [result] = await mockOnMessage.fire({ action: "getRates" });

      expect(result).toEqual({ ratesData: cached, lastError: err });
    });

    it("returns ok:true with ratesData on refreshRates success", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const [result] = await mockOnMessage.fire({ action: "refreshRates" });

      expect(result.ok).toBe(true);
      expect(result.ratesData).toBeDefined();
    });

    it("returns ok:false on refreshRates failure", async () => {
      mockFetch.mockRejectedValue(new Error("fail"));

      const [result] = await mockOnMessage.fire({ action: "refreshRates" });

      expect(result.ok).toBe(false);
    });

    it("returns ok:true with ratesData on ensureRates success", async () => {
      parseRates.mockReturnValue({
        ratesDate: "2026-01-01",
        rates: { USD: {} },
      });
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      const [result] = await mockOnMessage.fire({ action: "ensureRates" });

      expect(result.ok).toBe(true);
      expect(result.ratesData).toBeDefined();
    });

    it("returns ok:false on ensureRates failure", async () => {
      mockFetch.mockRejectedValue(new Error("fail"));

      const [result] = await mockOnMessage.fire({ action: "ensureRates" });

      expect(result.ok).toBe(false);
    });

    it("returns undefined for unknown action", async () => {
      const [result] = await mockOnMessage.fire({ action: "unknownAction" });

      expect(result).toBeUndefined();
    });
  });

  describe("constants", () => {
    it("exports expected constants", () => {
      expect(NBRB_URL).toBe("https://api.nbrb.by/exrates/rates?periodicity=0");
      expect(REFRESH_MINUTES).toBe(240);
      expect(FETCH_TIMEOUT_MS).toBe(15000);
    });
  });
});
