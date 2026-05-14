/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  renderParamText,
  resolveInlineParams,
  safeString,
  fmtDate,
  trunc,
  getLabel,
  countControls,
  allControlsFlat,
  findControl,
  findControlGroup,
  findParentControl,
  findGroupById,
} from "./CatalogPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Pure-function unit tests for the helpers exported in PR #69.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Param prose ────────────────────────────────────────────────────── */

describe("renderParamText()", () => {
  it("renders [Selection (one or more): ...] for one-or-more", () => {
    const p: any = { id: "x", select: { "how-many": "one-or-more", choice: ["a", "b"] } };
    expect(renderParamText(p, {})).toBe("[Selection (one or more): a; b]");
  });

  it("renders [Selection: ...] when how-many is omitted", () => {
    const p: any = { id: "x", select: { choice: ["only"] } };
    expect(renderParamText(p, {})).toBe("[Selection: only]");
  });

  it("renders [Selection: ] when choice is missing", () => {
    const p: any = { id: "x", select: {} };
    expect(renderParamText(p, {})).toBe("[Selection: ]");
  });

  it("renders [Assignment: <label>] with label", () => {
    expect(renderParamText({ id: "x", label: "the role" } as any, {}))
      .toBe("[Assignment: the role]");
  });

  it("falls back to id when label is missing", () => {
    expect(renderParamText({ id: "x" } as any, {})).toBe("[Assignment: x]");
  });

  it("resolves inline param tokens inside select choices", () => {
    const map: any = { y: { id: "y", label: "Y-val" } };
    const p: any = { id: "x", select: { choice: ["{{ insert: param, y }}"] } };
    expect(renderParamText(p, map)).toBe("[Selection: [Assignment: Y-val]]");
  });

  it("resolves inline param tokens inside the label", () => {
    const map: any = { y: { id: "y", label: "Y-val" } };
    const p: any = { id: "x", label: "see {{ insert: param, y }}" };
    expect(renderParamText(p, map)).toBe("[Assignment: see [Assignment: Y-val]]");
  });
});

describe("resolveInlineParams()", () => {
  it("returns text unchanged when there are no tokens", () => {
    expect(resolveInlineParams("plain", {})).toBe("plain");
  });

  it("substitutes a known param token", () => {
    const map: any = { p: { id: "p", label: "value" } };
    expect(resolveInlineParams("{{ insert: param, p }}", map))
      .toBe("[Assignment: value]");
  });

  it("inserts [Assignment: id] for unknown param", () => {
    expect(resolveInlineParams("{{ insert: param, missing }}", {}))
      .toBe("[Assignment: missing]");
  });

  it("trims whitespace around the param id", () => {
    const map: any = { p: { id: "p", label: "V" } };
    expect(resolveInlineParams("{{ insert: param,   p   }}", map))
      .toBe("[Assignment: V]");
  });

  it("substitutes multiple tokens in one string", () => {
    const map: any = {
      a: { id: "a", label: "A-val" },
      b: { id: "b", label: "B-val" },
    };
    expect(resolveInlineParams("X {{ insert: param, a }} Y {{ insert: param, b }} Z", map))
      .toBe("X [Assignment: A-val] Y [Assignment: B-val] Z");
  });
});

/* ─── String / value helpers ─────────────────────────────────────────── */

describe("safeString()", () => {
  it("returns '' for null and undefined", () => {
    expect(safeString(null)).toBe("");
    expect(safeString(undefined)).toBe("");
  });

  it("returns a string unchanged", () => {
    expect(safeString("hello")).toBe("hello");
  });

  it("stringifies numbers", () => {
    expect(safeString(42)).toBe("42");
    expect(safeString(0)).toBe("0");
  });

  it("stringifies booleans", () => {
    expect(safeString(true)).toBe("true");
    expect(safeString(false)).toBe("false");
  });

  it("joins array elements with newlines", () => {
    expect(safeString(["a", "b", "c"])).toBe("a\nb\nc");
  });

  it("recurses into arrays of mixed types", () => {
    expect(safeString(["a", 1, true])).toBe("a\n1\ntrue");
  });

  it("renders object entries as 'key: value' joined with semicolons", () => {
    expect(safeString({ low: "L", high: "H" })).toBe("low: L; high: H");
  });

  it("recurses into nested objects", () => {
    expect(safeString({ outer: { inner: "v" } })).toBe("outer: inner: v");
  });

  it("falls back to String() for any other type", () => {
    // Symbol falls through to String() per current behavior
    expect(safeString(Symbol("s"))).toBe("Symbol(s)");
  });
});

describe("fmtDate()", () => {
  it("returns em-dash for undefined input", () => {
    expect(fmtDate(undefined)).toBe("—");
  });

  it("returns em-dash for empty string", () => {
    expect(fmtDate("")).toBe("—");
  });

  it("formats a valid ISO timestamp", () => {
    const out = fmtDate("2026-03-01T00:00:00Z");
    expect(out).toMatch(/^[A-Z][a-z]{2} \d{1,2}, 2026$/);
  });
});

describe("trunc()", () => {
  it("returns string unchanged when shorter than n", () => {
    expect(trunc("short", 10)).toBe("short");
  });

  it("returns string unchanged when length is exactly n", () => {
    expect(trunc("12345", 5)).toBe("12345");
  });

  it("truncates with ellipsis when longer than n", () => {
    expect(trunc("this is a long string", 10)).toBe("this is a …");
  });
});

/* ─── Label resolution ───────────────────────────────────────────────── */

describe("getLabel()", () => {
  it("returns '' when props is undefined", () => {
    expect(getLabel(undefined)).toBe("");
  });

  it("returns '' when no label prop is present", () => {
    expect(getLabel([{ name: "marking", value: "public" }] as any)).toBe("");
  });

  it("returns a regular label", () => {
    expect(getLabel([{ name: "label", value: "AC-1" }] as any)).toBe("AC-1");
  });

  it("prefers non-zero-padded label over zero-padded", () => {
    const props = [
      { name: "label", value: "AC-01", class: "zero-padded" },
      { name: "label", value: "AC-1" },
    ] as any;
    expect(getLabel(props)).toBe("AC-1");
  });

  it("falls back to zero-padded label when only that exists", () => {
    expect(getLabel([
      { name: "label", value: "AC-01", class: "zero-padded" },
    ] as any)).toBe("AC-01");
  });
});

/* ─── Catalog walkers ────────────────────────────────────────────────── */

describe("countControls()", () => {
  it("returns 0 for an empty group", () => {
    expect(countControls({ id: "g", title: "G" } as any)).toBe(0);
  });

  it("counts top-level controls", () => {
    const g: any = { controls: [{ id: "ac-1" }, { id: "ac-2" }] };
    expect(countControls(g)).toBe(2);
  });

  it("counts enhancements as additional controls", () => {
    const g: any = { controls: [
      { id: "ac-1", controls: [{ id: "ac-1.1" }, { id: "ac-1.2" }] },
    ]};
    expect(countControls(g)).toBe(3);
  });

  it("recurses into nested subgroups", () => {
    const g: any = {
      controls: [{ id: "ac-1" }],
      groups: [{ controls: [{ id: "ac-2", controls: [{ id: "ac-2.1" }] }] }],
    };
    expect(countControls(g)).toBe(3);
  });
});

describe("allControlsFlat()", () => {
  it("returns [] for an empty catalog", () => {
    expect(allControlsFlat({} as any)).toEqual([]);
  });

  it("flattens controls from top-level groups", () => {
    const c1: any = { id: "ac-1" };
    const c2: any = { id: "ac-2" };
    const cat: any = { groups: [{ controls: [c1, c2] }] };
    expect(allControlsFlat(cat)).toEqual([c1, c2]);
  });

  it("includes enhancements after their parent control", () => {
    const c: any = { id: "ac-1", controls: [{ id: "ac-1.1" }] };
    const cat: any = { groups: [{ controls: [c] }] };
    const flat = allControlsFlat(cat);
    expect(flat.map((x) => x.id)).toEqual(["ac-1", "ac-1.1"]);
  });

  it("recurses into nested subgroups", () => {
    const cat: any = {
      groups: [{ groups: [{ controls: [{ id: "sr-1", controls: [{ id: "sr-1.1" }] }] }] }],
    };
    expect(allControlsFlat(cat).map((x) => x.id)).toEqual(["sr-1", "sr-1.1"]);
  });

  it("includes controls directly under catalog.controls", () => {
    const c: any = { id: "pm-1", controls: [{ id: "pm-1.1" }] };
    const cat: any = { controls: [c] };
    expect(allControlsFlat(cat).map((x) => x.id)).toEqual(["pm-1", "pm-1.1"]);
  });
});

/* ─── Catalog lookups ────────────────────────────────────────────────── */

describe("findControl()", () => {
  it("finds a control inside a top-level group", () => {
    const c: any = { id: "ac-1" };
    const cat: any = { groups: [{ controls: [c] }] };
    expect(findControl(cat, "ac-1")).toBe(c);
  });

  it("finds an enhancement inside a group control", () => {
    const enh: any = { id: "ac-1.1" };
    const cat: any = { groups: [{ controls: [{ id: "ac-1", controls: [enh] }] }] };
    expect(findControl(cat, "ac-1.1")).toBe(enh);
  });

  it("recurses into nested subgroups", () => {
    const c: any = { id: "sr-1" };
    const cat: any = { groups: [{ groups: [{ controls: [c] }] }] };
    expect(findControl(cat, "sr-1")).toBe(c);
  });

  it("returns undefined when a subgroup search yields nothing", () => {
    const cat: any = { groups: [{ groups: [{ controls: [{ id: "other" }] }] }] };
    expect(findControl(cat, "missing")).toBeUndefined();
  });

  it("finds a control at catalog.controls top level", () => {
    const c: any = { id: "pm-1" };
    const cat: any = { controls: [c] };
    expect(findControl(cat, "pm-1")).toBe(c);
  });

  it("finds an enhancement in catalog.controls", () => {
    const enh: any = { id: "pm-1.1" };
    const cat: any = { controls: [{ id: "pm-1", controls: [enh] }] };
    expect(findControl(cat, "pm-1.1")).toBe(enh);
  });

  it("returns undefined when nothing matches anywhere", () => {
    const cat: any = { groups: [{ controls: [{ id: "ac-1" }] }] };
    expect(findControl(cat, "ia-5")).toBeUndefined();
  });
});

describe("findControlGroup()", () => {
  it("returns the group containing a base control", () => {
    const g: any = { id: "ac", controls: [{ id: "ac-1" }] };
    const cat: any = { groups: [g] };
    expect(findControlGroup(cat, "ac-1")).toBe(g);
  });

  it("returns the group when the id matches an enhancement", () => {
    const g: any = { id: "ac", controls: [{ id: "ac-1", controls: [{ id: "ac-1.1" }] }] };
    const cat: any = { groups: [g] };
    expect(findControlGroup(cat, "ac-1.1")).toBe(g);
  });

  it("recurses into nested subgroups and returns the innermost owner", () => {
    const inner: any = { id: "inner", controls: [{ id: "sr-1" }] };
    const cat: any = { groups: [{ id: "outer", groups: [inner] }] };
    expect(findControlGroup(cat, "sr-1")).toBe(inner);
  });

  it("returns undefined when no group contains the control", () => {
    const cat: any = { groups: [{ controls: [{ id: "ac-1" }] }] };
    expect(findControlGroup(cat, "ia-5")).toBeUndefined();
  });

  it("returns undefined when the catalog has no groups", () => {
    expect(findControlGroup({} as any, "ac-1")).toBeUndefined();
  });
});

describe("findParentControl()", () => {
  it("finds the parent of an enhancement in a top-level group", () => {
    const parent: any = { id: "ac-1", controls: [{ id: "ac-1.1" }] };
    const cat: any = { groups: [{ controls: [parent] }] };
    expect(findParentControl(cat, "ac-1.1")).toBe(parent);
  });

  it("recurses into nested subgroups", () => {
    const parent: any = { id: "sr-1", controls: [{ id: "sr-1.1" }] };
    const cat: any = { groups: [{ groups: [{ controls: [parent] }] }] };
    expect(findParentControl(cat, "sr-1.1")).toBe(parent);
  });

  it("returns undefined when the enhancement isn't found", () => {
    const cat: any = { groups: [{ controls: [{ id: "ac-1" }] }] };
    expect(findParentControl(cat, "ac-1.1")).toBeUndefined();
  });

  it("returns undefined for a catalog without groups", () => {
    expect(findParentControl({} as any, "ac-1.1")).toBeUndefined();
  });
});

describe("findGroupById()", () => {
  it("finds a top-level group by id", () => {
    const g: any = { id: "ac" };
    const cat: any = { groups: [g] };
    expect(findGroupById(cat, "ac")).toBe(g);
  });

  it("finds a nested group recursively", () => {
    const inner: any = { id: "ac-1" };
    const cat: any = { groups: [{ id: "outer", groups: [inner] }] };
    expect(findGroupById(cat, "ac-1")).toBe(inner);
  });

  it("returns undefined when no group matches", () => {
    const cat: any = { groups: [{ id: "ac", groups: [{ id: "ac-1" }] }] };
    expect(findGroupById(cat, "missing")).toBeUndefined();
  });

  it("returns undefined when the catalog has no groups", () => {
    expect(findGroupById({} as any, "ac")).toBeUndefined();
  });
});
