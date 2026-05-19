/* ═══════════════════════════════════════════════════════════════════════════
   Unit tests for useLeveragedSspResolver — auto-resolves SSP leveraged-
   authorizations into provider SSPs via fetch. Ported from
   https://github.com/EasyDynamics/oscal-viewer/pull/58
   ═══════════════════════════════════════════════════════════════════════════ */

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLeveragedSspResolver } from "./useLeveragedSspResolver";
import type { UploadEntry } from "../context/OscalContext";

interface HookProps {
  rootSsp: unknown | null;
  rootBaseUrl: string | null;
  token: string | null;
  loadedSsps: UploadEntry<unknown>[];
  addLeveragedSsp: (data: unknown, fileName: string, sourceUrl?: string | null) => void;
}

function renderResolver(props: Partial<HookProps> = {}) {
  const addLeveragedSsp = props.addLeveragedSsp ?? vi.fn();
  const full: HookProps = {
    rootSsp: null,
    rootBaseUrl: null,
    token: null,
    loadedSsps: [],
    addLeveragedSsp,
    ...props,
  };
  const hook = renderHook(
    ({ rootSsp, rootBaseUrl, token, loadedSsps, addLeveragedSsp }: HookProps) =>
      useLeveragedSspResolver(rootSsp, rootBaseUrl, token, loadedSsps, addLeveragedSsp),
    { initialProps: full },
  );
  return { ...hook, addLeveragedSsp };
}

function jsonResponse(
  body: unknown,
  init: { status?: number; contentType?: string } = {},
): Response {
  const headers: Record<string, string> = {
    "Content-Type": init.contentType ?? "application/json",
  };
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status: init.status ?? 200,
    statusText: init.status && init.status >= 400 ? "Server Error" : "OK",
    headers,
  });
}

function sspWithLas(
  las: Record<string, unknown>[],
  opts: { title?: string; uuid?: string; backMatter?: unknown[] } = {},
): Record<string, unknown> {
  return {
    uuid: opts.uuid ?? "root-uuid",
    metadata: { title: opts.title ?? "Root SSP" },
    "system-implementation": { "leveraged-authorizations": las },
    "back-matter": { resources: opts.backMatter ?? [] },
  };
}

/* ─────────── Early-return paths ─────────── */

describe("useLeveragedSspResolver() — early returns", () => {
  let fetchMock: MockInstance;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns empty items when rootSsp is null", () => {
    const { result } = renderResolver({ rootSsp: null });
    expect(result.current.items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty items when rootSsp lacks metadata (unwrap fails)", () => {
    const { result } = renderResolver({ rootSsp: { something: "else" } });
    expect(result.current.items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty items when SSP has no leveraged-authorizations", () => {
    const { result } = renderResolver({ rootSsp: { metadata: { title: "x" } } });
    expect(result.current.items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty items when leveraged-authorizations is not an array", () => {
    const ssp = {
      uuid: "u",
      metadata: { title: "x" },
      "system-implementation": { "leveraged-authorizations": "not-an-array" },
    };
    const { result } = renderResolver({ rootSsp: ssp });
    expect(result.current.items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns empty items when la has no parseable href", () => {
    const ssp = sspWithLas([{ uuid: "la-1", title: "No-href" }]);
    const { result } = renderResolver({ rootSsp: ssp });
    expect(result.current.items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unwraps system-security-plan wrapper from rootSsp", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ metadata: { title: "Provider" } }));
    const wrapped = { "system-security-plan": sspWithLas([{ uuid: "la-1", href: "https://example.com/p.json" }]) };
    const { result } = renderResolver({ rootSsp: wrapped });
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
  });
});

/* ─────────── Href-extraction order ─────────── */

describe("useLeveragedSspResolver() — leveragedHref extraction", () => {
  let fetchMock: MockInstance;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ metadata: { title: "Provider" } }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("picks la.href first", async () => {
    const ssp = sspWithLas([{ uuid: "la-1", href: "https://example.com/p.json", url: "https://other.com/q.json" }]);
    const { result } = renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/p.json");
  });

  it("falls back to la.url when href is absent", async () => {
    const ssp = sspWithLas([{ uuid: "la-1", url: "https://example.com/u.json" }]);
    renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/u.json");
  });

  it("falls back to la.source when url is absent", async () => {
    const ssp = sspWithLas([{ uuid: "la-1", source: "https://example.com/s.json" }]);
    renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/s.json");
  });

  it("falls back to la.link.href when source is absent", async () => {
    const ssp = sspWithLas([{ uuid: "la-1", link: { href: "https://example.com/l.json" } }]);
    renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/l.json");
  });

  it("picks a json-media-type link over a semantic one", async () => {
    const ssp = sspWithLas([{
      uuid: "la-1",
      links: [
        { href: "https://example.com/other.json", rel: "ssp" },
        { href: "https://example.com/json.json", "media-type": "application/json" },
      ],
    }]);
    renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/json.json");
  });

  it("picks a semantic link (rel=ssp/source/provider/authorization) over a generic .json link", async () => {
    const ssp = sspWithLas([{
      uuid: "la-1",
      links: [
        { href: "https://example.com/generic.json" },
        { href: "https://example.com/sem.json", rel: "provider-ssp" },
      ],
    }]);
    renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/sem.json");
  });

  it("falls back to any link with .json in the href", async () => {
    const ssp = sspWithLas([{
      uuid: "la-1",
      links: [{ href: "https://example.com/file.json" }],
    }]);
    renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/file.json");
  });

  it("falls back to props with known names (ssp-url, source-url, provider-ssp, etc.)", async () => {
    const ssp = sspWithLas([{
      uuid: "la-1",
      props: [{ name: "ssp-url", value: "https://example.com/prop.json" }],
    }]);
    renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/prop.json");
  });

  it("falls back to a JSON URL embedded in remarks", async () => {
    const ssp = sspWithLas([{
      uuid: "la-1",
      remarks: { prose: "See https://example.com/remark.json for details." },
    }]);
    renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/remark.json");
  });
});

/* ─────────── Fetch outcomes ─────────── */

describe("useLeveragedSspResolver() — fetch outcomes", () => {
  let fetchMock: MockInstance;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("success: calls addLeveragedSsp with parsed payload, fileName, and sourceUrl", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ metadata: { title: "Provider X" } }));
    const addLeveragedSsp = vi.fn();
    const ssp = sspWithLas([{ uuid: "la-1", href: "https://example.com/provider.json" }]);
    const { result } = renderResolver({ rootSsp: ssp, addLeveragedSsp });

    await waitFor(() =>
      expect(result.current.items[0]?.status).toBe("success"),
    );
    expect(addLeveragedSsp).toHaveBeenCalledTimes(1);
    const [data, fileName, sourceUrl] = addLeveragedSsp.mock.calls[0];
    expect((data as { metadata: { title: string } }).metadata.title).toBe("Provider X");
    expect(fileName).toBe("provider.json");
    expect(sourceUrl).toBe("https://example.com/provider.json");
  });

  it("error: HTTP non-2xx surfaces as an error step", async () => {
    fetchMock.mockResolvedValue(jsonResponse("nope", { status: 404 }));
    const ssp = sspWithLas([{ uuid: "la-1", href: "https://example.com/missing.json" }]);
    const { result } = renderResolver({ rootSsp: ssp });

    await waitFor(() => expect(result.current.items[0]?.status).toBe("error"));
    expect(result.current.items[0]?.error).toMatch(/HTTP 404/);
  });

  it("error: XML content-type rejected", async () => {
    fetchMock.mockResolvedValue(jsonResponse("<x/>", { contentType: "application/xml" }));
    const ssp = sspWithLas([{ uuid: "la-1", href: "https://example.com/x.json" }]);
    const { result } = renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(result.current.items[0]?.status).toBe("error"));
    expect(result.current.items[0]?.error).toMatch(/not JSON/);
  });

  it("error: payload that doesn't unwrap to a valid OSCAL SSP surfaces an error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ unrelated: true }));
    const ssp = sspWithLas([{ uuid: "la-1", href: "https://example.com/x.json" }]);
    const { result } = renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(result.current.items[0]?.status).toBe("error"));
    expect(result.current.items[0]?.error).toMatch(/not appear to be a valid OSCAL SSP/);
  });

  it("error: aborted fetch surfaces as a timeout error", async () => {
    fetchMock.mockImplementation((_url, _opts) => {
      const err = new DOMException("Aborted", "AbortError");
      return Promise.reject(err);
    });
    const ssp = sspWithLas([{ uuid: "la-1", href: "https://example.com/slow.json" }]);
    const { result } = renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(result.current.items[0]?.status).toBe("error"));
    expect(result.current.items[0]?.error).toMatch(/Timed out/);
  });

  it("error: generic fetch rejection surfaces the error message", async () => {
    fetchMock.mockRejectedValue(new Error("Network down"));
    const ssp = sspWithLas([{ uuid: "la-1", href: "https://example.com/x.json" }]);
    const { result } = renderResolver({ rootSsp: ssp });
    await waitFor(() => expect(result.current.items[0]?.status).toBe("error"));
    expect(result.current.items[0]?.error).toBe("Network down");
  });
});

/* ─────────── Visited / initially-loaded skip ─────────── */

describe("useLeveragedSspResolver() — skip behavior", () => {
  let fetchMock: MockInstance;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(jsonResponse({ metadata: { title: "Provider" } }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("skips a URL that's already in loadedSsps via sourceUrl", async () => {
    const url = "https://example.com/already.json";
    const ssp = sspWithLas([{ uuid: "la-1", href: url }]);
    renderResolver({
      rootSsp: ssp,
      loadedSsps: [{ data: {}, fileName: "any.json", sourceUrl: url }],
    });
    // Give the effect a moment to run.
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /* BUG: initiallyLoaded is built from both `sourceUrl` and `fileName`
     (`loadedSsps.flatMap((entry) => [entry.sourceUrl, entry.fileName]...)`),
     but the visited-check is `initiallyLoaded.has(url)` — only URL-keyed.
     A previously-uploaded file (`fileName: "provider.json"`) does NOT
     dedup against a later fetch of `https://example.com/provider.json`.
     The intent (per the data-shape) appears to be to dedup by either,
     so a fix would call `fileNameFromUrl(url)` and check both keys.
     Locked in here per the lock-in-before-fix discipline. */
  it("BUG: fileName-only loadedSsps entries don't dedup against URL fetches", async () => {
    const url = "https://example.com/path/known.json";
    const ssp = sspWithLas([{ uuid: "la-1", href: url }]);
    renderResolver({
      rootSsp: ssp,
      loadedSsps: [{ data: {}, fileName: "known.json" }],
    });
    await new Promise((r) => setTimeout(r, 20));
    // Bug: fetch fires even though the same fileName is already loaded.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("doesn't re-fetch the same URL referenced twice from different las", async () => {
    const url = "https://example.com/same.json";
    const ssp = sspWithLas([
      { uuid: "la-1", href: url },
      { uuid: "la-2", href: url },
    ]);
    renderResolver({ rootSsp: ssp });
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

/* ─────────── Recursion ─────────── */

describe("useLeveragedSspResolver() — recursion through provider las", () => {
  let fetchMock: MockInstance;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("recurses into provider SSP's own leveraged-authorizations (nested chain)", async () => {
    const grandparent = sspWithLas([], { title: "Grandparent SSP" });
    const parent = sspWithLas([
      { uuid: "la-gp", href: "https://example.com/grandparent.json" },
    ], { title: "Parent SSP" });

    fetchMock
      .mockResolvedValueOnce(jsonResponse(parent))
      .mockResolvedValueOnce(jsonResponse(grandparent));

    const ssp = sspWithLas([{ uuid: "la-1", href: "https://example.com/parent.json" }]);
    const { result } = renderResolver({ rootSsp: ssp });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.current.items.length).toBe(2);
    });
    // Nested-step label includes "Nested" prefix.
    expect(result.current.items[1].label).toMatch(/Nested Provider SSP/);
  });
});

/* ─────────── Cancel ─────────── */

describe("useLeveragedSspResolver() — cancel", () => {
  let fetchMock: MockInstance;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("cancel() aborts pending fetches and is idempotent", () => {
    const { result } = renderResolver({ rootSsp: null });
    expect(() => result.current.cancel()).not.toThrow();
    expect(() => result.current.cancel()).not.toThrow();
  });

  it("clears prior steps when rootKey changes", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ metadata: { title: "Provider" } }));
    const ssp1 = sspWithLas([{ uuid: "la-1", href: "https://example.com/p1.json" }], { uuid: "first" });
    const ssp2 = sspWithLas([], { uuid: "second", title: "Second" });
    const { result, rerender } = renderResolver({ rootSsp: ssp1 });
    await waitFor(() => expect(result.current.items.length).toBe(1));
    rerender({ rootSsp: ssp2, rootBaseUrl: null, token: null, loadedSsps: [], addLeveragedSsp: vi.fn() });
    await waitFor(() => expect(result.current.items).toEqual([]));
  });
});
