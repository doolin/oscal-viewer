/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import {
  txt,
  fmtDate,
  trunc,
  extractControlIds,
  findCatalogControl,
  findParentCatalogControl,
  getCatalogLabel,
  resolveInlineParams,
  renderParamText,
  findTaskRecursive,
  findTaskPath,
  filterTasksRecursive,
  collectAllActivities,
  countAllTasks,
} from "./AssessmentPlanPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Pure-function unit tests for the helpers exported in PR #64.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── String / value ───────────────────────────────────────────────────── */

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
    expect(txt({ prose: "wrapped content" })).toBe("wrapped content");
  });

  it("stringifies a non-prose object via String()", () => {
    // Plain object → String(obj) = "[object Object]"
    expect(txt({ x: 1 })).toBe("[object Object]");
  });

  it("stringifies numbers and other non-string values", () => {
    expect(txt(42)).toBe("42");
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
    // The exact formatted output depends on locale/timezone, so check shape
    // rather than the precise string.
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

/* ─── OSCAL parsing ─────────────────────────────────────────────────────── */

describe("extractControlIds()", () => {
  it("returns empty array for selection with neither with-ids nor include-controls", () => {
    expect(extractControlIds({})).toEqual([]);
  });

  it("returns ids from with-ids (string[] form)", () => {
    expect(extractControlIds({ "with-ids": ["ac-1", "ia-5"] })).toEqual(["ac-1", "ia-5"]);
  });

  it("stringifies non-string with-ids entries", () => {
    expect(extractControlIds({ "with-ids": [42] })).toEqual(["42"]);
  });

  it("returns ids from include-controls as string entries", () => {
    expect(extractControlIds({ "include-controls": ["ac-1", "ia-5"] }))
      .toEqual(["ac-1", "ia-5"]);
  });

  it("returns ids from include-controls as {control-id} objects", () => {
    expect(extractControlIds({
      "include-controls": [{ "control-id": "ac-1" }, { "control-id": "ia-5" }],
    })).toEqual(["ac-1", "ia-5"]);
  });

  it("ignores include-controls entries with no control-id", () => {
    expect(extractControlIds({
      "include-controls": [{ matching: "x" }, { "control-id": "ac-1" }],
    })).toEqual(["ac-1"]);
  });

  it("combines with-ids and include-controls", () => {
    expect(extractControlIds({
      "with-ids": ["a"],
      "include-controls": ["b", { "control-id": "c" }],
    })).toEqual(["a", "b", "c"]);
  });
});

/* ─── Catalog walkers ──────────────────────────────────────────────────── */

describe("findCatalogControl()", () => {
  it("finds a control inside a top-level group", () => {
    const c: any = { id: "ac-1", title: "Policy" };
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

  it("returns undefined from inner searchGroup when subgroup has no match", () => {
    const cat: any = { groups: [
      { id: "outer", groups: [{ id: "inner", controls: [{ id: "other" }] }] },
    ]};
    expect(findCatalogControl(cat, "missing")).toBeUndefined();
  });

  it("finds a control at the catalog.controls top level", () => {
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

describe("findParentCatalogControl()", () => {
  it("finds the parent of an enhancement in a top-level group", () => {
    const parent: any = { id: "ac-1", controls: [{ id: "ac-1.1" }] };
    const cat: any = { groups: [{ id: "ac", controls: [parent] }] };
    expect(findParentCatalogControl(cat, "ac-1.1")).toBe(parent);
  });

  it("recurses into nested subgroups", () => {
    const parent: any = { id: "ac-1", controls: [{ id: "ac-1.1" }] };
    const cat: any = { groups: [
      { id: "outer", groups: [{ id: "inner", controls: [parent] }] },
    ]};
    expect(findParentCatalogControl(cat, "ac-1.1")).toBe(parent);
  });

  it("finds the parent in catalog.controls (no groups)", () => {
    const parent: any = { id: "pm-1", controls: [{ id: "pm-1.1" }] };
    const cat: any = { controls: [parent] };
    expect(findParentCatalogControl(cat, "pm-1.1")).toBe(parent);
  });

  it("returns undefined when the enhancement isn't found", () => {
    const cat: any = { groups: [{ id: "ac", controls: [{ id: "ac-1" }] }] };
    expect(findParentCatalogControl(cat, "ac-1.1")).toBeUndefined();
  });

  it("returns undefined for a catalog with neither groups nor controls", () => {
    const cat: any = {};
    expect(findParentCatalogControl(cat, "ac-1.1")).toBeUndefined();
  });

  /* ─── Iteration-path closures targeting L155/L169/L181/L190 partials ─── */

  it("findCatalogControl iterates past a non-matching enhancement to find a later match (L155)", () => {
    const enh: any = { id: "ac-1.2" };
    const cat: any = { groups: [{ id: "ac", controls: [
      { id: "ac-1", controls: [{ id: "ac-1.1" }, enh] },
    ]}]};
    expect(findCatalogControl(cat, "ac-1.2")).toBe(enh);
  });

  it("findCatalogControl iterates a top-level control without `controls` via `?? []` (L169)", () => {
    const target: any = { id: "pm-2" };
    const cat: any = { controls: [
      { id: "pm-1" },  // no `controls` property
      target,
    ]};
    expect(findCatalogControl(cat, "pm-2")).toBe(target);
  });

  it("findCatalogControl iterates past a non-matching enhancement at catalog.controls top-level", () => {
    const enh: any = { id: "pm-1.2" };
    const cat: any = { controls: [
      { id: "pm-1", controls: [{ id: "pm-1.1" }, enh] },
    ]};
    expect(findCatalogControl(cat, "pm-1.2")).toBe(enh);
  });

  it("findParentCatalogControl iterates a control without `controls` before finding the parent (L181)", () => {
    const parent: any = { id: "ac-2", controls: [{ id: "ac-2.1" }] };
    const cat: any = { groups: [{ id: "ac", controls: [
      { id: "ac-1" },  // no `controls`
      parent,
    ]}]};
    expect(findParentCatalogControl(cat, "ac-2.1")).toBe(parent);
  });

  it("findParentCatalogControl iterates a control without `controls` at catalog.controls top-level (L190)", () => {
    const parent: any = { id: "pm-2", controls: [{ id: "pm-2.1" }] };
    const cat: any = { controls: [
      { id: "pm-1" },  // no `controls`
      parent,
    ]};
    expect(findParentCatalogControl(cat, "pm-2.1")).toBe(parent);
  });

  /* These two close the *if-statement* falsy arms inside the subgroup
     recursion and the catalog.controls enhancement loop. The above tests
     close the `?? []` fallbacks; these close the actual if-comparison
     falsy arms. */

  it("findParentCatalogControl outer searchGroup recurses past a subgroup that misses, then finds in a later subgroup (L181 falsy arm)", () => {
    const parent: any = { id: "sr-9", controls: [{ id: "sr-9.1" }] };
    const cat: any = { groups: [
      { id: "outer", groups: [
        // First subgroup: contains a different enhancement that misses the search.
        { id: "first", controls: [{ id: "other-1", controls: [{ id: "other-1.1" }] }] },
        // Second subgroup: contains the parent. searchGroup(first) returns
        // undefined → L181 `if (found)` evaluates FALSY → continue to second.
        { id: "second", controls: [parent] },
      ]},
    ]};
    expect(findParentCatalogControl(cat, "sr-9.1")).toBe(parent);
  });

  it("findParentCatalogControl iterates a non-matching enhancement at catalog.controls level before finding the parent (L190 falsy arm)", () => {
    // The parent's `controls` array contains TWO enhancements; only the
    // second matches enhId. The first iteration evaluates the if as false
    // (closes L190 falsy), the second as true.
    const parent: any = { id: "pm-2", controls: [{ id: "pm-2.skip" }, { id: "pm-2.1" }] };
    const cat: any = { controls: [parent] };
    expect(findParentCatalogControl(cat, "pm-2.1")).toBe(parent);
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

describe("resolveInlineParams()", () => {
  it("returns text unchanged when no tokens", () => {
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

  it("trims whitespace around param id", () => {
    const map: any = { p: { id: "p", label: "V" } };
    expect(resolveInlineParams("{{ insert: param,   p   }}", map))
      .toBe("[Assignment: V]");
  });
});

describe("renderParamText()", () => {
  it("renders [Selection (one or more): ...] for one-or-more", () => {
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

  it("renders [Assignment: <label>] with label", () => {
    expect(renderParamText({ id: "p", label: "the role" } as any, {}))
      .toBe("[Assignment: the role]");
  });

  it("falls back to id when label is missing", () => {
    expect(renderParamText({ id: "p" } as any, {})).toBe("[Assignment: p]");
  });
});

/* ─── Task traversal ───────────────────────────────────────────────────── */

const T = (uuid: string, title: string, type: string = "action", tasks: any[] = [], activities: any[] = []) => ({
  uuid, title, type, tasks, associatedActivities: activities,
}) as any;

describe("findTaskRecursive()", () => {
  it("finds a task at the top level", () => {
    const t = T("t-1", "Task 1");
    expect(findTaskRecursive([t], "t-1")).toBe(t);
  });

  it("finds a task at a deeper level", () => {
    const inner = T("inner", "Inner");
    const outer = T("outer", "Outer", "milestone", [inner]);
    expect(findTaskRecursive([outer], "inner")).toBe(inner);
  });

  it("returns null when the uuid isn't found", () => {
    expect(findTaskRecursive([T("t-1", "T1")], "missing")).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(findTaskRecursive([], "any")).toBeNull();
  });
});

describe("findTaskPath()", () => {
  it("returns a single-element path for a top-level task", () => {
    const t = T("t-1", "Task 1");
    expect(findTaskPath([t], "t-1")).toEqual([t]);
  });

  it("returns ancestors-first path for a deep task", () => {
    const inner = T("inner", "Inner");
    const mid = T("mid", "Mid", "action", [inner]);
    const outer = T("outer", "Outer", "milestone", [mid]);
    const path = findTaskPath([outer], "inner")!;
    expect(path.map(t => t.uuid)).toEqual(["outer", "mid", "inner"]);
  });

  it("returns null when not found", () => {
    expect(findTaskPath([T("t-1", "T1")], "missing")).toBeNull();
  });
});

describe("filterTasksRecursive()", () => {
  it("returns empty list when query matches nothing", () => {
    const tasks = [T("t-1", "Hello", "action")];
    expect(filterTasksRecursive(tasks, "xyz")).toEqual([]);
  });

  it("keeps a task whose title matches the query", () => {
    const tasks = [T("t-1", "Audit Phase", "action")];
    const out = filterTasksRecursive(tasks, "audit");
    expect(out.length).toBe(1);
    expect(out[0].uuid).toBe("t-1");
  });

  it("keeps a task whose type matches the query", () => {
    const tasks = [T("t-1", "Hello", "milestone")];
    expect(filterTasksRecursive(tasks, "milestone")[0].uuid).toBe("t-1");
  });

  it("keeps a parent whose child matches even if parent doesn't", () => {
    const inner = T("inner", "Specific Activity", "action");
    const outer = T("outer", "Generic Task", "action", [inner]);
    const out = filterTasksRecursive([outer], "specific");
    expect(out.length).toBe(1);
    expect(out[0].uuid).toBe("outer");
    expect(out[0].tasks[0].uuid).toBe("inner");
  });

  it("keeps a task with a matching associated activity title", () => {
    const activity = { uuid: "a-1", title: "Probe Audit Logs", steps: [] };
    const t = T("t-1", "Generic", "action", [], [activity]);
    expect(filterTasksRecursive([t], "probe")[0].uuid).toBe("t-1");
  });

  it("keeps a task with a matching activity step title", () => {
    const activity = { uuid: "a-1", title: "Generic", steps: [{ title: "Probe Step" }] };
    const t = T("t-1", "Generic", "action", [], [activity]);
    expect(filterTasksRecursive([t], "probe")[0].uuid).toBe("t-1");
  });

  it("when parent matches, keeps original children (covers matchesSelf branch)", () => {
    const inner = T("inner", "non-match", "action");
    const outer = T("audit-parent", "Audit Phase", "action", [inner]);
    const out = filterTasksRecursive([outer], "audit");
    // matchesSelf is true → keeps t.tasks as-is, not filteredChildren
    expect(out[0].tasks[0].uuid).toBe("inner");
  });
});

describe("collectAllActivities()", () => {
  it("returns empty for empty task list", () => {
    expect(collectAllActivities([])).toEqual([]);
  });

  it("collects activities from a single task", () => {
    const a1 = { uuid: "a-1", title: "A1", steps: [] };
    const a2 = { uuid: "a-2", title: "A2", steps: [] };
    const t = T("t-1", "T1", "action", [], [a1, a2]);
    expect(collectAllActivities([t])).toEqual([a1, a2]);
  });

  it("collects activities from nested subtasks", () => {
    const a1 = { uuid: "a-1", title: "A1", steps: [] };
    const a2 = { uuid: "a-2", title: "A2", steps: [] };
    const inner = T("inner", "Inner", "action", [], [a2]);
    const outer = T("outer", "Outer", "milestone", [inner], [a1]);
    expect(collectAllActivities([outer])).toEqual([a1, a2]);
  });
});

describe("countAllTasks()", () => {
  it("returns 0 for empty list", () => {
    expect(countAllTasks([])).toBe(0);
  });

  it("counts top-level tasks", () => {
    expect(countAllTasks([T("a", "A"), T("b", "B"), T("c", "C")])).toBe(3);
  });

  it("counts nested subtasks recursively", () => {
    const tree = [
      T("a", "A", "action", [T("a1", "A1"), T("a2", "A2")]),
      T("b", "B", "action", [T("b1", "B1", "action", [T("b1.1", "B1.1")])]),
    ];
    // a + a1 + a2 + b + b1 + b1.1 = 6
    expect(countAllTasks(tree)).toBe(6);
  });
});
