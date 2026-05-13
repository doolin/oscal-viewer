/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  findCatalogControl,
  buildCatalogParamMap,
  renderCatalogParamText,
  resolveCatalogInlineParams,
  getCatalogLabel,
} from "./AssessmentResultsPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Pure-function unit tests for the catalog-enrichment helpers.

   These helpers are intentional scaffolding for upcoming catalog cross-
   referencing UI (cf. upstream EasyDynamics/oscal-viewer PRs #41, #33).
   Their `CatalogPartTree` / `CatalogProseWithParams` callers in this file
   are also part of the scaffold and not yet on the render path — so the
   only way to exercise the helper branches is via direct calls.

   Goal: drive branch coverage on lines 344-421 of AssessmentResultsPage.tsx
   to 100%.
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

  it("recurses into nested subgroups to find a control (covers L353-356)", () => {
    const c = { id: "sr-1", title: "Supply Risk" };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "outer", title: "Outer", groups: [
        { id: "inner", title: "Inner", controls: [c] },
      ]},
    ]};
    expect(findCatalogControl(cat, "sr-1")).toBe(c);
  });

  it("returns undefined from inner searchGroup when a subgroup has no match (covers L357)", () => {
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

  it("finds an enhancement inside catalog.controls (covers L365-367)", () => {
    const enh = { id: "pm-1.1", title: "Enh" };
    const cat: any = { uuid: "c", metadata: { title: "" }, controls: [
      { id: "pm-1", title: "PM-1", controls: [enh] },
    ]};
    expect(findCatalogControl(cat, "pm-1.1")).toBe(enh);
  });

  it("handles a catalog with neither groups nor controls (both falsy paths)", () => {
    const cat: any = { uuid: "c", metadata: { title: "" } };
    expect(findCatalogControl(cat, "ac-1")).toBeUndefined();
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

  it("merges enhancement params (covers L394 .forEach)", () => {
    const ctrl: any = {
      id: "ac-1",
      params: [{ id: "ac-1_prm", label: "own" }],
      controls: [
        { id: "ac-1.1", params: [{ id: "ac-1.1_prm", label: "enh" }] },
        { id: "ac-1.2", params: [{ id: "ac-1.2_prm", label: "enh-2" }] },
      ],
    };
    const map = buildCatalogParamMap(null, ctrl);
    expect(map["ac-1_prm"].label).toBe("own");
    expect(map["ac-1.1_prm"].label).toBe("enh");
    expect(map["ac-1.2_prm"].label).toBe("enh-2");
  });

  it("walks the catalog for an enhancement's parent params (covers searchParent + L389-390)", () => {
    const enh: any = { id: "ac-1.1", params: [{ id: "ac-1.1_prm", label: "enh" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ac", title: "AC", controls: [
        { id: "ac-1", params: [{ id: "ac-1_prm_parent", label: "parent" }], controls: [enh] },
      ]},
    ]};
    const map = buildCatalogParamMap(cat, enh);
    expect(map["ac-1_prm_parent"].label).toBe("parent");
    expect(map["ac-1.1_prm"].label).toBe("enh");
  });

  it("walks nested subgroups when finding the parent (covers searchParent L382-384)", () => {
    const enh: any = { id: "ac-1.1", params: [] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "outer", title: "Outer", groups: [
        { id: "inner", title: "Inner", controls: [
          { id: "ac-1", params: [{ id: "p-nested", label: "found via nested" }], controls: [enh] },
        ]},
      ]},
    ]};
    const map = buildCatalogParamMap(cat, enh);
    expect(map["p-nested"].label).toBe("found via nested");
  });

  it("returns undefined when no parent control contains the target (covers searchParent L386 + L388)", () => {
    const ctrl: any = { id: "ac-1", params: [{ id: "p1", label: "" }] };
    const cat: any = { uuid: "c", metadata: { title: "" }, groups: [
      { id: "ia", title: "IA", controls: [{ id: "ia-5", controls: [{ id: "ia-5.1" }] }] },
    ]};
    const map = buildCatalogParamMap(cat, ctrl);
    expect(Object.keys(map)).toEqual(["p1"]);
  });

  it("handles a control with no params and no enhancement controls (??[] fallbacks)", () => {
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

  it("renders [Selection: ...] when how-many is omitted (falsy/other branch)", () => {
    const param: any = { id: "p", select: { choice: ["only"] } };
    expect(renderCatalogParamText(param, {})).toBe("[Selection: only]");
  });

  it("renders empty Selection brackets when choice is missing (covers ?? [])", () => {
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

  it("resolves nested tokens inside select.choice strings (covers L402 map)", () => {
    const param: any = { id: "p", select: { choice: ["{{ insert: param, q }}"] } };
    const map: any = { q: { id: "q", label: "inner" } };
    expect(renderCatalogParamText(param, map)).toBe("[Selection: [Assignment: inner]]");
  });

  it("resolves nested tokens inside param.label (covers L405 inner branch)", () => {
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

  it("trims whitespace around the param id (covers id.trim())", () => {
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
    ];
    expect(getCatalogLabel(props)).toBe("AC-1");
  });

  it("falls back to zero-padded when it is the only label (?? fallback)", () => {
    const props = [
      { name: "label", value: "AC-01", class: "zero-padded" },
    ];
    expect(getCatalogLabel(props)).toBe("AC-01");
  });
});
