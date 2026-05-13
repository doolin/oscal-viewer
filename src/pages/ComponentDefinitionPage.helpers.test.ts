/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  findCatalogControl,
  findPartById,
  buildCatalogParamMap,
  renderCatalogParamText,
  resolveCatalogInlineParams,
  getCatalogLabel,
} from "./ComponentDefinitionPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Pure-function unit tests for the catalog-enrichment helpers exported
   in PR #58. Drives branch coverage on lines 218-310 of
   ComponentDefinitionPage.tsx to (or near) 100%.

   These functions are reachable from rendering paths, but many of
   their internal recursion and switch branches are not exercised by
   the existing UI tests because that would require fixtures with
   every catalog shape variant. Direct unit testing is faster + more
   reliable, and the existing UI tests still cover the end-to-end
   integration.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── findCatalogControl ────────────────────────────────────────────────── */

describe("findCatalogControl()", () => {
  it("returns undefined for a null catalog", () => {
    expect(findCatalogControl(null, "ac-1")).toBeUndefined();
  });

  it("returns undefined when the control id is not present anywhere", () => {
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "g", title: "G", controls: [{ id: "x-1", title: "X-1" }] },
    ]};
    expect(findCatalogControl(cat, "no-such-id")).toBeUndefined();
  });

  it("finds a control inside a top-level group", () => {
    const c = { id: "ac-1", title: "Policy" };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "Access Control", controls: [c] },
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

  it("handles a catalog with neither groups nor controls", () => {
    const cat: any = { uuid: "c", metadata: { title: "" } };
    expect(findCatalogControl(cat, "ac-1")).toBeUndefined();
  });
});

/* ─── findPartById ──────────────────────────────────────────────────────── */

describe("findPartById()", () => {
  it("returns undefined when parts array is empty", () => {
    expect(findPartById([], "any")).toBeUndefined();
  });

  it("returns undefined when no part matches", () => {
    const parts: any = [{ id: "a", name: "n" }, { id: "b", name: "n" }];
    expect(findPartById(parts, "missing")).toBeUndefined();
  });

  it("finds a part at the top level", () => {
    const p: any = { id: "target", name: "statement" };
    expect(findPartById([{ id: "other", name: "n" }, p] as any, "target")).toBe(p);
  });

  it("recurses into nested parts to find a deep target", () => {
    const inner: any = { id: "deep", name: "item" };
    const parts: any = [
      { id: "outer", name: "statement", parts: [
        { id: "mid", name: "item", parts: [inner] },
      ]},
    ];
    expect(findPartById(parts, "deep")).toBe(inner);
  });

  it("returns undefined when nested recursion finds nothing", () => {
    const parts: any = [
      { id: "outer", name: "statement", parts: [
        { id: "mid", name: "item", parts: [{ id: "leaf", name: "x" }] },
      ]},
    ];
    expect(findPartById(parts, "not-here")).toBeUndefined();
  });

  it("handles a part with no `parts` field (covers the falsy branch)", () => {
    const parts: any = [
      { id: "a", name: "n" }, // no .parts
      { id: "b", name: "n", parts: [{ id: "c", name: "n" }] },
    ];
    expect(findPartById(parts, "c")).toEqual({ id: "c", name: "n" });
  });
});

/* ─── buildCatalogParamMap ──────────────────────────────────────────────── */

describe("buildCatalogParamMap()", () => {
  it("returns control's own params for a null catalog", () => {
    const ctrl: any = {
      id: "ac-1",
      params: [{ id: "ac-1_prm_1", label: "label-a" }],
    };
    const map = buildCatalogParamMap(null, ctrl);
    expect(Object.keys(map)).toEqual(["ac-1_prm_1"]);
    expect(map["ac-1_prm_1"].label).toBe("label-a");
  });

  it("merges enhancement params", () => {
    const ctrl: any = {
      id: "ac-1",
      params: [{ id: "own", label: "own" }],
      controls: [
        { id: "ac-1.1", params: [{ id: "enh-1", label: "enh1" }] },
        { id: "ac-1.2", params: [{ id: "enh-2", label: "enh2" }] },
      ],
    };
    const map = buildCatalogParamMap(null, ctrl);
    expect(map["own"].label).toBe("own");
    expect(map["enh-1"].label).toBe("enh1");
    expect(map["enh-2"].label).toBe("enh2");
  });

  it("walks the catalog for an enhancement's parent params", () => {
    const enh: any = { id: "ac-1.1", params: [{ id: "enh", label: "enh" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [
        { id: "ac-1", params: [{ id: "parent", label: "parent" }], controls: [enh] },
      ]},
    ]};
    const map = buildCatalogParamMap(cat, enh);
    expect(map["parent"].label).toBe("parent");
    expect(map["enh"].label).toBe("enh");
  });

  it("walks nested subgroups when finding the parent", () => {
    const enh: any = { id: "ac-1.1", params: [] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "outer", title: "Outer", groups: [
        { id: "inner", title: "Inner", controls: [
          { id: "ac-1", params: [{ id: "p-nested", label: "nested" }], controls: [enh] },
        ]},
      ]},
    ]};
    const map = buildCatalogParamMap(cat, enh);
    expect(map["p-nested"].label).toBe("nested");
  });

  it("returns no parent params when no parent control contains the target", () => {
    const ctrl: any = { id: "ac-1", params: [{ id: "p1", label: "" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ia", title: "IA", controls: [{ id: "ia-5", controls: [{ id: "ia-5.1" }] }] },
    ]};
    const map = buildCatalogParamMap(cat, ctrl);
    expect(Object.keys(map)).toEqual(["p1"]);
  });

  it("handles a control with no params and no enhancements", () => {
    const ctrl: any = { id: "naked" };
    expect(buildCatalogParamMap(null, ctrl)).toEqual({});
  });
});

/* ─── renderCatalogParamText ────────────────────────────────────────────── */

describe("renderCatalogParamText()", () => {
  it("renders [Selection (one or more): ...] when how-many is 'one-or-more'", () => {
    const param: any = { id: "p", select: { "how-many": "one-or-more", choice: ["a", "b"] } };
    expect(renderCatalogParamText(param, {})).toBe("[Selection (one or more): a; b]");
  });

  it("renders [Selection: ...] when how-many is omitted", () => {
    const param: any = { id: "p", select: { choice: ["only"] } };
    expect(renderCatalogParamText(param, {})).toBe("[Selection: only]");
  });

  it("renders empty Selection brackets when choice is missing", () => {
    const param: any = { id: "p", select: {} };
    expect(renderCatalogParamText(param, {})).toBe("[Selection: ]");
  });

  it("renders [Assignment: <label>] when param has a label", () => {
    const param: any = { id: "p", label: "the role" };
    expect(renderCatalogParamText(param, {})).toBe("[Assignment: the role]");
  });

  it("falls back to param.id when label is missing", () => {
    const param: any = { id: "p" };
    expect(renderCatalogParamText(param, {})).toBe("[Assignment: p]");
  });

  it("resolves nested tokens inside select.choice strings", () => {
    const param: any = { id: "p", select: { choice: ["{{ insert: param, q }}"] } };
    const map: any = { q: { id: "q", label: "inner" } };
    expect(renderCatalogParamText(param, map)).toBe("[Selection: [Assignment: inner]]");
  });

  it("resolves nested tokens inside param.label", () => {
    const param: any = { id: "outer", label: "the {{ insert: param, inner }} pick" };
    const map: any = { inner: { id: "inner", label: "senior" } };
    expect(renderCatalogParamText(param, map)).toBe("[Assignment: the [Assignment: senior] pick]");
  });
});

/* ─── resolveCatalogInlineParams ────────────────────────────────────────── */

describe("resolveCatalogInlineParams()", () => {
  it("returns text unchanged when no tokens are present", () => {
    expect(resolveCatalogInlineParams("plain text", {})).toBe("plain text");
  });

  it("substitutes a known param token via renderCatalogParamText", () => {
    const map: any = { p: { id: "p", label: "value" } };
    expect(resolveCatalogInlineParams("X {{ insert: param, p }} Y", map))
      .toBe("X [Assignment: value] Y");
  });

  it("inserts [Assignment: id] when the param id is unknown", () => {
    expect(resolveCatalogInlineParams("X {{ insert: param, missing }} Y", {}))
      .toBe("X [Assignment: missing] Y");
  });

  it("substitutes multiple tokens in the same string", () => {
    const map: any = { a: { id: "a", label: "A" }, b: { id: "b", label: "B" } };
    expect(resolveCatalogInlineParams("{{ insert: param, a }} and {{ insert: param, b }}", map))
      .toBe("[Assignment: A] and [Assignment: B]");
  });

  it("trims whitespace around the param id", () => {
    const map: any = { p: { id: "p", label: "V" } };
    expect(resolveCatalogInlineParams("{{ insert: param,   p   }}", map))
      .toBe("[Assignment: V]");
  });
});

/* ─── getCatalogLabel ───────────────────────────────────────────────────── */

describe("getCatalogLabel()", () => {
  it("returns '' when props is undefined", () => {
    expect(getCatalogLabel(undefined)).toBe("");
  });

  it("returns '' when props array contains no label", () => {
    expect(getCatalogLabel([{ name: "marking", value: "public" }])).toBe("");
  });

  it("returns a regular label", () => {
    expect(getCatalogLabel([{ name: "label", value: "AC-1" }])).toBe("AC-1");
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
