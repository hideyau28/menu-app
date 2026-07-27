import { describe, it, expect, vi, afterEach } from "vitest";
import { buildTripShareData, copyTextToClipboard } from "../shareUtils";

describe("buildTripShareData", () => {
  it("uses the trip name as the share title", () => {
    const data = buildTripShareData("東京之旅", "https://example.com/expenses?code=ABCD1234");
    expect(data.title).toBe("東京之旅");
  });

  it("trims a padded trip name", () => {
    expect(buildTripShareData("  東京之旅  ", "https://x").title).toBe("東京之旅");
  });

  it("falls back to a default title when the trip name is missing or blank", () => {
    expect(buildTripShareData(undefined, "https://x").title).toBe("旅程記帳");
    expect(buildTripShareData(null, "https://x").title).toBe("旅程記帳");
    expect(buildTripShareData("   ", "https://x").title).toBe("旅程記帳");
  });

  it("passes the url through unchanged, including the trip code", () => {
    const url = "https://example.com/expenses?code=ABCD1234";
    expect(buildTripShareData("Trip", url).url).toBe(url);
  });

  it("does not expose any data beyond title/text/url", () => {
    const data = buildTripShareData("Trip", "https://x");
    expect(Object.keys(data).sort()).toEqual(["text", "title", "url"]);
  });
});

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves true when navigator.clipboard.writeText succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("resolves false (never throws) when clipboard rejects and no DOM fallback exists", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    // vitest runs in a "node" test environment (see vitest.config.ts), so `document`
    // is genuinely unavailable here — this exercises the real no-DOM fallback path.

    await expect(copyTextToClipboard("hello")).resolves.toBe(false);
  });

  it("resolves false (never throws) when navigator.clipboard is unavailable entirely", async () => {
    vi.stubGlobal("navigator", {});

    await expect(copyTextToClipboard("hello")).resolves.toBe(false);
  });
});
