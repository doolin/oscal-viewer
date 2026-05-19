/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { colors } from "../theme/tokens";
import {
  txt,
  fmtDate,
  trunc,
  componentTypeNavKey,
  componentTypeColor,
  assetTypeIconKey,
  assetTypeColor,
  inventoryItemIcon,
  getFamily,
  getParentControlId,
  findCatalogControl,
  findPartById,
  buildCatalogParamMap,
  renderCatalogParamText,
  resolveCatalogInlineParams,
  getCatalogLabel,
  hrefToUuid,
  buildComponentHierarchy,
  parseSsp,
  renderMarkup,
} from "./SspPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Pure-function unit tests for the helpers exported in PR #66.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── String / value ──────────────────────────────────────────────────── */

describe("txt()", () => {
  it("returns '' for falsy values", () => {
    expect(txt(undefined)).toBe("");
    expect(txt(null)).toBe("");
    expect(txt("")).toBe("");
    expect(txt(0)).toBe("");
  });

  it("returns a string value unchanged", () => {
    expect(txt("hello")).toBe("hello");
  });

  it("unwraps a {prose: ...} object via the prose key", () => {
    expect(txt({ prose: "wrapped" })).toBe("wrapped");
  });

  it("stringifies a non-prose object via String()", () => {
    expect(txt({ x: 1 })).toBe("[object Object]");
  });

  it("stringifies numbers and other non-string values", () => {
    expect(txt(42)).toBe("42");
    expect(txt(true)).toBe("true");
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

/* ─── Component-type switch arms ──────────────────────────────────────── */

describe("componentTypeNavKey()", () => {
  it.each([
    ["this-system", "this-system"],
    ["system", "ext-system"],
    ["interconnection", "interconnection"],
    ["software", "software"],
    ["hardware", "hardware"],
    ["service", "service"],
    ["policy", "policy"],
    ["physical", "physical"],
    ["process-procedure", "process-procedure"],
    ["plan", "plan"],
    ["guidance", "guidance"],
    ["standard", "standard"],
    ["validation", "validation"],
    ["network", "network"],
  ])("maps %s → %s", (input, expected) => {
    expect(componentTypeNavKey(input)).toBe(expected);
  });

  it("defaults to 'cube' for unknown types", () => {
    expect(componentTypeNavKey("unknown")).toBe("cube");
    expect(componentTypeNavKey("")).toBe("cube");
  });
});

describe("componentTypeColor()", () => {
  it.each([
    ["this-system", colors.navy],
    ["system", colors.cobalt],
    ["interconnection", colors.purple],
    ["software", colors.brightBlue],
    ["hardware", colors.blueGray],
    ["service", colors.mint],
    ["policy", colors.orange],
    ["physical", colors.darkGreen],
    ["process-procedure", colors.cobalt],
    ["plan", colors.brightBlue],
    ["guidance", colors.yellow],
    ["standard", colors.red],
    ["validation", colors.darkGreen],
    ["network", colors.purple],
  ])("maps %s → its color", (input, expected) => {
    expect(componentTypeColor(input)).toBe(expected);
  });

  it("defaults to cobalt for unknown types", () => {
    expect(componentTypeColor("mystery")).toBe(colors.cobalt);
  });
});

/* ─── Asset-type switch arms ─────────────────────────────────────────── */

describe("assetTypeIconKey()", () => {
  it.each([
    ["os", "software"],
    ["database", "software"],
    ["web-server", "software"],
    ["application", "software"],
    ["appliance", "hardware"],
    ["network", "network"],
    ["switch", "network"],
    ["router", "network"],
    ["firewall", "network"],
    ["storage", "hardware"],
    ["virtual", "ext-system"],
    ["virtual-machine", "ext-system"],
    ["compute", "ext-system"],
    ["software", "software"],
    ["hardware", "hardware"],
    ["service", "service"],
    ["this-system", "this-system"],
    ["interconnection", "interconnection"],
    ["policy", "policy"],
    ["physical", "physical"],
    ["process-procedure", "process-procedure"],
    ["plan", "plan"],
    ["guidance", "guidance"],
    ["standard", "standard"],
    ["validation", "validation"],
  ])("maps %s → %s", (input, expected) => {
    expect(assetTypeIconKey(input)).toBe(expected);
  });

  it("lowercases input before matching", () => {
    expect(assetTypeIconKey("OS")).toBe("software");
    expect(assetTypeIconKey("Firewall")).toBe("network");
  });

  it("defaults to 'box' for unknown types", () => {
    expect(assetTypeIconKey("widget")).toBe("box");
    expect(assetTypeIconKey("")).toBe("box");
  });
});

describe("assetTypeColor()", () => {
  it.each([
    ["os", colors.brightBlue],
    ["database", colors.cobalt],
    ["web-server", colors.brightBlue],
    ["application", colors.brightBlue],
    ["appliance", colors.blueGray],
    ["network", colors.purple],
    ["switch", colors.purple],
    ["router", colors.purple],
    ["firewall", colors.purple],
    ["storage", colors.blueGray],
    ["virtual", colors.cobalt],
    ["virtual-machine", colors.cobalt],
    ["compute", colors.cobalt],
    ["software", colors.brightBlue],
    ["hardware", colors.blueGray],
    ["service", colors.mint],
  ])("maps %s → its color", (input, expected) => {
    expect(assetTypeColor(input)).toBe(expected);
  });

  it("lowercases input before matching", () => {
    expect(assetTypeColor("OS")).toBe(colors.brightBlue);
  });

  it("defaults to darkGreen for unknown types", () => {
    expect(assetTypeColor("mystery")).toBe(colors.darkGreen);
    expect(assetTypeColor("")).toBe(colors.darkGreen);
  });
});

/* ─── inventoryItemIcon: prop-first, then component fallback ──────────── */

describe("inventoryItemIcon()", () => {
  it("uses the asset-type prop when present", () => {
    const ii: any = {
      props: [{ name: "asset-type", value: "firewall" }],
      implementedComponents: [],
    };
    expect(inventoryItemIcon(ii, [])).toEqual({
      iconKey: "network",
      color: colors.purple,
    });
  });

  it("ignores non-asset-type props when resolving", () => {
    const ii: any = {
      props: [{ name: "other", value: "os" }],
      implementedComponents: [],
    };
    expect(inventoryItemIcon(ii, [])).toEqual({
      iconKey: "box",
      color: colors.darkGreen,
    });
  });

  it("falls back to first implemented-component's type when no asset-type prop", () => {
    const ii: any = {
      props: [],
      implementedComponents: [{ componentUuid: "c1" }],
    };
    const components: any = [{ uuid: "c1", type: "software" }];
    expect(inventoryItemIcon(ii, components)).toEqual({
      iconKey: "software",
      color: colors.brightBlue,
    });
  });

  it("skips implementedComponents that don't match a known component", () => {
    const ii: any = {
      props: [],
      implementedComponents: [
        { componentUuid: "missing" },
        { componentUuid: "c2" },
      ],
    };
    const components: any = [{ uuid: "c2", type: "hardware" }];
    expect(inventoryItemIcon(ii, components)).toEqual({
      iconKey: "hardware",
      color: colors.blueGray,
    });
  });

  it("returns the default {box, darkGreen} when no asset-type and no matching component", () => {
    const ii: any = {
      props: [],
      implementedComponents: [{ componentUuid: "ghost" }],
    };
    expect(inventoryItemIcon(ii, [])).toEqual({
      iconKey: "box",
      color: colors.darkGreen,
    });
  });

  it("skips component fallback when component.type is empty/falsy", () => {
    const ii: any = {
      props: [],
      implementedComponents: [{ componentUuid: "c1" }, { componentUuid: "c2" }],
    };
    const components: any = [
      { uuid: "c1", type: "" },
      { uuid: "c2", type: "service" },
    ];
    expect(inventoryItemIcon(ii, components)).toEqual({
      iconKey: "service",
      color: colors.mint,
    });
  });
});

/* ─── Control-id helpers ─────────────────────────────────────────────── */

describe("getFamily()", () => {
  it("extracts the prefix from a base control id", () => {
    expect(getFamily("ac-1")).toBe("ac");
  });

  it("extracts the prefix from an enhancement id", () => {
    expect(getFamily("ac-2.1")).toBe("ac");
  });

  it("lowercases an uppercase prefix", () => {
    expect(getFamily("AC-1")).toBe("ac");
  });

  it("returns the input unchanged when no alpha prefix matches", () => {
    expect(getFamily("123")).toBe("123");
  });
});

describe("getParentControlId()", () => {
  it("returns the parent id for an enhancement", () => {
    expect(getParentControlId("ac-2.1")).toBe("ac-2");
  });

  it("returns null for a base control id (no dot)", () => {
    expect(getParentControlId("ac-1")).toBeNull();
  });

  it("splits on the last dot only", () => {
    expect(getParentControlId("ac-2.3.1")).toBe("ac-2.3");
  });
});

/* ─── Catalog walkers ────────────────────────────────────────────────── */

describe("findCatalogControl()", () => {
  it("returns undefined when the catalog is null", () => {
    expect(findCatalogControl(null, "ac-1")).toBeUndefined();
  });

  it("finds a control inside a top-level group", () => {
    const c: any = { id: "ac-1" };
    const cat: any = { groups: [{ id: "ac", controls: [c] }] };
    expect(findCatalogControl(cat, "ac-1")).toBe(c);
  });

  it("finds an enhancement inside a group control", () => {
    const enh: any = { id: "ac-1.1" };
    const cat: any = { groups: [{ id: "ac", controls: [
      { id: "ac-1", controls: [enh] },
    ]}]};
    expect(findCatalogControl(cat, "ac-1.1")).toBe(enh);
  });

  it("recurses into nested subgroups", () => {
    const c: any = { id: "sr-1" };
    const cat: any = { groups: [
      { id: "outer", groups: [{ id: "inner", controls: [c] }] },
    ]};
    expect(findCatalogControl(cat, "sr-1")).toBe(c);
  });

  it("returns undefined when a subgroup search yields nothing", () => {
    const cat: any = { groups: [
      { id: "outer", groups: [{ id: "inner", controls: [{ id: "other" }] }] },
    ]};
    expect(findCatalogControl(cat, "missing")).toBeUndefined();
  });

  it("finds a control at catalog.controls top level", () => {
    const c: any = { id: "pm-1" };
    const cat: any = { controls: [c] };
    expect(findCatalogControl(cat, "pm-1")).toBe(c);
  });

  it("finds an enhancement in catalog.controls", () => {
    const enh: any = { id: "pm-1.1" };
    const cat: any = { controls: [{ id: "pm-1", controls: [enh] }] };
    expect(findCatalogControl(cat, "pm-1.1")).toBe(enh);
  });

  it("returns undefined when nothing matches anywhere", () => {
    const cat: any = { groups: [{ id: "ac", controls: [{ id: "ac-1" }] }] };
    expect(findCatalogControl(cat, "ia-5")).toBeUndefined();
  });
});

describe("findPartById()", () => {
  it("returns undefined for an empty parts array", () => {
    expect(findPartById([], "p")).toBeUndefined();
  });

  it("finds a part at the top level", () => {
    const p: any = { id: "p1" };
    expect(findPartById([p], "p1")).toBe(p);
  });

  it("recurses into nested parts", () => {
    const inner: any = { id: "p1.a" };
    const outer: any = { id: "p1", parts: [inner] };
    expect(findPartById([outer], "p1.a")).toBe(inner);
  });

  it("returns undefined when the id is not present anywhere", () => {
    const parts: any = [{ id: "p1", parts: [{ id: "p1.a" }] }];
    expect(findPartById(parts, "missing")).toBeUndefined();
  });
});

describe("buildCatalogParamMap()", () => {
  it("returns an empty map for a control with no params and no catalog", () => {
    const ctl: any = { id: "ac-1" };
    expect(buildCatalogParamMap(null, ctl)).toEqual({});
  });

  it("indexes a control's own params", () => {
    const ctl: any = { id: "ac-1", params: [{ id: "ac-1_prm_1", label: "L" }] };
    const m = buildCatalogParamMap(null, ctl);
    expect(m["ac-1_prm_1"]).toBe(ctl.params[0]);
  });

  it("includes params from nested enhancements", () => {
    const ctl: any = {
      id: "ac-1",
      controls: [{ id: "ac-1.1", params: [{ id: "ac-1.1_prm_1" }] }],
    };
    const m = buildCatalogParamMap(null, ctl);
    expect(m["ac-1.1_prm_1"]).toBe(ctl.controls[0].params[0]);
  });

  it("merges parent params when control is an enhancement found in catalog", () => {
    const enh: any = { id: "ac-1.1", params: [{ id: "ac-1.1_prm" }] };
    const parent: any = { id: "ac-1", controls: [enh], params: [{ id: "ac-1_prm" }] };
    const cat: any = { groups: [{ id: "ac", controls: [parent] }] };
    const m = buildCatalogParamMap(cat, enh);
    expect(m["ac-1_prm"]).toBe(parent.params[0]);
    expect(m["ac-1.1_prm"]).toBe(enh.params[0]);
  });

  it("recurses subgroups to find the parent control", () => {
    const enh: any = { id: "sr-1.1" };
    const parent: any = { id: "sr-1", controls: [enh], params: [{ id: "sr-1_prm" }] };
    const cat: any = { groups: [
      { id: "outer", groups: [{ id: "inner", controls: [parent] }] },
    ]};
    const m = buildCatalogParamMap(cat, enh);
    expect(m["sr-1_prm"]).toBe(parent.params[0]);
  });

  it("yields no parent params when the control is not an enhancement in the catalog", () => {
    const ctl: any = { id: "ac-1", params: [{ id: "ac-1_prm" }] };
    const cat: any = { groups: [{ id: "ac", controls: [ctl] }] };
    const m = buildCatalogParamMap(cat, ctl);
    expect(Object.keys(m)).toEqual(["ac-1_prm"]);
  });
});

describe("renderCatalogParamText()", () => {
  it("renders [Selection (one or more): ...] for one-or-more", () => {
    const p: any = { id: "x", select: { "how-many": "one-or-more", choice: ["a", "b"] } };
    expect(renderCatalogParamText(p, {})).toBe("[Selection (one or more): a; b]");
  });

  it("renders [Selection: ...] when how-many is omitted", () => {
    const p: any = { id: "x", select: { choice: ["only"] } };
    expect(renderCatalogParamText(p, {})).toBe("[Selection: only]");
  });

  it("renders [Selection: ] when choice is missing", () => {
    const p: any = { id: "x", select: {} };
    expect(renderCatalogParamText(p, {})).toBe("[Selection: ]");
  });

  it("renders [Assignment: <label>] with label", () => {
    expect(renderCatalogParamText({ id: "x", label: "the role" } as any, {}))
      .toBe("[Assignment: the role]");
  });

  it("falls back to id when label is missing", () => {
    expect(renderCatalogParamText({ id: "x" } as any, {})).toBe("[Assignment: x]");
  });

  it("resolves inline param tokens inside select choices", () => {
    const map: any = { y: { id: "y", label: "Y-val" } };
    const p: any = { id: "x", select: { choice: ["{{ insert: param, y }}"] } };
    expect(renderCatalogParamText(p, map)).toBe("[Selection: [Assignment: Y-val]]");
  });

  it("resolves inline param tokens inside the label", () => {
    const map: any = { y: { id: "y", label: "Y-val" } };
    const p: any = { id: "x", label: "see {{ insert: param, y }}" };
    expect(renderCatalogParamText(p, map)).toBe("[Assignment: see [Assignment: Y-val]]");
  });
});

describe("resolveCatalogInlineParams()", () => {
  it("returns text unchanged when there are no tokens", () => {
    expect(resolveCatalogInlineParams("plain", {})).toBe("plain");
  });

  it("substitutes a known param token", () => {
    const map: any = { p: { id: "p", label: "value" } };
    expect(resolveCatalogInlineParams("{{ insert: param, p }}", map))
      .toBe("[Assignment: value]");
  });

  it("inserts [Assignment: id] for unknown param", () => {
    expect(resolveCatalogInlineParams("{{ insert: param, missing }}", {}))
      .toBe("[Assignment: missing]");
  });

  it("trims whitespace around the param id", () => {
    const map: any = { p: { id: "p", label: "V" } };
    expect(resolveCatalogInlineParams("{{ insert: param,   p   }}", map))
      .toBe("[Assignment: V]");
  });
});

describe("getCatalogLabel()", () => {
  it("returns '' when props is undefined", () => {
    expect(getCatalogLabel(undefined)).toBe("");
  });

  it("returns '' when no label prop is present", () => {
    expect(getCatalogLabel([{ name: "marking", value: "public" }] as any)).toBe("");
  });

  it("returns a regular label", () => {
    expect(getCatalogLabel([{ name: "label", value: "AC-1" }] as any)).toBe("AC-1");
  });

  it("prefers non-zero-padded label over zero-padded", () => {
    const props = [
      { name: "label", value: "AC-01", class: "zero-padded" },
      { name: "label", value: "AC-1" },
    ] as any;
    expect(getCatalogLabel(props)).toBe("AC-1");
  });

  it("falls back to zero-padded label when only that exists", () => {
    expect(getCatalogLabel([
      { name: "label", value: "AC-01", class: "zero-padded" },
    ] as any)).toBe("AC-01");
  });
});

/* ─── hrefToUuid ─────────────────────────────────────────────────────── */

describe("hrefToUuid()", () => {
  it("returns '' for empty href", () => {
    expect(hrefToUuid("")).toBe("");
  });

  it("strips a leading '#' fragment marker", () => {
    expect(hrefToUuid("#abc-123")).toBe("abc-123");
  });

  it("returns the input unchanged when there is no leading '#'", () => {
    expect(hrefToUuid("abc-123")).toBe("abc-123");
  });
});

/* ─── buildComponentHierarchy ───────────────────────────────────────── */

describe("buildComponentHierarchy()", () => {
  it("returns an empty hierarchy for an empty array", () => {
    const { rootIndices, childrenByIndex } = buildComponentHierarchy([]);
    expect(rootIndices).toEqual([]);
    expect(childrenByIndex.size).toBe(0);
  });

  it("treats every component as a root when there are no service links", () => {
    const comps: any = [
      { uuid: "a", type: "software", links: [] },
      { uuid: "b", type: "hardware", links: [] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0, 1]);
    expect(childrenByIndex.size).toBe(0);
  });

  it("creates a parent→child link via provided-by", () => {
    const comps: any = [
      { uuid: "svc", type: "service", links: [{ rel: "provided-by", href: "#leaf" }] },
      { uuid: "leaf", type: "software", links: [] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0]);
    expect(childrenByIndex.get(0)).toEqual([1]);
  });

  it("creates a parent→child link via used-by when no provided-by claims the child", () => {
    const comps: any = [
      { uuid: "svc", type: "service", links: [{ rel: "used-by", href: "#leaf" }] },
      { uuid: "leaf", type: "software", links: [] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0]);
    expect(childrenByIndex.get(0)).toEqual([1]);
  });

  it("lets provided-by win over used-by on conflict", () => {
    const comps: any = [
      { uuid: "p", type: "service", links: [{ rel: "provided-by", href: "#leaf" }] },
      { uuid: "u", type: "service", links: [{ rel: "used-by", href: "#leaf" }] },
      { uuid: "leaf", type: "software", links: [] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0, 1]);
    expect(childrenByIndex.get(0)).toEqual([2]);
    expect(childrenByIndex.has(1)).toBe(false);
  });

  it("ignores non-service components when scanning for claims", () => {
    const comps: any = [
      { uuid: "sw", type: "software", links: [{ rel: "provided-by", href: "#leaf" }] },
      { uuid: "leaf", type: "software", links: [] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0, 1]);
    expect(childrenByIndex.size).toBe(0);
  });

  it("skips self-reference links", () => {
    const comps: any = [
      { uuid: "svc", type: "service", links: [
        { rel: "provided-by", href: "#svc" },
        { rel: "used-by", href: "#svc" },
      ] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0]);
    expect(childrenByIndex.size).toBe(0);
  });

  it("skips links pointing to unknown UUIDs", () => {
    const comps: any = [
      { uuid: "svc", type: "service", links: [
        { rel: "provided-by", href: "#ghost" },
        { rel: "used-by", href: "#also-ghost" },
      ] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0]);
    expect(childrenByIndex.size).toBe(0);
  });

  it("ignores irrelevant link rels", () => {
    const comps: any = [
      { uuid: "svc", type: "service", links: [{ rel: "related-to", href: "#leaf" }] },
      { uuid: "leaf", type: "software", links: [] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0, 1]);
    expect(childrenByIndex.size).toBe(0);
  });

  it("keeps the first claim and drops duplicate provided-by claims of the same child", () => {
    const comps: any = [
      { uuid: "first", type: "service", links: [{ rel: "provided-by", href: "#leaf" }] },
      { uuid: "second", type: "service", links: [{ rel: "provided-by", href: "#leaf" }] },
      { uuid: "leaf", type: "software", links: [] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0, 1]);
    expect(childrenByIndex.get(0)).toEqual([2]);
    expect(childrenByIndex.has(1)).toBe(false);
  });

  it("keeps the first claim and drops duplicate used-by claims of the same child", () => {
    const comps: any = [
      { uuid: "first", type: "service", links: [{ rel: "used-by", href: "#leaf" }] },
      { uuid: "second", type: "service", links: [{ rel: "used-by", href: "#leaf" }] },
      { uuid: "leaf", type: "software", links: [] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0, 1]);
    expect(childrenByIndex.get(0)).toEqual([2]);
    expect(childrenByIndex.has(1)).toBe(false);
  });

  it("sorts children by original component-array order", () => {
    const comps: any = [
      { uuid: "svc", type: "service", links: [
        { rel: "provided-by", href: "#c" },
        { rel: "provided-by", href: "#a" },
      ] },
      { uuid: "a", type: "software", links: [] },
      { uuid: "b", type: "software", links: [] },
      { uuid: "c", type: "software", links: [] },
    ];
    const { childrenByIndex } = buildComponentHierarchy(comps);
    expect(childrenByIndex.get(0)).toEqual([1, 3]);
  });

  it("handles hrefs without a '#' fragment marker", () => {
    const comps: any = [
      { uuid: "svc", type: "service", links: [{ rel: "provided-by", href: "leaf" }] },
      { uuid: "leaf", type: "software", links: [] },
    ];
    const { rootIndices, childrenByIndex } = buildComponentHierarchy(comps);
    expect(rootIndices).toEqual([0]);
    expect(childrenByIndex.get(0)).toEqual([1]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Pure-function unit tests for the parseSsp + renderMarkup helpers
   exported in PR #97. Uses the maximalist/minimalist fixture pattern
   (user's "GFO" technique) to drive truthy + falsy arms of every
   `||` and `??` default in parseSsp.
   ═══════════════════════════════════════════════════════════════════════════ */

describe("parseSsp()", () => {
  it("throws when ssp.metadata is missing", () => {
    expect(() => parseSsp({})).toThrow(/missing metadata/);
  });

  it("unwraps the system-security-plan key when present (?? raw arm)", () => {
    const raw = { "system-security-plan": { metadata: { title: "Wrapped" } } };
    expect(parseSsp(raw).metadata.title).toBe("Wrapped");
  });

  it("accepts a bare SSP object when system-security-plan key is absent", () => {
    expect(parseSsp({ metadata: { title: "Bare" } }).metadata.title).toBe("Bare");
  });

  /* ─── Minimalist fixture — every `|| default` arm fires ───────────── */
  it("applies every default when input is the bare minimum (only metadata)", () => {
    const out = parseSsp({ metadata: {} });

    expect(out.metadata.title).toBe("Untitled SSP");
    expect(out.metadata.version).toBe("");
    expect(out.metadata.oscalVersion).toBe("");
    expect(out.metadata.lastModified).toBe("");
    expect(out.metadata.published).toBe("");
    expect(out.metadata.parties).toEqual([]);
    expect(out.metadata.roles).toEqual([]);
    expect(out.metadata.responsibleParties).toEqual([]);

    expect(out.systemCharacteristics.systemName).toBe("");
    expect(out.systemCharacteristics.systemNameShort).toBe("");
    expect(out.systemCharacteristics.description).toBe("");
    expect(out.systemCharacteristics.securitySensitivityLevel).toBe("");
    expect(out.systemCharacteristics.systemIds).toEqual([]);
    expect(out.systemCharacteristics.securityImpactLevel).toEqual({
      objectiveConfidentiality: "",
      objectiveIntegrity: "",
      objectiveAvailability: "",
    });
    expect(out.systemCharacteristics.status).toEqual({ state: "", remarks: "" });
    expect(out.systemCharacteristics.authorizationBoundary).toEqual({ description: "" });
    expect(out.systemCharacteristics.props).toEqual([]);

    expect(out.systemImplementation.users).toEqual([]);
    expect(out.systemImplementation.components).toEqual([]);
    expect(out.systemImplementation.inventoryItems).toEqual([]);
    expect(out.systemImplementation.leveragedAuthorizations).toEqual([]);

    expect(out.controlImplementation.description).toBe("");
    expect(out.controlImplementation.implementedRequirements).toEqual([]);

    expect(out.backMatter).toEqual([]);
    expect(out.importProfileHref).toBe("");
  });

  /* ─── Maximalist fixture — every truthy arm fires ─────────────────── */
  it("preserves every field when input is fully populated", () => {
    const raw = {
      metadata: {
        title: "Full SSP",
        version: "1.2.0",
        "oscal-version": "1.1.2",
        "last-modified": "2026-05-14T00:00:00Z",
        published: "2026-04-01T00:00:00Z",
        parties: [{ uuid: "p1", name: "Acme", type: "organization" }],
        roles: [
          { id: "owner", title: "System Owner" },
          { id: "no-title" },  // → title falls back to id
        ],
        "responsible-parties": [
          { "role-id": "owner", "party-uuids": ["p1"] },
          { "role-id": "auditor" },  // → party-uuids defaults to []
        ],
      },
      "system-characteristics": {
        "system-name": "ACME-001",
        "system-name-short": "ACME",
        description: "A system",
        "security-sensitivity-level": "moderate",
        "system-ids": [
          "string-id",  // string variant
          { id: "obj-id", "identifier-type": "https://fedramp" },  // object variant
          {},  // object missing id → ""
        ],
        "security-impact-level": {
          "security-objective-confidentiality": "moderate",
          "security-objective-integrity": "low",
          "security-objective-availability": "high",
        },
        status: { state: "operational", remarks: "all good" },
        "authorization-boundary": { description: "boundary text" },
        props: [{ name: "x", value: "y" }],
      },
      "system-implementation": {
        users: [{
          uuid: "u1",
          title: "User One",
          description: "desc",
          "role-ids": ["owner"],
          "authorized-privileges": [
            { title: "Admin", "functions-performed": ["read", "write"] },
            {},  // → defaults trigger
          ],
        }],
        components: [{
          uuid: "c1",
          type: "software",
          title: "Comp",
          description: "comp desc",
          status: { state: "operational" },
          props: [{ name: "a", value: "b" }],
          links: [
            { href: "https://x", rel: "reference", text: "label" },
            {},  // → all defaults
          ],
        }],
        "inventory-items": [{
          uuid: "ii-1",
          description: "inv",
          props: [{ name: "asset-type", value: "appliance" }],
          "implemented-components": [{ "component-uuid": "c1" }],
        }],
        "leveraged-authorizations": [{
          uuid: "la-1",
          title: "AWS GovCloud",
          "party-uuid": "p1",
          "date-authorized": "2025-01-01",
        }],
      },
      "control-implementation": {
        description: "control impl desc",
        "implemented-requirements": [{
          uuid: "ir-1",
          "control-id": "ac-1",
          description: "ir desc",
          remarks: "ir remarks",
          props: [{ name: "a", value: "b" }],
          statements: [{
            "statement-id": "ac-1_smt.a",
            uuid: "s1",
            description: "stmt",
            remarks: "stmt remarks",
            "by-components": [{
              "component-uuid": "c1",
              uuid: "bc1",
              description: "bc desc",
              remarks: "bc remarks",
              "implementation-status": { state: "implemented" },
            }],
          }],
          "by-components": [{
            "component-uuid": "c1",
            uuid: "bc2",
            description: "bc2 desc",
            remarks: "bc2 remarks",
            "implementation-status": { state: "planned" },
          }],
          "responsible-roles": [{ "role-id": "owner", "party-uuids": ["p1"] }],
          links: [{ href: "#res-1", rel: "evidence", text: "see this" }],
        }],
      },
      "back-matter": {
        resources: [{
          uuid: "res-1",
          title: "Res 1",
          description: "r desc",
          props: [{ name: "a", value: "b" }],
          rlinks: [{ href: "https://x/r1.pdf" }],
        }],
      },
      "import-profile": { href: "https://x/profile.json" },
    };

    const out = parseSsp(raw);

    expect(out.metadata.title).toBe("Full SSP");
    expect(out.metadata.version).toBe("1.2.0");
    expect(out.metadata.oscalVersion).toBe("1.1.2");
    expect(out.metadata.parties).toEqual([{ uuid: "p1", name: "Acme", type: "organization" }]);
    expect(out.metadata.roles).toEqual([
      { id: "owner", title: "System Owner" },
      { id: "no-title", title: "no-title" },  // fallback to id
    ]);
    expect(out.metadata.responsibleParties[1].partyUuids).toEqual([]);  // default-[] arm

    expect(out.systemCharacteristics.systemName).toBe("ACME-001");
    expect(out.systemCharacteristics.systemIds).toEqual([
      { id: "string-id", identifierType: undefined },
      { id: "obj-id", identifierType: "https://fedramp" },
      { id: "", identifierType: undefined },  // s.id || "" arm
    ]);
    expect(out.systemCharacteristics.status.state).toBe("operational");
    expect(out.systemCharacteristics.authorizationBoundary.description).toBe("boundary text");

    expect(out.systemImplementation.users[0].authorizedPrivileges[1].title).toBe("");  // default arm
    expect(out.systemImplementation.users[0].authorizedPrivileges[1].functionsPerformed).toEqual([]);
    expect(out.systemImplementation.components[0].links[0]).toEqual({
      href: "https://x", rel: "reference", text: "label",
    });
    expect(out.systemImplementation.components[0].links[1]).toEqual({
      href: "", rel: undefined, text: undefined,  // all-defaults link
    });
    expect(out.systemImplementation.inventoryItems[0].implementedComponents[0].componentUuid).toBe("c1");
    expect(out.systemImplementation.leveragedAuthorizations[0].title).toBe("AWS GovCloud");

    expect(out.controlImplementation.implementedRequirements[0].statements[0].byComponents[0]
      .implementationStatus).toBe("implemented");
    expect(out.controlImplementation.implementedRequirements[0].byComponents[0]
      .implementationStatus).toBe("planned");
    expect(out.controlImplementation.implementedRequirements[0].responsibleRoles[0].roleId).toBe("owner");
    expect(out.controlImplementation.implementedRequirements[0].links[0]).toEqual({
      href: "#res-1", rel: "evidence", text: "see this",
    });

    expect(out.backMatter[0].title).toBe("Res 1");
    expect(out.importProfileHref).toBe("https://x/profile.json");
  });

  /* ─── Targeted defaults that need their own row ────────────────── */
  it("defaults link href/rel/text when missing on a component link", () => {
    const out = parseSsp({
      metadata: {},
      "system-implementation": {
        components: [{ uuid: "c1", links: [{}] }],
      },
    });
    expect(out.systemImplementation.components[0].links[0]).toEqual({
      href: "", rel: undefined, text: undefined,
    });
  });

  it("defaults bc.implementation-status to '' when state is missing", () => {
    const out = parseSsp({
      metadata: {},
      "control-implementation": {
        "implemented-requirements": [{
          uuid: "ir1",
          statements: [{ "by-components": [{ "component-uuid": "c1" }] }],
          "by-components": [{ "component-uuid": "c1" }],
        }],
      },
    });
    expect(out.controlImplementation.implementedRequirements[0].statements[0]
      .byComponents[0].implementationStatus).toBe("");
    expect(out.controlImplementation.implementedRequirements[0].byComponents[0]
      .implementationStatus).toBe("");
  });

  /* ─── #55 SSP export support — parseByComp / parseSetParams / parseRoles / parseLinks
       (exercised via parseSsp; helpers themselves are module-private). Ported from
       https://github.com/EasyDynamics/oscal-viewer/pull/55 ──────────────── */

  it("populates by-component export block (provided + responsibilities)", () => {
    const out = parseSsp({
      metadata: {},
      "control-implementation": {
        "implemented-requirements": [{
          uuid: "ir1",
          "by-components": [{
            "component-uuid": "c1",
            export: {
              description: "exported scope",
              remarks: "export remarks",
              provided: [{
                uuid: "prov-1",
                description: "provided capability",
                remarks: "p remarks",
                "responsible-roles": [{ "role-id": "csp", "party-uuids": ["p1"] }],
                props: [{ name: "x", value: "y" }],
                links: [{ href: "#a" }],
              }],
              responsibilities: [{
                uuid: "resp-1",
                description: "customer responsibility",
                remarks: "r remarks",
                "responsible-roles": [{ "role-id": "customer" }],
                "provided-uuid": "prov-1",
              }],
            },
          }],
        }],
      },
    });
    const bc = out.controlImplementation.implementedRequirements[0].byComponents[0];
    expect(bc.export?.description).toBe("exported scope");
    expect(bc.export?.provided[0].uuid).toBe("prov-1");
    expect(bc.export?.provided[0].responsibleRoles[0].roleId).toBe("csp");
    expect(bc.export?.provided[0].links[0].href).toBe("#a");
    expect(bc.export?.responsibilities[0].providedUuid).toBe("prov-1");
    expect(bc.export?.responsibilities[0].responsibleRoles[0].partyUuids).toEqual([]);
  });

  it("leaves bc.export undefined when the export key is absent", () => {
    const out = parseSsp({
      metadata: {},
      "control-implementation": {
        "implemented-requirements": [{
          uuid: "ir1",
          "by-components": [{ "component-uuid": "c1" }],
        }],
      },
    });
    expect(out.controlImplementation.implementedRequirements[0].byComponents[0].export).toBeUndefined();
  });

  it("populates by-component inherited + satisfied entries", () => {
    const out = parseSsp({
      metadata: {},
      "control-implementation": {
        "implemented-requirements": [{
          uuid: "ir1",
          "by-components": [{
            "component-uuid": "c1",
            inherited: [{
              uuid: "ih-1",
              description: "inherited from parent",
              "provided-uuid": "prov-X",
              "responsible-roles": [{ "role-id": "csp" }],
            }],
            satisfied: [{
              uuid: "sat-1",
              description: "satisfied response",
              "responsibility-uuid": "resp-X",
              "responsible-roles": [{ "role-id": "customer" }],
              remarks: "sat remarks",
            }],
          }],
        }],
      },
    });
    const bc = out.controlImplementation.implementedRequirements[0].byComponents[0];
    expect(bc.inherited[0].providedUuid).toBe("prov-X");
    expect(bc.inherited[0].responsibleRoles[0].roleId).toBe("csp");
    expect(bc.satisfied[0].responsibilityUuid).toBe("resp-X");
    expect(bc.satisfied[0].remarks).toBe("sat remarks");
  });

  it("populates set-parameters at by-component AND ir level", () => {
    const out = parseSsp({
      metadata: {},
      "control-implementation": {
        "implemented-requirements": [{
          uuid: "ir1",
          "set-parameters": [
            { "param-id": "ac-1_prm_1", values: ["weekly"], remarks: "freq" },
            {},  // → all defaults
          ],
          "by-components": [{
            "component-uuid": "c1",
            "set-parameters": [{ "param-id": "ac-1_prm_2", values: ["v"] }],
          }],
        }],
      },
    });
    const ir = out.controlImplementation.implementedRequirements[0];
    expect(ir.setParameters).toHaveLength(2);
    expect(ir.setParameters[0]).toEqual({
      paramId: "ac-1_prm_1", values: ["weekly"], remarks: "freq",
    });
    expect(ir.setParameters[1]).toEqual({ paramId: "", values: [], remarks: "" });
    expect(ir.byComponents[0].setParameters[0].paramId).toBe("ac-1_prm_2");
  });

  it("populates by-component links and responsible-roles", () => {
    const out = parseSsp({
      metadata: {},
      "control-implementation": {
        "implemented-requirements": [{
          uuid: "ir1",
          "by-components": [{
            "component-uuid": "c1",
            links: [{ href: "#evidence", rel: "evidence", text: "see log" }],
            "responsible-roles": [{ "role-id": "owner", "party-uuids": ["p1"] }],
          }],
        }],
      },
    });
    const bc = out.controlImplementation.implementedRequirements[0].byComponents[0];
    expect(bc.links[0]).toEqual({ href: "#evidence", rel: "evidence", text: "see log" });
    expect(bc.responsibleRoles[0]).toEqual({ roleId: "owner", partyUuids: ["p1"] });
  });

  it("populates component.responsibleRoles (system-implementation)", () => {
    const out = parseSsp({
      metadata: {},
      "system-implementation": {
        components: [{
          uuid: "c1",
          "responsible-roles": [{ "role-id": "owner", "party-uuids": ["p1"] }],
        }],
      },
    });
    expect(out.systemImplementation.components[0].responsibleRoles[0]).toEqual({
      roleId: "owner", partyUuids: ["p1"],
    });
  });
});

/* ─── renderMarkup — markdown → HTML with bare-<p> unwrap ──────────── */
describe("renderMarkup()", () => {
  it("unwraps a single paragraph to inline HTML", () => {
    expect(renderMarkup("hello")).toBe("hello");
  });

  it("preserves inline formatting inside the unwrapped paragraph", () => {
    const out = renderMarkup("hello **world**");
    expect(out).toContain("<strong>world</strong>");
    expect(out.startsWith("<p>")).toBe(false);
  });

  it("does not unwrap when there are multiple paragraphs", () => {
    const out = renderMarkup("para one\n\npara two");
    expect(out).toContain("<p>para one</p>");
    expect(out).toContain("<p>para two</p>");
    expect(out.startsWith("<p>")).toBe(true);
    expect(out.endsWith("</p>")).toBe(true);
  });

  it("does not unwrap non-paragraph block elements (e.g. lists)", () => {
    const out = renderMarkup("- item one\n- item two");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>item one</li>");
    expect(out.startsWith("<p>")).toBe(false);
  });

  it("returns an empty string for empty input", () => {
    expect(renderMarkup("")).toBe("");
  });
});
