import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { OscalProvider, useOscal, type Catalog } from "./OscalContext";
import type { ReactNode } from "react";

const wrapper = ({ children }: { children: ReactNode }) => (
  <OscalProvider>{children}</OscalProvider>
);

/** Minimal Catalog fixture for the strongly-typed catalog slot. */
const fakeCatalog: Catalog = {
  uuid: "cat-1",
  metadata: { title: "Fake" },
};

describe("useOscal()", () => {
  it("throws when called outside <OscalProvider>", () => {
    expect(() => renderHook(() => useOscal())).toThrow(
      /useOscal must be used within <OscalProvider>/,
    );
  });

  it("returns the context value when wrapped in <OscalProvider>", () => {
    const { result } = renderHook(() => useOscal(), { wrapper });
    expect(result.current).toBeDefined();
    expect(typeof result.current.setCatalog).toBe("function");
    expect(typeof result.current.isLoaded).toBe("function");
  });
});

describe("<OscalProvider> initial state", () => {
  it("starts every slot at null and reports nothing loaded", () => {
    const { result } = renderHook(() => useOscal(), { wrapper });
    const c = result.current;
    expect(c.catalog).toBeNull();
    expect(c.componentDefinition).toBeNull();
    expect(c.profile).toBeNull();
    expect(c.ssp).toBeNull();
    expect(c.assessmentPlan).toBeNull();
    expect(c.assessmentResults).toBeNull();
    expect(c.poam).toBeNull();

    expect(c.isLoaded("catalog")).toBe(false);
    expect(c.isLoaded("component-definition")).toBe(false);
    expect(c.isLoaded("profile")).toBe(false);
    expect(c.isLoaded("ssp")).toBe(false);
    expect(c.isLoaded("assessment-plan")).toBe(false);
    expect(c.isLoaded("assessment-results")).toBe(false);
    expect(c.isLoaded("poam")).toBe(false);
  });

  it("returns false from isLoaded for unknown keys (default branch)", () => {
    const { result } = renderHook(() => useOscal(), { wrapper });
    expect(result.current.isLoaded("not-a-real-key")).toBe(false);
    expect(result.current.isLoaded("")).toBe(false);
  });
});

/**
 * Table-driven exercise of every slot. Each row is one OSCAL model
 * slot paired with its accessor, setter, clearer, and the isLoaded
 * key. Iterating proves every case arm of the switch and every
 * set/clear callback runs.
 */
describe("<OscalProvider> slot round-trips", () => {
  const catalogRow = {
    name: "catalog",
    accessor: (c: ReturnType<typeof useOscal>) => c.catalog,
    setter: (c: ReturnType<typeof useOscal>) =>
      c.setCatalog(fakeCatalog, "catalog.json"),
    clearer: (c: ReturnType<typeof useOscal>) => c.clearCatalog(),
    isLoadedKey: "catalog",
    expectedData: fakeCatalog as unknown,
    expectedFileName: "catalog.json",
  };

  const otherRows = [
    {
      name: "componentDefinition",
      accessor: (c: ReturnType<typeof useOscal>) => c.componentDefinition,
      setter: (c: ReturnType<typeof useOscal>) =>
        c.setComponentDefinition({ any: "cd" }, "cd.json"),
      clearer: (c: ReturnType<typeof useOscal>) => c.clearComponentDefinition(),
      isLoadedKey: "component-definition",
      expectedData: { any: "cd" },
      expectedFileName: "cd.json",
    },
    {
      name: "profile",
      accessor: (c: ReturnType<typeof useOscal>) => c.profile,
      setter: (c: ReturnType<typeof useOscal>) =>
        c.setProfile({ any: "profile" }, "profile.json"),
      clearer: (c: ReturnType<typeof useOscal>) => c.clearProfile(),
      isLoadedKey: "profile",
      expectedData: { any: "profile" },
      expectedFileName: "profile.json",
    },
    {
      name: "ssp",
      accessor: (c: ReturnType<typeof useOscal>) => c.ssp,
      setter: (c: ReturnType<typeof useOscal>) =>
        c.setSsp({ any: "ssp" }, "ssp.json"),
      clearer: (c: ReturnType<typeof useOscal>) => c.clearSsp(),
      isLoadedKey: "ssp",
      expectedData: { any: "ssp" },
      expectedFileName: "ssp.json",
    },
    {
      name: "assessmentPlan",
      accessor: (c: ReturnType<typeof useOscal>) => c.assessmentPlan,
      setter: (c: ReturnType<typeof useOscal>) =>
        c.setAssessmentPlan({ any: "ap" }, "ap.json"),
      clearer: (c: ReturnType<typeof useOscal>) => c.clearAssessmentPlan(),
      isLoadedKey: "assessment-plan",
      expectedData: { any: "ap" },
      expectedFileName: "ap.json",
    },
    {
      name: "assessmentResults",
      accessor: (c: ReturnType<typeof useOscal>) => c.assessmentResults,
      setter: (c: ReturnType<typeof useOscal>) =>
        c.setAssessmentResults({ any: "ar" }, "ar.json"),
      clearer: (c: ReturnType<typeof useOscal>) => c.clearAssessmentResults(),
      isLoadedKey: "assessment-results",
      expectedData: { any: "ar" },
      expectedFileName: "ar.json",
    },
    {
      name: "poam",
      accessor: (c: ReturnType<typeof useOscal>) => c.poam,
      setter: (c: ReturnType<typeof useOscal>) =>
        c.setPoam({ any: "poam" }, "poam.json"),
      clearer: (c: ReturnType<typeof useOscal>) => c.clearPoam(),
      isLoadedKey: "poam",
      expectedData: { any: "poam" },
      expectedFileName: "poam.json",
    },
  ];

  for (const row of [catalogRow, ...otherRows]) {
    it(`set / isLoaded / clear round-trip for the ${row.name} slot`, () => {
      const { result } = renderHook(() => useOscal(), { wrapper });

      act(() => row.setter(result.current));

      const entry = row.accessor(result.current);
      expect(entry).not.toBeNull();
      expect(entry?.data).toEqual(row.expectedData);
      expect(entry?.fileName).toBe(row.expectedFileName);
      expect(result.current.isLoaded(row.isLoadedKey)).toBe(true);

      act(() => row.clearer(result.current));

      expect(row.accessor(result.current)).toBeNull();
      expect(result.current.isLoaded(row.isLoadedKey)).toBe(false);
    });
  }
});

/* #56 leveragedSsps slot — array-of-entries, not single-entry; uses
   add/remove/clear instead of set/clear. Port of
   https://github.com/EasyDynamics/oscal-viewer/pull/56 */
describe("<OscalProvider> leveragedSsps slot", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useOscal(), { wrapper });
    expect(result.current.leveragedSsps).toEqual([]);
  });

  it("addLeveragedSsp appends a new entry", () => {
    const { result } = renderHook(() => useOscal(), { wrapper });
    act(() => result.current.addLeveragedSsp({ a: 1 }, "provider1.json"));
    act(() => result.current.addLeveragedSsp({ b: 2 }, "provider2.json"));

    expect(result.current.leveragedSsps).toHaveLength(2);
    expect(result.current.leveragedSsps[0].fileName).toBe("provider1.json");
    expect(result.current.leveragedSsps[0].data).toEqual({ a: 1 });
    expect(result.current.leveragedSsps[1].fileName).toBe("provider2.json");
  });

  it("addLeveragedSsp is idempotent on fileName collision (does not append a duplicate)", () => {
    const { result } = renderHook(() => useOscal(), { wrapper });
    act(() => result.current.addLeveragedSsp({ a: 1 }, "same.json"));
    act(() => result.current.addLeveragedSsp({ a: 2 }, "same.json"));

    expect(result.current.leveragedSsps).toHaveLength(1);
    // First-write-wins: the second add is dropped, data is unchanged.
    expect(result.current.leveragedSsps[0].data).toEqual({ a: 1 });
  });

  /* #58 added sourceUrl-keyed dedup: a second add with the same sourceUrl
     but a different fileName is also rejected (so the auto-resolver fetch
     doesn't double-add a provider that was already uploaded by file).
     Port of https://github.com/EasyDynamics/oscal-viewer/pull/58 */
  it("addLeveragedSsp is idempotent on sourceUrl collision (different fileName)", () => {
    const { result } = renderHook(() => useOscal(), { wrapper });
    act(() => result.current.addLeveragedSsp({ a: 1 }, "first.json", "https://example.com/p.json"));
    act(() => result.current.addLeveragedSsp({ a: 2 }, "second.json", "https://example.com/p.json"));

    expect(result.current.leveragedSsps).toHaveLength(1);
    expect(result.current.leveragedSsps[0].fileName).toBe("first.json");
  });

  it("removeLeveragedSsp filters by fileName", () => {
    const { result } = renderHook(() => useOscal(), { wrapper });
    act(() => result.current.addLeveragedSsp({ a: 1 }, "p1.json"));
    act(() => result.current.addLeveragedSsp({ b: 2 }, "p2.json"));
    act(() => result.current.removeLeveragedSsp("p1.json"));

    expect(result.current.leveragedSsps).toHaveLength(1);
    expect(result.current.leveragedSsps[0].fileName).toBe("p2.json");
  });

  it("removeLeveragedSsp is a no-op when fileName isn't present", () => {
    const { result } = renderHook(() => useOscal(), { wrapper });
    act(() => result.current.addLeveragedSsp({ a: 1 }, "p1.json"));
    act(() => result.current.removeLeveragedSsp("nope.json"));

    expect(result.current.leveragedSsps).toHaveLength(1);
  });

  it("clearLeveragedSsps empties the array", () => {
    const { result } = renderHook(() => useOscal(), { wrapper });
    act(() => result.current.addLeveragedSsp({ a: 1 }, "p1.json"));
    act(() => result.current.addLeveragedSsp({ b: 2 }, "p2.json"));
    act(() => result.current.clearLeveragedSsps());

    expect(result.current.leveragedSsps).toEqual([]);
  });
});
