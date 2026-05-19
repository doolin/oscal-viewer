/* ═══════════════════════════════════════════════════════════════════════════
   Unit tests for useLeveragedIndex — pure-function indexing of leveraged
   SSPs. Ported from
   https://github.com/EasyDynamics/oscal-viewer/pull/56
   ═══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useLeveragedIndex } from "./useLeveragedIndex";
import type { UploadEntry } from "../context/OscalContext";

/* ── Fixture factory ── */

interface ExportedEntry {
  uuid: string;
  description?: string | { prose: string };
  "responsible-roles"?: { "role-id": string }[];
  "provided-uuid"?: string;
}

function entry(
  fileName: string,
  ssp: Record<string, unknown>,
): UploadEntry<unknown> {
  return { fileName, data: ssp };
}

function providerSsp(opts: {
  title?: string;
  wrap?: boolean;
  components?: { uuid: string; title?: string }[];
  irs?: {
    controlId: string;
    byComponents?: {
      componentUuid: string;
      provided?: ExportedEntry[];
      responsibilities?: ExportedEntry[];
      exportDescription?: string;
    }[];
    statements?: {
      byComponents?: {
        componentUuid: string;
        provided?: ExportedEntry[];
        responsibilities?: ExportedEntry[];
      }[];
    }[];
  }[];
  missingMetadata?: boolean;
}): Record<string, unknown> {
  const ssp: Record<string, unknown> = {};
  if (!opts.missingMetadata) ssp.metadata = { title: opts.title ?? "Untitled" };

  if (opts.components) {
    ssp["system-implementation"] = { components: opts.components };
  }

  if (opts.irs) {
    ssp["control-implementation"] = {
      "implemented-requirements": opts.irs.map((ir) => ({
        "control-id": ir.controlId,
        "by-components": (ir.byComponents || []).map((bc) => ({
          "component-uuid": bc.componentUuid,
          export: {
            description: bc.exportDescription,
            provided: bc.provided,
            responsibilities: bc.responsibilities,
          },
        })),
        statements: (ir.statements || []).map((st) => ({
          "by-components": (st.byComponents || []).map((bc) => ({
            "component-uuid": bc.componentUuid,
            export: {
              provided: bc.provided,
              responsibilities: bc.responsibilities,
            },
          })),
        })),
      })),
    };
  }

  return opts.wrap ? { "system-security-plan": ssp } : ssp;
}

/* ── Tests ── */

describe("useLeveragedIndex()", () => {
  it("returns empty maps and zero providers when input is empty", () => {
    const { result } = renderHook(() => useLeveragedIndex([]));
    expect(result.current.provided.size).toBe(0);
    expect(result.current.responsibilities.size).toBe(0);
    expect(result.current.byControl.size).toBe(0);
    expect(result.current.providerCount).toBe(0);
  });

  it("skips entries without metadata (invalid SSP payload)", () => {
    const ssps = [entry("bad.json", providerSsp({ missingMetadata: true, irs: [
      { controlId: "ac-1", byComponents: [{ componentUuid: "c1", provided: [{ uuid: "p1", description: "x" }] }] },
    ] }))];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.providerCount).toBe(0);
    expect(result.current.provided.size).toBe(0);
  });

  it("unwraps system-security-plan key when present", () => {
    const ssps = [entry("wrapped.json", providerSsp({
      title: "Wrapped Provider",
      wrap: true,
      components: [{ uuid: "c1", title: "Comp One" }],
      irs: [{
        controlId: "ac-2",
        byComponents: [{
          componentUuid: "c1",
          provided: [{ uuid: "p-w", description: "wrapped provided" }],
        }],
      }],
    }))];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.provided.get("p-w")?.providerSspTitle).toBe("Wrapped Provider");
  });

  it("defaults the SSP title to 'Untitled SSP' when metadata.title is missing", () => {
    const ssps = [entry("notitle.json", {
      metadata: {},
      "control-implementation": {
        "implemented-requirements": [{
          "control-id": "ac-3",
          "by-components": [{
            "component-uuid": "c1",
            export: { provided: [{ uuid: "p-nt", description: "x" }] },
          }],
        }],
      },
    })];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.provided.get("p-nt")?.providerSspTitle).toBe("Untitled SSP");
  });

  it("indexes provided UUIDs from ir-level by-components", () => {
    const ssps = [entry("p.json", providerSsp({
      title: "AWS",
      components: [{ uuid: "c1", title: "IAM" }],
      irs: [{
        controlId: "ac-2",
        byComponents: [{
          componentUuid: "c1",
          provided: [{
            uuid: "prov-1",
            description: "MFA enforcement",
            "responsible-roles": [{ "role-id": "csp" }],
          }],
        }],
      }],
    }))];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.provided.get("prov-1")).toEqual({
      providerSspTitle: "AWS",
      providerComponentTitle: "IAM",
      controlId: "ac-2",
      description: "MFA enforcement",
      responsibleRoles: [{ roleId: "csp" }],
    });
    expect(result.current.providerCount).toBe(1);
  });

  it("indexes responsibility UUIDs and carries provided-uuid linkage", () => {
    const ssps = [entry("p.json", providerSsp({
      title: "AWS",
      components: [{ uuid: "c1", title: "IAM" }],
      irs: [{
        controlId: "ac-2",
        byComponents: [{
          componentUuid: "c1",
          responsibilities: [{
            uuid: "resp-1",
            description: "Customer configures MFA",
            "responsible-roles": [{ "role-id": "customer" }],
            "provided-uuid": "prov-1",
          }],
        }],
      }],
    }))];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    const r = result.current.responsibilities.get("resp-1");
    expect(r?.linkedProvidedUuid).toBe("prov-1");
    expect(r?.responsibleRoles).toEqual([{ roleId: "customer" }]);
  });

  it("indexes statement-level by-components (not just IR-level)", () => {
    const ssps = [entry("p.json", providerSsp({
      title: "Stmt-level",
      components: [{ uuid: "c1", title: "Comp" }],
      irs: [{
        controlId: "ac-2",
        statements: [{
          byComponents: [{
            componentUuid: "c1",
            provided: [{ uuid: "stmt-prov", description: "via statement" }],
          }],
        }],
      }],
    }))];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.provided.get("stmt-prov")?.controlId).toBe("ac-2");
  });

  it("skips provided / responsibility entries without a uuid", () => {
    const ssps = [entry("p.json", providerSsp({
      title: "Skip-noid",
      components: [{ uuid: "c1" }],
      irs: [{
        controlId: "ac-2",
        byComponents: [{
          componentUuid: "c1",
          provided: [{ uuid: "", description: "no-uuid" }],
          responsibilities: [{ uuid: "", description: "no-uuid-resp" }],
        }],
      }],
    }))];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.provided.size).toBe(0);
    expect(result.current.responsibilities.size).toBe(0);
    // Component is still counted as a provider even when all real entries
    // are skipped (upstream 2033532 / fd9d0cb count by component, not export).
    expect(result.current.providerCount).toBe(1);
  });

  it("skips by-components with no export block (continue branch)", () => {
    const ssps = [entry("p.json", {
      metadata: { title: "No-export" },
      "control-implementation": {
        "implemented-requirements": [{
          "control-id": "ac-2",
          "by-components": [{ "component-uuid": "c1" }],
        }],
      },
    })];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.provided.size).toBe(0);
    // Upstream 2033532 records the control entry even when no export block
    // is present, so the component is now counted as a provider.
    expect(result.current.providerCount).toBe(1);
  });

  it("builds byControl index keyed by control-id (aggregates across providers)", () => {
    const ssps = [
      entry("aws.json", providerSsp({
        title: "AWS",
        components: [{ uuid: "c1", title: "IAM" }],
        irs: [{
          controlId: "ac-2",
          byComponents: [{
            componentUuid: "c1",
            exportDescription: "AWS export",
            provided: [{ uuid: "p-aws", description: "AWS provided" }],
          }],
        }],
      })),
      entry("gcp.json", providerSsp({
        title: "GCP",
        components: [{ uuid: "c2", title: "Cloud IAM" }],
        irs: [{
          controlId: "ac-2",
          byComponents: [{
            componentUuid: "c2",
            exportDescription: "GCP export",
            provided: [{ uuid: "p-gcp", description: "GCP provided" }],
          }],
        }],
      })),
    ];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    const ac2 = result.current.byControl.get("ac-2");
    expect(ac2).toHaveLength(2);
    expect(ac2?.map((e) => e.providerSspTitle).sort()).toEqual(["AWS", "GCP"]);
    expect(result.current.providerCount).toBe(2);
  });

  it("falls back to component-uuid prefix when no component title is present", () => {
    const ssps = [entry("p.json", providerSsp({
      title: "Prefix-fallback",
      components: [{ uuid: "0123456789abcdef-rest", title: "" }],
      irs: [{
        controlId: "ac-2",
        byComponents: [{
          componentUuid: "0123456789abcdef-rest",
          provided: [{ uuid: "p1", description: "x" }],
        }],
      }],
    }))];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.provided.get("p1")?.providerComponentTitle).toBe("0123456789ab");
  });

  it("falls back to uuid-prefix when the component is missing entirely from the map", () => {
    const ssps = [entry("p.json", {
      metadata: { title: "Orphan-comp" },
      "control-implementation": {
        "implemented-requirements": [{
          "control-id": "ac-2",
          "by-components": [{
            "component-uuid": "abcdef0123456789",
            export: { provided: [{ uuid: "p1", description: "x" }] },
          }],
        }],
      },
    })];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.provided.get("p1")?.providerComponentTitle).toBe("abcdef012345");
  });

  it("extracts prose from a structured description object", () => {
    const ssps = [entry("p.json", providerSsp({
      title: "Prose",
      components: [{ uuid: "c1", title: "Comp" }],
      irs: [{
        controlId: "ac-2",
        byComponents: [{
          componentUuid: "c1",
          provided: [{ uuid: "p1", description: { prose: "structured prose" } }],
        }],
      }],
    }))];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.provided.get("p1")?.description).toBe("structured prose");
  });

  it("returns empty maps when control-implementation has no implemented-requirements", () => {
    const ssps = [entry("p.json", {
      metadata: { title: "Empty-CI" },
      "control-implementation": {},
    })];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.providerCount).toBe(0);
  });

  it("returns empty maps when the SSP has no control-implementation at all", () => {
    const ssps = [entry("p.json", {
      metadata: { title: "No-CI" },
    })];
    const { result } = renderHook(() => useLeveragedIndex(ssps));
    expect(result.current.providerCount).toBe(0);
  });

  it("memoizes — same input array reference returns the same index instance", () => {
    const ssps = [entry("p.json", providerSsp({
      title: "Memo",
      components: [{ uuid: "c1" }],
      irs: [{
        controlId: "ac-2",
        byComponents: [{ componentUuid: "c1", provided: [{ uuid: "p1", description: "x" }] }],
      }],
    }))];
    const { result, rerender } = renderHook(
      ({ ssps }: { ssps: UploadEntry<unknown>[] }) => useLeveragedIndex(ssps),
      { initialProps: { ssps } },
    );
    const first = result.current;
    rerender({ ssps });
    expect(result.current).toBe(first);
  });

  it("re-computes when the leveragedSsps array reference changes", () => {
    const fixture = providerSsp({
      title: "Memo",
      components: [{ uuid: "c1" }],
      irs: [{
        controlId: "ac-2",
        byComponents: [{ componentUuid: "c1", provided: [{ uuid: "p1", description: "x" }] }],
      }],
    });
    const { result, rerender } = renderHook(
      ({ ssps }: { ssps: UploadEntry<unknown>[] }) => useLeveragedIndex(ssps),
      { initialProps: { ssps: [entry("a.json", fixture)] } },
    );
    const first = result.current;
    rerender({ ssps: [entry("a.json", fixture)] });
    expect(result.current).not.toBe(first);
  });
});
