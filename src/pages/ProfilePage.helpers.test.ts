/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  familyPrefix,
  isEnhancement,
  parentControlId,
  controlLabel,
  paramToControlId,
  getLabel,
  resolveImportHref,
  buildFamilyGroups,
  buildAlterMap,
  buildSetParamMap,
  findControlInCatalog,
  findControlGroupInCatalog,
  findParentControlInCatalog,
  findPartById,
  markSubtree,
  renderParamTextProfile,
  resolveInlineParamsProfile,
  resolveControlParts,
} from "./ProfilePage";

/* ═══════════════════════════════════════════════════════════════════════════
   Pure-function unit tests for the helpers exported in PR #62. Drives
   branch coverage on the ProfilePage helpers to (or near) 100%.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Control-id parsing helpers ────────────────────────────────────────── */

describe("familyPrefix()", () => {
  it("extracts the family prefix from a control id", () => {
    expect(familyPrefix("ac-1")).toBe("ac");
  });
  it("lowercases an uppercase prefix", () => {
    expect(familyPrefix("AC-1")).toBe("ac");
  });
  it("handles enhancement ids", () => {
    expect(familyPrefix("ac-2.3")).toBe("ac");
  });
  it("returns the input when no dash is present (no match)", () => {
    expect(familyPrefix("noprefix")).toBe("noprefix");
  });
});

describe("isEnhancement()", () => {
  it("returns true for ids with a dot-digits suffix", () => {
    expect(isEnhancement("ac-2.3")).toBe(true);
    expect(isEnhancement("ac-1.10")).toBe(true);
  });
  it("returns false for base control ids", () => {
    expect(isEnhancement("ac-1")).toBe(false);
  });
  it("returns false when the suffix isn't all digits", () => {
    expect(isEnhancement("ac-1.x")).toBe(false);
  });
});

describe("parentControlId()", () => {
  it("strips the dot-digit suffix to get the parent id", () => {
    expect(parentControlId("ac-2.3")).toBe("ac-2");
  });
  it("returns the input unchanged for a base control id", () => {
    expect(parentControlId("ac-1")).toBe("ac-1");
  });
  it("only strips the last dot-digit group", () => {
    expect(parentControlId("ac-2.3.1")).toBe("ac-2.3");
  });
});

describe("controlLabel()", () => {
  it("uppercases a base control id", () => {
    expect(controlLabel("ac-1")).toBe("AC-1");
  });
  it("renders an enhancement as PARENT(N)", () => {
    expect(controlLabel("ac-2.3")).toBe("AC-2(3)");
  });
  it("handles multi-digit enhancements", () => {
    expect(controlLabel("ac-1.10")).toBe("AC-1(10)");
  });
});

describe("paramToControlId()", () => {
  it("strips leading zeros from base id", () => {
    expect(paramToControlId("ac-01_odp.05")).toBe("ac-1");
  });
  it("strips leading zeros from enhancement id", () => {
    expect(paramToControlId("ac-02.03_odp.01")).toBe("ac-2.3");
  });
  it("returns id unchanged when no leading zeros", () => {
    expect(paramToControlId("ac-1_odp.05")).toBe("ac-1");
  });
});

/* ─── Props / refs ──────────────────────────────────────────────────────── */

describe("getLabel()", () => {
  it("returns '' when props is undefined", () => {
    expect(getLabel(undefined)).toBe("");
  });
  it("returns '' when props has no label", () => {
    expect(getLabel([{ name: "marking", value: "public" }] as any)).toBe("");
  });
  it("returns a regular label", () => {
    expect(getLabel([{ name: "label", value: "AC-1" }] as any)).toBe("AC-1");
  });
  it("prefers a non-zero-padded label when both are present", () => {
    const props = [
      { name: "label", value: "AC-01", class: "zero-padded" },
      { name: "label", value: "AC-1" },
    ] as any;
    expect(getLabel(props)).toBe("AC-1");
  });
  it("falls back to zero-padded when it is the only label", () => {
    const props = [{ name: "label", value: "AC-01", class: "zero-padded" }] as any;
    expect(getLabel(props)).toBe("AC-01");
  });
});

describe("resolveImportHref()", () => {
  it("returns literal URL when href doesn't start with #", () => {
    const profile: any = { "back-matter": { resources: [] } };
    const imp: any = { href: "https://example.com/cat.json" };
    expect(resolveImportHref(profile, imp)).toEqual({
      url: "https://example.com/cat.json",
      title: null,
      resourceUuid: null,
    });
  });

  it("resolves #href via back-matter resources", () => {
    const profile: any = { "back-matter": { resources: [
      { uuid: "res-1", title: "Catalog Res",
        rlinks: [{ href: "https://example.com/cat.json" }] },
    ]}};
    const imp: any = { href: "#res-1" };
    expect(resolveImportHref(profile, imp)).toEqual({
      url: "https://example.com/cat.json",
      title: "Catalog Res",
      resourceUuid: "res-1",
    });
  });

  it("returns null url/title when #href resource is not found", () => {
    const profile: any = { "back-matter": { resources: [] } };
    const imp: any = { href: "#missing" };
    expect(resolveImportHref(profile, imp)).toEqual({
      url: null,
      title: null,
      resourceUuid: "missing",
    });
  });

  it("returns null url when resource has no rlinks", () => {
    const profile: any = { "back-matter": { resources: [
      { uuid: "res-2", title: "Citation Only" },
    ]}};
    const imp: any = { href: "#res-2" };
    expect(resolveImportHref(profile, imp)).toEqual({
      url: null,
      title: "Citation Only",
      resourceUuid: "res-2",
    });
  });

  it("handles profile with no back-matter (?? [] fallback)", () => {
    const profile: any = {};
    const imp: any = { href: "#missing" };
    expect(resolveImportHref(profile, imp)).toEqual({
      url: null, title: null, resourceUuid: "missing",
    });
  });
});

/* ─── Builders ──────────────────────────────────────────────────────────── */

describe("buildFamilyGroups()", () => {
  it("groups control IDs by family prefix", () => {
    const groups = buildFamilyGroups(["ac-1", "ac-2", "ia-5"], null);
    expect(groups.map(g => g.prefix)).toEqual(["ac", "ia"]);
  });

  it("separates base controls from enhancements", () => {
    const groups = buildFamilyGroups(["ac-1", "ac-1.1", "ac-2"], null);
    const ac = groups.find(g => g.prefix === "ac")!;
    expect(ac.controls).toEqual(["ac-1", "ac-2"]);
    expect(ac.enhancements).toEqual(["ac-1.1"]);
    expect(ac.allIds).toEqual(["ac-1", "ac-1.1", "ac-2"]);
  });

  it("uses FAMILY_NAMES fallback when catalog is null", () => {
    const groups = buildFamilyGroups(["ac-1"], null);
    expect(groups[0].name).toBe("Access Control");
  });

  it("uses prefix.toUpperCase() when neither catalog nor FAMILY_NAMES has the prefix", () => {
    const groups = buildFamilyGroups(["xyz-1"], null);
    expect(groups[0].name).toBe("XYZ");
  });

  it("returns empty array for empty input", () => {
    expect(buildFamilyGroups([], null)).toEqual([]);
  });
});

describe("buildAlterMap()", () => {
  it("maps control-id to alter entry", () => {
    const alters = [
      { "control-id": "ac-1", adds: [] } as any,
      { "control-id": "ia-5", removes: [] } as any,
    ];
    const map = buildAlterMap(alters);
    expect(map.get("ac-1")).toBe(alters[0]);
    expect(map.get("ia-5")).toBe(alters[1]);
  });

  it("returns empty Map for empty input", () => {
    expect(buildAlterMap([]).size).toBe(0);
  });

  it("last alter wins when same control-id appears twice", () => {
    const a1 = { "control-id": "ac-1", adds: [{}] } as any;
    const a2 = { "control-id": "ac-1", adds: [{}, {}] } as any;
    const map = buildAlterMap([a1, a2]);
    expect(map.get("ac-1")).toBe(a2);
  });
});

describe("buildSetParamMap()", () => {
  it("maps control-id (from param-id) to set-params", () => {
    const sps = [
      { "param-id": "ac-1_prm_1", values: ["x"] } as any,
      { "param-id": "ac-1_prm_2", values: ["y"] } as any,
      { "param-id": "ia-5_prm_1", values: ["z"] } as any,
    ];
    const map = buildSetParamMap(sps);
    expect(map.get("ac-1")?.length).toBe(2);
    expect(map.get("ia-5")?.length).toBe(1);
  });

  it("returns empty Map for empty input", () => {
    expect(buildSetParamMap([]).size).toBe(0);
  });

  it("handles zero-padded param ids via paramToControlId", () => {
    const sps = [{ "param-id": "ac-01_odp.05", values: [] } as any];
    const map = buildSetParamMap(sps);
    expect(map.has("ac-1")).toBe(true);
  });
});

/* ─── Catalog walkers ──────────────────────────────────────────────────── */

describe("findControlInCatalog()", () => {
  it("finds a control inside a top-level group", () => {
    const c: any = { id: "ac-1", title: "Policy" };
    const cat: any = { groups: [{ id: "ac", controls: [c] }] };
    expect(findControlInCatalog(cat, "ac-1")).toBe(c);
  });

  it("finds an enhancement inside a group control", () => {
    const enh: any = { id: "ac-1.1", title: "Enh" };
    const cat: any = { groups: [{ id: "ac", controls: [
      { id: "ac-1", controls: [enh] },
    ]}]};
    expect(findControlInCatalog(cat, "ac-1.1")).toBe(enh);
  });

  it("recurses into nested subgroups", () => {
    const c: any = { id: "sr-1", title: "Supply Risk" };
    const cat: any = { groups: [
      { id: "outer", groups: [{ id: "inner", controls: [c] }] },
    ]};
    expect(findControlInCatalog(cat, "sr-1")).toBe(c);
  });

  it("returns undefined from inner searchGroup when subgroup has no match", () => {
    const cat: any = { groups: [
      { id: "outer", groups: [{ id: "inner", controls: [{ id: "other" }] }] },
    ]};
    expect(findControlInCatalog(cat, "missing")).toBeUndefined();
  });

  it("finds a control at the catalog.controls top level", () => {
    const c: any = { id: "pm-1" };
    const cat: any = { controls: [c] };
    expect(findControlInCatalog(cat, "pm-1")).toBe(c);
  });

  it("finds an enhancement in catalog.controls", () => {
    const enh: any = { id: "pm-1.1" };
    const cat: any = { controls: [{ id: "pm-1", controls: [enh] }] };
    expect(findControlInCatalog(cat, "pm-1.1")).toBe(enh);
  });

  it("returns undefined when nothing matches anywhere", () => {
    const cat: any = { groups: [{ id: "ac", controls: [{ id: "ac-1" }] }] };
    expect(findControlInCatalog(cat, "ia-5")).toBeUndefined();
  });
});

describe("findControlGroupInCatalog()", () => {
  it("returns the group containing a control", () => {
    const g: any = { id: "ac", title: "AC", controls: [{ id: "ac-1" }] };
    const cat: any = { groups: [g] };
    expect(findControlGroupInCatalog(cat, "ac-1")).toBe(g);
  });

  it("returns the group containing an enhancement", () => {
    const g: any = { id: "ac", title: "AC", controls: [
      { id: "ac-1", controls: [{ id: "ac-1.1" }] },
    ]};
    const cat: any = { groups: [g] };
    expect(findControlGroupInCatalog(cat, "ac-1.1")).toBe(g);
  });

  it("recurses into subgroups", () => {
    const inner: any = { id: "inner", title: "Inner",
      controls: [{ id: "sr-1" }] };
    const cat: any = { groups: [
      { id: "outer", title: "Outer", groups: [inner] },
    ]};
    expect(findControlGroupInCatalog(cat, "sr-1")).toBe(inner);
  });

  it("returns undefined when not found", () => {
    const cat: any = { groups: [{ id: "ac", controls: [{ id: "ac-1" }] }] };
    expect(findControlGroupInCatalog(cat, "missing")).toBeUndefined();
  });
});

describe("findParentControlInCatalog()", () => {
  it("finds the parent of an enhancement in a top-level group", () => {
    const parent: any = { id: "ac-1", controls: [{ id: "ac-1.1" }] };
    const cat: any = { groups: [{ id: "ac", controls: [parent] }] };
    expect(findParentControlInCatalog(cat, "ac-1.1")).toBe(parent);
  });

  it("recurses into nested subgroups to find the parent", () => {
    const parent: any = { id: "ac-1", controls: [{ id: "ac-1.1" }] };
    const cat: any = { groups: [
      { id: "outer", groups: [{ id: "inner", controls: [parent] }] },
    ]};
    expect(findParentControlInCatalog(cat, "ac-1.1")).toBe(parent);
  });

  it("returns undefined when the enhancement isn't a child of any control", () => {
    const cat: any = { groups: [{ id: "ac", controls: [{ id: "ac-1" }] }] };
    expect(findParentControlInCatalog(cat, "ac-1.1")).toBeUndefined();
  });
});

/* ─── Part-tree operations ─────────────────────────────────────────────── */

describe("findPartById()", () => {
  it("returns null when no part matches", () => {
    expect(findPartById([{ id: "a", name: "n" } as any], "missing")).toBeNull();
  });

  it("finds a top-level part and returns its location", () => {
    const p: any = { id: "target", name: "statement" };
    const parts: any = [{ id: "other", name: "n" }, p];
    const loc = findPartById(parts, "target");
    expect(loc).not.toBeNull();
    expect(loc!.part).toBe(p);
    expect(loc!.parentArray).toBe(parts);
    expect(loc!.index).toBe(1);
  });

  it("recurses into nested parts to find a deep target", () => {
    const inner: any = { id: "deep", name: "item" };
    const mid: any = { id: "mid", parts: [inner] };
    const parts: any = [{ id: "outer", parts: [mid] }];
    const loc = findPartById(parts, "deep");
    expect(loc!.part).toBe(inner);
  });

  it("returns null when recursion finds nothing", () => {
    const parts: any = [
      { id: "a", parts: [{ id: "b", parts: [{ id: "c" }] }] },
    ];
    expect(findPartById(parts, "missing")).toBeNull();
  });
});

describe("markSubtree()", () => {
  it("marks a single part with the tailoring tag", () => {
    const p: any = { id: "p", name: "n" };
    markSubtree(p, "removed");
    expect(p._tailoring).toBe("removed");
  });

  it("recursively marks child parts", () => {
    const child: any = { id: "child", name: "n" };
    const parent: any = { id: "parent", name: "n", parts: [child] };
    markSubtree(parent, "added");
    expect(parent._tailoring).toBe("added");
    expect(child._tailoring).toBe("added");
  });

  it("handles a part with no children (falsy parts branch)", () => {
    const p: any = { id: "p", name: "n" };
    markSubtree(p, "added");
    expect(p._tailoring).toBe("added");
  });
});

/* ─── Param resolution ─────────────────────────────────────────────────── */

describe("renderParamTextProfile()", () => {
  it("renders [Selection (one or more): ...] when how-many is 'one-or-more'", () => {
    const param: any = { id: "p", select: { "how-many": "one-or-more", choice: ["a", "b"] } };
    expect(renderParamTextProfile(param, {})).toBe("[Selection (one or more): a; b]");
  });

  it("renders [Selection: ...] when how-many is omitted", () => {
    const param: any = { id: "p", select: { choice: ["only"] } };
    expect(renderParamTextProfile(param, {})).toBe("[Selection: only]");
  });

  it("renders empty Selection brackets when choice is missing", () => {
    const param: any = { id: "p", select: {} };
    expect(renderParamTextProfile(param, {})).toBe("[Selection: ]");
  });

  it("renders [Assignment: <label>] when param has a label", () => {
    const param: any = { id: "p", label: "the role" };
    expect(renderParamTextProfile(param, {})).toBe("[Assignment: the role]");
  });

  it("falls back to param.id when label is missing", () => {
    const param: any = { id: "p" };
    expect(renderParamTextProfile(param, {})).toBe("[Assignment: p]");
  });

  it("resolves nested tokens inside select.choice strings", () => {
    const param: any = { id: "p", select: { choice: ["{{ insert: param, q }}"] } };
    const map: any = { q: { id: "q", label: "inner" } };
    expect(renderParamTextProfile(param, map)).toBe("[Selection: [Assignment: inner]]");
  });

  it("resolves nested tokens inside param.label", () => {
    const param: any = { id: "outer", label: "the {{ insert: param, inner }} pick" };
    const map: any = { inner: { id: "inner", label: "senior" } };
    expect(renderParamTextProfile(param, map))
      .toBe("[Assignment: the [Assignment: senior] pick]");
  });
});

describe("resolveInlineParamsProfile()", () => {
  it("returns text unchanged when no tokens are present", () => {
    expect(resolveInlineParamsProfile("plain text", {})).toBe("plain text");
  });

  it("substitutes a known param token", () => {
    const map: any = { p: { id: "p", label: "value" } };
    expect(resolveInlineParamsProfile("X {{ insert: param, p }} Y", map))
      .toBe("X [Assignment: value] Y");
  });

  it("inserts [Assignment: id] when the param id is unknown", () => {
    expect(resolveInlineParamsProfile("X {{ insert: param, missing }} Y", {}))
      .toBe("X [Assignment: missing] Y");
  });

  it("substitutes multiple tokens", () => {
    const map: any = { a: { id: "a", label: "A" }, b: { id: "b", label: "B" } };
    expect(resolveInlineParamsProfile(
      "{{ insert: param, a }} and {{ insert: param, b }}", map,
    )).toBe("[Assignment: A] and [Assignment: B]");
  });
});

/* ─── Alter resolution ─────────────────────────────────────────────────── */

describe("resolveControlParts()", () => {
  it("returns the catalog parts unchanged when no alter is provided", () => {
    const parts: any = [{ id: "p1", name: "statement", prose: "hello" }];
    const out = resolveControlParts(parts);
    expect(out).toEqual(parts);
    expect(out).not.toBe(parts); // deep cloned
  });

  it("returns parts cloned (no source mutation)", () => {
    const parts: any = [{ id: "p1", name: "statement" }];
    const out = resolveControlParts(parts, { adds: [{ parts: [{ id: "x", name: "n" }] }] } as any);
    expect(parts).toEqual([{ id: "p1", name: "statement" }]); // original unchanged
    expect(out.length).toBeGreaterThan(1);
  });

  it("marks a part as removed when removes.by-id matches", () => {
    const parts: any = [
      { id: "target", name: "statement" },
      { id: "other", name: "guidance" },
    ];
    const out = resolveControlParts(parts, { removes: [{ "by-id": "target" }] } as any);
    expect(out[0]._tailoring).toBe("removed");
    expect(out[1]._tailoring).toBeUndefined();
  });

  it("ignores removes.by-id that don't match any part", () => {
    const parts: any = [{ id: "p1", name: "n" }];
    const out = resolveControlParts(parts, { removes: [{ "by-id": "missing" }] } as any);
    expect(out[0]._tailoring).toBeUndefined();
  });

  it("skips removes without by-id (covers the falsy branch)", () => {
    const parts: any = [{ id: "p1", name: "n" }];
    const out = resolveControlParts(parts, { removes: [{ "by-name": "other" }] } as any);
    expect(out[0]._tailoring).toBeUndefined();
  });

  it("appends new parts to the root when add has no by-id and position is default", () => {
    const parts: any = [{ id: "p1", name: "statement" }];
    const out = resolveControlParts(parts, {
      adds: [{ parts: [{ name: "extra", prose: "added" }] }],
    } as any);
    expect(out.length).toBe(2);
    expect(out[1]._tailoring).toBe("added");
  });

  it("prepends new parts when add has no by-id and position='starting'", () => {
    const parts: any = [{ id: "p1", name: "statement" }];
    const out = resolveControlParts(parts, {
      adds: [{ position: "starting", parts: [{ name: "first", prose: "first" }] }],
    } as any);
    expect(out.length).toBe(2);
    expect((out[0] as any).name).toBe("first");
  });

  it("inserts new parts after the target when position='after' with by-id", () => {
    const parts: any = [
      { id: "p1", name: "statement" },
      { id: "p2", name: "guidance" },
    ];
    const out = resolveControlParts(parts, {
      adds: [{ "by-id": "p1", position: "after", parts: [{ name: "x", prose: "x" }] }],
    } as any);
    expect(out.length).toBe(3);
    expect((out[1] as any).name).toBe("x");
  });

  it("inserts new parts before the target when position='before' with by-id", () => {
    const parts: any = [
      { id: "p1", name: "statement" },
      { id: "p2", name: "guidance" },
    ];
    const out = resolveControlParts(parts, {
      adds: [{ "by-id": "p2", position: "before", parts: [{ name: "y", prose: "y" }] }],
    } as any);
    expect((out[1] as any).name).toBe("y");
  });

  it("nests new parts under target.parts when position='starting' with by-id (no existing parts)", () => {
    const parts: any = [{ id: "p1", name: "statement" }];
    const out = resolveControlParts(parts, {
      adds: [{ "by-id": "p1", position: "starting", parts: [{ name: "child", prose: "c" }] }],
    } as any);
    expect((out[0] as any).parts).toEqual([{ name: "child", prose: "c", _tailoring: "added" }]);
  });

  it("nests new parts under target.parts when position='ending' with by-id (no existing parts)", () => {
    const parts: any = [{ id: "p1", name: "statement" }];
    const out = resolveControlParts(parts, {
      adds: [{ "by-id": "p1", position: "ending", parts: [{ name: "last", prose: "l" }] }],
    } as any);
    expect((out[0] as any).parts).toEqual([{ name: "last", prose: "l", _tailoring: "added" }]);
  });

  it("skips adds with empty parts array (covers L492 continue)", () => {
    const parts: any = [{ id: "p1", name: "statement" }];
    const out = resolveControlParts(parts, { adds: [{ parts: [] }] } as any);
    expect(out.length).toBe(1);
  });

  it("ignores by-id adds when the target part is not found", () => {
    const parts: any = [{ id: "p1", name: "statement" }];
    const out = resolveControlParts(parts, {
      adds: [{ "by-id": "missing", parts: [{ name: "x", prose: "x" }] }],
    } as any);
    expect(out.length).toBe(1);
  });
});
