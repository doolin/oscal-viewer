/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isOverdue,
  daysUntil,
  renderParamText,
  resolveInlineParams,
  getCatalogLabel,
  findCatalogControl,
  findParentCatalogControl,
} from "./PoamPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Pure-function unit tests for the helpers exported in PR #60. Drives
   branch coverage on PoamPage.tsx helpers (lines 237-335) to (or near)
   100%.

   Date-based helpers (isOverdue, daysUntil) read Date.now() / new Date(),
   so we freeze the clock with vi.useFakeTimers() in each test that
   depends on it.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── isOverdue ─────────────────────────────────────────────────────────── */

describe("isOverdue()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when deadline is undefined", () => {
    expect(isOverdue(undefined)).toBe(false);
  });

  it("returns true when deadline is in the past", () => {
    expect(isOverdue("2026-06-14T00:00:00Z")).toBe(true);
  });

  it("returns false when deadline is in the future", () => {
    expect(isOverdue("2026-06-16T00:00:00Z")).toBe(false);
  });

  it("returns false when deadline is the current time (not strictly less than)", () => {
    expect(isOverdue("2026-06-15T12:00:00Z")).toBe(false);
  });
});

/* ─── daysUntil ─────────────────────────────────────────────────────────── */

describe("daysUntil()", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns positive days for a future date", () => {
    expect(daysUntil("2026-06-25T00:00:00Z")).toBe(10);
  });

  it("returns negative days for a past date", () => {
    expect(daysUntil("2026-06-05T00:00:00Z")).toBe(-10);
  });

  it("returns 0 for the current moment", () => {
    expect(daysUntil("2026-06-15T00:00:00Z")).toBe(0);
  });

  it("rounds partial days up via Math.ceil (covers the rounding behavior)", () => {
    // 12 hours from now → 0.5 days → ceil → 1
    expect(daysUntil("2026-06-15T12:00:00Z")).toBe(1);
  });
});

/* ─── renderParamText ───────────────────────────────────────────────────── */

describe("renderParamText()", () => {
  it("renders [Selection (one or more): ...] when how-many is 'one-or-more'", () => {
    const param: any = { id: "p", select: { "how-many": "one-or-more", choice: ["a", "b"] } };
    expect(renderParamText(param, {})).toBe("[Selection (one or more): a; b]");
  });

  it("renders [Selection: ...] when how-many is omitted", () => {
    const param: any = { id: "p", select: { choice: ["only"] } };
    expect(renderParamText(param, {})).toBe("[Selection: only]");
  });

  it("renders empty Selection brackets when choice is missing", () => {
    const param: any = { id: "p", select: {} };
    expect(renderParamText(param, {})).toBe("[Selection: ]");
  });

  it("renders [Assignment: <label>] when param has a label", () => {
    const param: any = { id: "p", label: "the role" };
    expect(renderParamText(param, {})).toBe("[Assignment: the role]");
  });

  it("falls back to param.id when label is missing", () => {
    const param: any = { id: "p" };
    expect(renderParamText(param, {})).toBe("[Assignment: p]");
  });

  it("resolves nested tokens inside select.choice strings", () => {
    const param: any = { id: "p", select: { choice: ["{{ insert: param, q }}"] } };
    const map: any = { q: { id: "q", label: "inner" } };
    expect(renderParamText(param, map)).toBe("[Selection: [Assignment: inner]]");
  });

  it("resolves nested tokens inside param.label", () => {
    const param: any = { id: "outer", label: "the {{ insert: param, inner }} pick" };
    const map: any = { inner: { id: "inner", label: "senior" } };
    expect(renderParamText(param, map)).toBe("[Assignment: the [Assignment: senior] pick]");
  });
});

/* ─── resolveInlineParams ───────────────────────────────────────────────── */

describe("resolveInlineParams()", () => {
  it("returns text unchanged when no tokens are present", () => {
    expect(resolveInlineParams("plain text", {})).toBe("plain text");
  });

  it("substitutes a known param token via renderParamText", () => {
    const map: any = { p: { id: "p", label: "value" } };
    expect(resolveInlineParams("X {{ insert: param, p }} Y", map))
      .toBe("X [Assignment: value] Y");
  });

  it("inserts [Assignment: id] when the param id is unknown", () => {
    expect(resolveInlineParams("X {{ insert: param, missing }} Y", {}))
      .toBe("X [Assignment: missing] Y");
  });

  it("substitutes multiple tokens in the same string", () => {
    const map: any = { a: { id: "a", label: "A" }, b: { id: "b", label: "B" } };
    expect(resolveInlineParams("{{ insert: param, a }} and {{ insert: param, b }}", map))
      .toBe("[Assignment: A] and [Assignment: B]");
  });

  it("trims whitespace around the param id", () => {
    const map: any = { p: { id: "p", label: "V" } };
    expect(resolveInlineParams("{{ insert: param,   p   }}", map))
      .toBe("[Assignment: V]");
  });
});

/* ─── getCatalogLabel ───────────────────────────────────────────────────── */

describe("getCatalogLabel()", () => {
  it("returns '' when props is undefined", () => {
    expect(getCatalogLabel(undefined)).toBe("");
  });

  it("returns '' when props array contains no label", () => {
    expect(getCatalogLabel([{ name: "marking", value: "public" }] as any)).toBe("");
  });

  it("returns a regular label", () => {
    expect(getCatalogLabel([{ name: "label", value: "AC-1" }] as any)).toBe("AC-1");
  });

  it("prefers a non-zero-padded label when both are present", () => {
    const props = [
      { name: "label", value: "AC-01", class: "zero-padded" },
      { name: "label", value: "AC-1" },
    ] as any;
    expect(getCatalogLabel(props)).toBe("AC-1");
  });

  it("falls back to zero-padded when it is the only label", () => {
    const props = [
      { name: "label", value: "AC-01", class: "zero-padded" },
    ] as any;
    expect(getCatalogLabel(props)).toBe("AC-01");
  });
});

/* ─── findCatalogControl ────────────────────────────────────────────────── */

describe("findCatalogControl()", () => {
  it("returns undefined when the control id is not present anywhere", () => {
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "g", title: "G", controls: [{ id: "x-1", title: "X-1" }] },
    ]};
    expect(findCatalogControl(cat, "no-such-id")).toBeUndefined();
  });

  it("finds a control inside a top-level group", () => {
    const c = { id: "ac-1", title: "Policy" };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [c] },
    ]};
    expect(findCatalogControl(cat, "ac-1")).toBe(c);
  });

  it("finds an enhancement inside a group's control", () => {
    const enh = { id: "ac-1.1", title: "Enh" };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [
        { id: "ac-1", title: "Policy", controls: [enh] },
      ]},
    ]};
    expect(findCatalogControl(cat, "ac-1.1")).toBe(enh);
  });

  it("recurses into nested subgroups to find a control", () => {
    const c = { id: "sr-1", title: "Supply Risk" };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "outer", title: "Outer", groups: [
        { id: "inner", title: "Inner", controls: [c] },
      ]},
    ]};
    expect(findCatalogControl(cat, "sr-1")).toBe(c);
  });

  it("returns undefined from inner searchGroup when a subgroup has no match", () => {
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "outer", title: "Outer", groups: [
        { id: "inner", title: "Inner", controls: [{ id: "other", title: "Other" }] },
      ]},
    ]};
    expect(findCatalogControl(cat, "not-here")).toBeUndefined();
  });

  it("finds a control at the catalog.controls top level (no groups)", () => {
    const c = { id: "pm-1", title: "PM-1" };
    const cat: any = { uuid: "c", metadata: { title: "" }, controls: [c] };
    expect(findCatalogControl(cat, "pm-1")).toBe(c);
  });

  it("finds an enhancement inside catalog.controls", () => {
    const enh = { id: "pm-1.1", title: "Enh" };
    const cat: any = { uuid: "c", metadata: { title: "" }, controls: [
      { id: "pm-1", title: "PM-1", controls: [enh] },
    ]};
    expect(findCatalogControl(cat, "pm-1.1")).toBe(enh);
  });
});

/* ─── findParentCatalogControl ──────────────────────────────────────────── */

describe("findParentCatalogControl()", () => {
  it("finds the parent control of an enhancement in a top-level group", () => {
    const parent = { id: "ac-1", title: "Policy", controls: [{ id: "ac-1.1" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [parent] },
    ]};
    expect(findParentCatalogControl(cat, "ac-1.1")).toBe(parent);
  });

  it("recurses into nested subgroups to find the parent (covers searchGroup recursion)", () => {
    const parent = { id: "ac-1", title: "Policy", controls: [{ id: "ac-1.1" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "outer", title: "Outer", groups: [
        { id: "inner", title: "Inner", controls: [parent] },
      ]},
    ]};
    expect(findParentCatalogControl(cat, "ac-1.1")).toBe(parent);
  });

  it("returns undefined when the parent isn't found anywhere", () => {
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [
        { id: "ac-2", title: "AM", controls: [{ id: "ac-2.1" }] },
      ]},
    ]};
    expect(findParentCatalogControl(cat, "no-such-enh")).toBeUndefined();
  });

  it("finds the parent of an enhancement in catalog.controls (no groups)", () => {
    const parent = { id: "pm-1", title: "PM-1", controls: [{ id: "pm-1.1" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, controls: [parent] };
    expect(findParentCatalogControl(cat, "pm-1.1")).toBe(parent);
  });

  it("returns undefined when neither groups nor controls contain the enhancement", () => {
    const cat: any = { uuid: "c", metadata: { title: "" } };
    expect(findParentCatalogControl(cat, "ac-1.1")).toBeUndefined();
  });

  it("iterates past a non-matching control in a top-level group before finding the parent", () => {
    const parent = { id: "ac-2", controls: [{ id: "ac-2.1" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [
        { id: "ac-1", controls: [{ id: "ac-1.1" }] }, // not the match
        parent,                                       // the match
      ]},
    ]};
    expect(findParentCatalogControl(cat, "ac-2.1")).toBe(parent);
  });

  it("iterates past a control without enhancements when scanning a group", () => {
    const parent = { id: "ac-2", controls: [{ id: "ac-2.1" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [
        { id: "ac-1" },  // no `controls` → `?? []` fallback hits
        parent,
      ]},
    ]};
    expect(findParentCatalogControl(cat, "ac-2.1")).toBe(parent);
  });

  it("iterates past a non-matching control under catalog.controls top-level", () => {
    const parent = { id: "pm-2", controls: [{ id: "pm-2.1" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, controls: [
      { id: "pm-1", controls: [{ id: "pm-1.1" }] }, // not the match
      parent,
    ]};
    expect(findParentCatalogControl(cat, "pm-2.1")).toBe(parent);
  });

  it("iterates past a control without enhancements under catalog.controls top-level", () => {
    const parent = { id: "pm-2", controls: [{ id: "pm-2.1" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, controls: [
      { id: "pm-1" },  // no `controls` → `?? []` fallback hits
      parent,
    ]};
    expect(findParentCatalogControl(cat, "pm-2.1")).toBe(parent);
  });
});

/* ─── findCatalogControl iteration-path closures ─────────────────────── */

describe("findCatalogControl() iteration-path branches", () => {
  it("iterates past a non-matching enhancement before finding a match in a group", () => {
    const enh = { id: "ac-1.2" };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [
        { id: "ac-1", controls: [{ id: "ac-1.1" }, enh] },
      ]},
    ]};
    expect(findCatalogControl(cat, "ac-1.2")).toBe(enh);
  });

  it("iterates a control without `controls` via the ?? [] fallback (group scan)", () => {
    const target = { id: "ac-2" };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [
        { id: "ac-1" }, // no `controls` → `?? []` fallback
        target,
      ]},
    ]};
    expect(findCatalogControl(cat, "ac-2")).toBe(target);
  });

  it("iterates past a non-matching control at catalog.controls top level", () => {
    const target = { id: "pm-2" };
    const cat: any = { uuid: "c", metadata: { title: "" }, controls: [
      { id: "pm-1" },
      target,
    ]};
    expect(findCatalogControl(cat, "pm-2")).toBe(target);
  });

  it("iterates a top-level control without `controls` via the ?? [] fallback", () => {
    // First control has no `controls`; second has one. We search for an
    // enhancement under the second to force iteration through the first
    // control's empty `controls ?? []` arm.
    const enh = { id: "pm-2.1" };
    const cat: any = { uuid: "c", metadata: { title: "" }, controls: [
      { id: "pm-1" }, // no `controls` → `?? []` fallback fires
      { id: "pm-2", controls: [enh] },
    ]};
    expect(findCatalogControl(cat, "pm-2.1")).toBe(enh);
  });

  it("iterates past a non-matching enhancement at catalog.controls top level", () => {
    const target = { id: "pm-1.2" };
    const cat: any = { uuid: "c", metadata: { title: "" }, controls: [
      { id: "pm-1", controls: [{ id: "pm-1.1" }, target] }, // skip pm-1.1, match pm-1.2
    ]};
    expect(findCatalogControl(cat, "pm-1.2")).toBe(target);
  });

  it("returns undefined after iterating multiple non-matching enhancements", () => {
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [
        { id: "ac-1", controls: [{ id: "ac-1.1" }, { id: "ac-1.2" }] },
      ]},
    ]};
    expect(findCatalogControl(cat, "ac-1.99")).toBeUndefined();
  });

  it("recurses past a subgroup with no match before finding it in a later subgroup", () => {
    // Forces `if (found) return found` after a recursive subgroup call
    // returns undefined (falsy arm of L321 in findCatalogControl /
    // analogous arm in findParentCatalogControl).
    const target = { id: "sr-9" };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "outer", title: "Outer", groups: [
        { id: "first", title: "First", controls: [{ id: "other-1" }] }, // miss
        { id: "second", title: "Second", controls: [target] },         // hit
      ]},
    ]};
    expect(findCatalogControl(cat, "sr-9")).toBe(target);
  });

  it("findParentCatalogControl recurses past a subgroup miss before finding the parent", () => {
    const parent = { id: "sr-9", controls: [{ id: "sr-9.1" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "outer", title: "Outer", groups: [
        { id: "first", title: "First", controls: [{ id: "other-1", controls: [{ id: "other-1.1" }] }] },
        { id: "second", title: "Second", controls: [parent] },
      ]},
    ]};
    expect(findParentCatalogControl(cat, "sr-9.1")).toBe(parent);
  });
});
