import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit, then blocks", () => {
    const key = "allow-then-block";
    expect(rateLimit(key, 3, 1000)).toBe(true);
    expect(rateLimit(key, 3, 1000)).toBe(true);
    expect(rateLimit(key, 3, 1000)).toBe(true);
    expect(rateLimit(key, 3, 1000)).toBe(false); // 4th over limit
    expect(rateLimit(key, 3, 1000)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const key = "reset-window";
    expect(rateLimit(key, 1, 1000)).toBe(true);
    expect(rateLimit(key, 1, 1000)).toBe(false);

    vi.advanceTimersByTime(1001); // past the window
    expect(rateLimit(key, 1, 1000)).toBe(true); // fresh window
  });

  it("tracks different keys independently", () => {
    expect(rateLimit("key-a", 1, 1000)).toBe(true);
    expect(rateLimit("key-b", 1, 1000)).toBe(true); // separate bucket
    expect(rateLimit("key-a", 1, 1000)).toBe(false); // a is exhausted
    expect(rateLimit("key-b", 1, 1000)).toBe(false); // b is exhausted
  });

  it("does not reset before the window elapses", () => {
    const key = "no-early-reset";
    expect(rateLimit(key, 2, 1000)).toBe(true);
    expect(rateLimit(key, 2, 1000)).toBe(true);
    vi.advanceTimersByTime(999); // still within window
    expect(rateLimit(key, 2, 1000)).toBe(false);
  });
});
