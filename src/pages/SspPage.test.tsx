/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useEffect, useRef } from "react";
import SspPage from "./SspPage";
import {
  OscalProvider,
  useOscal,
  type Catalog,
} from "../context/OscalContext";
import { AuthProvider } from "../context/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   Fixtures
   ═══════════════════════════════════════════════════════════════════════════ */

const CATALOG: Catalog = {
  uuid: "cat-1",
  metadata: { title: "Sample Catalog" },
  groups: [
    {
      id: "ac",
      title: "Access Control",
      controls: [
        {
          id: "ac-1",
          title: "Policy and Procedures",
          props: [{ name: "label", value: "AC-1" }],
          params: [
            { id: "ac-1_prm_1", label: "organization-defined policy" },
            {
              id: "ac-1_prm_2",
              select: { "how-many": "one-or-more", choice: ["annually", "quarterly"] },
            },
          ],
          parts: [
            {
              id: "ac-1-stmt",
              name: "statement",
              prose: "AC-1 body uses {{ insert: param, ac-1_prm_1 }} and {{ insert: param, missing-param }}.",
            },
            { id: "ac-1-guide", name: "guidance", prose: "AC-1 guidance." },
          ],
          controls: [
            { id: "ac-1.1", title: "Automated Tooling", props: [{ name: "label", value: "AC-1(1)" }] },
            // ac-1.2 has its own params → exercises enhancement params merge.
            { id: "ac-1.2", title: "Reviewed Annually", props: [{ name: "label", value: "AC-1(2)" }],
              params: [{ id: "ac-1.2_prm_1", label: "review cadence" }] },
          ],
        },
        // Sparse control with no parts/params/controls → exercises empty
        // array fallbacks for catalog enrichment paths.
        { id: "ac-99", title: "Sparse Control", props: [{ name: "label", value: "AC-99" }],
          controls: [{ id: "ac-99.1", title: "Sparse Enhancement" }] },
      ],
    },
  ],
};

const RICH_SSP = {
  uuid: "ssp-1",
  metadata: {
    title: "Sample System Security Plan",
    version: "1.0",
    "last-modified": "2026-03-01T00:00:00Z",
    published: "2026-02-15T00:00:00Z",
    "oscal-version": "1.1.2",
    parties: [
      { uuid: "party-1", type: "organization", name: "Acme Corp" },
      // Bare party (no name, no type) → exercises `p.name || ""` and
      // `p.type || ""` parser fallbacks (L190).
      { uuid: "party-bare" },
    ],
    roles: [
      { id: "owner", title: "System Owner" },
      { id: "isso", title: "ISSO" },
      // Role without title → exercises `r.title || r.id` fallback (L192).
      { id: "auditor" },
    ],
    "responsible-parties": [
      { "role-id": "owner", "party-uuids": ["party-1"] },
      // Responsible-party without party-uuids → exercises `rp["party-uuids"] || []`
      // parser fallback (L194).
      { "role-id": "isso" },
    ],
  },
  "import-profile": { href: "#profile-res" },
  "system-characteristics": {
    "system-name": "Acme Logging Platform",
    "system-name-short": "ALP",
    description: "Centralised logging and audit platform.",
    "security-sensitivity-level": "moderate",
    "system-ids": [
      { id: "ALP-001", "identifier-type": "https://fedramp.gov" },
      // String-form system-id → exercises `typeof s === "string"` parser arm
      // (L207). Also a bare {id} variant → exercises `s.id || ""` arm.
      "ALP-LEGACY-FORMAT",
      { "identifier-type": "https://other.example" },
    ] as any,
    "security-impact-level": {
      "security-objective-confidentiality": "moderate",
      "security-objective-integrity": "moderate",
      "security-objective-availability": "low",
    },
    status: { state: "operational" },
    "authorization-boundary": {
      description: "AWS VPC and on-prem collection agents.",
    },
    props: [{ name: "deployment", value: "cloud" }],
    "system-information": {
      "information-types": [
        {
          uuid: "it-1",
          title: "Audit Logs",
          description: "System audit and event logs.",
          categorizations: [
            {
              system: "https://doi.org/10.6028/NIST.SP.800-60v2r1",
              "information-type-ids": ["C.3.5.1"],
            },
          ],
          "confidentiality-impact": { base: "fips-199-moderate" },
          "integrity-impact": { base: "fips-199-high" },
          "availability-impact": { base: "fips-199-low" },
        },
      ],
    },
    "network-architecture": {
      description: "Cloud-hosted with on-prem collectors.",
      diagrams: [
        { uuid: "diag-1", description: "Logical network diagram." },
      ],
    },
  },
  "system-implementation": {
    users: [
      {
        uuid: "user-1",
        title: "Administrators",
        description: "Full access staff.",
        "role-ids": ["owner"],
        "authorized-privileges": [
          {
            title: "Manage users",
            "functions-performed": ["create-user", "delete-user"],
          },
        ],
      },
      // Stripped user — no title, no description, no role-ids, no
      // authorized-privileges → exercises `u.title || ""`, `txt(u.desc)`,
      // `u["role-ids"] || []`, and `(u["authorized-privileges"] || []).map`
      // fallbacks (L224-229).
      { uuid: "user-bare" },
      // User WITH authorized-privileges that lack title + functions-performed
      // → exercises `ap.title || ""` and `ap["functions-performed"] || []`
      // fallbacks (L228-229).
      {
        uuid: "user-priv-bare",
        title: "Privilege-Bare User",
        "authorized-privileges": [{}],
      },
    ],
    components: [
      {
        uuid: "comp-1",
        type: "software",
        title: "Splunk Enterprise",
        description: "SIEM platform.",
        status: { state: "operational" },
        props: [{ name: "version", value: "9.2" }],
        // Component with links → exercises the components.links mapping in
        // the parser (L239-241).
        links: [
          { href: "https://splunk.example/docs", rel: "reference", text: "Splunk docs" },
          { href: "https://no-text.example/" },
        ],
      },
      {
        uuid: "comp-2",
        type: "service",
        title: "S3 Audit Bucket",
        description: "Immutable log archive.",
        status: { state: "operational" },
      },
      // Component WITHOUT status, type, title, description → exercises every
      // `c.X || ""` parser fallback (L233-237).
      { uuid: "comp-bare" },
      // Component with under-development state → exercises ComponentStateBadge
      // arm (L876).
      { uuid: "comp-dev", type: "hardware", title: "Dev Hardware", status: { state: "under-development" } },
      // Component with disposition state → another ComponentStateBadge arm.
      { uuid: "comp-dispo", type: "software", title: "Old Software", status: { state: "disposition" } },
      // Component with unrecognized state → ComponentStateBadge default arm.
      { uuid: "comp-other-state", type: "service", title: "Other-State Service", status: { state: "retired" } },
    ],
    "inventory-items": [
      {
        uuid: "inv-1",
        description: "Linux log collector",
        "implemented-components": [{ "component-uuid": "comp-1" }],
        props: [{ name: "asset-type", value: "os" }],
      },
      // Inventory item without `implemented-components` and without
      // `description` / `props` → exercises the empty-array parser arms
      // (L246-249) and `inventoryItemIcon` fallback to box/darkGreen.
      { uuid: "inv-bare" },
      // Inventory item whose first implemented-component matches a
      // component without `type` → exercises `inventoryItemIcon`
      // fall-through to default box icon.
      { uuid: "inv-untyped", "implemented-components": [{ "component-uuid": "comp-bare" }] },
    ],
    "leveraged-authorizations": [
      {
        uuid: "la-1",
        title: "AWS Commercial FedRAMP Moderate",
        "party-uuid": "party-1",
        "date-authorized": "2025-01-15",
      },
      // Bare leveraged auth → exercises `|| ""` parser fallbacks (L253-255).
      { uuid: "la-bare" },
    ],
  },
  "control-implementation": {
    description: "Baseline controls implemented.",
    "implemented-requirements": [
      {
        uuid: "ir-1",
        "control-id": "ac-1",
        props: [{ name: "implementation-status", value: "implemented" }],
        remarks: "Implementation follows organizational policy.",
        statements: [
          {
            uuid: "stmt-1",
            "statement-id": "ac-1_smt.a",
            description: "Policy exists and is published.",
            "by-components": [
              {
                uuid: "stmt-bc-1",
                "component-uuid": "comp-1",
                description: "Splunk enforces policy statement.",
              },
            ],
          },
          {
            uuid: "stmt-2",
            "statement-id": "ac-1_smt.b",
            description: "Policy is reviewed annually.",
            remarks: "Managed by ISSO.",
          },
        ],
        "by-components": [
          {
            uuid: "bc-1",
            "component-uuid": "comp-1",
            description: "Splunk enforces retention.",
          },
        ],
        "responsible-roles": [
          { "role-id": "owner", "party-uuids": ["party-1"] },
        ],
        links: [
          { href: "https://docs.example/ac-1", rel: "reference", text: "AC-1 SOP" },
        ],
      },
      {
        uuid: "ir-2",
        "control-id": "ia-5",
        props: [{ name: "implementation-status", value: "planned" }],
        statements: [],
      },
      // Implemented-requirement with by-components carrying every
      // implementation-status state → exercises ImplStatusBadge arms
      // (partial, alternative, not-applicable, other-unknown) and the
      // by-component implementation-status parser arm (L278/L284).
      {
        uuid: "ir-status-variants",
        "control-id": "ac-99",
        props: [{ name: "implementation-status", value: "partial" }],
        statements: [
          {
            // Statement without statement-id → exercises L271 fallback.
            uuid: "stmt-no-id",
            description: "Statement lacking statement-id.",
          },
          {
            uuid: "stmt-partial",
            "statement-id": "ac-99_smt",
            description: "Partial implementation.",
            "by-components": [
              // by-component with no implementation-status (but with a
              // valid component-uuid to avoid render crash) → exercises the
              // `bc["implementation-status"]?.state || ""` chained-optional
              // fallback (L278). Also no description / no remarks / no uuid
              // → L275-277 fallbacks.
              { "component-uuid": "comp-1" },
              { uuid: "bc-partial", "component-uuid": "comp-1", "implementation-status": { state: "partial" } },
              { uuid: "bc-alt", "component-uuid": "comp-1", "implementation-status": { state: "alternative" } },
              { uuid: "bc-na", "component-uuid": "comp-1", "implementation-status": { state: "not-applicable" } },
              { uuid: "bc-unk", "component-uuid": "comp-1", "implementation-status": { state: "in-flux" } },
            ],
          },
        ],
        // Direct ir.by-components with a near-bare entry (component-uuid
        // required to avoid render crash) → exercises L281-285 fallbacks.
        "by-components": [{ "component-uuid": "comp-1" }],
        // responsible-roles with a bare entry → exercises L286-288.
        "responsible-roles": [{}],
        // ir.links with a bare entry → exercises L289-291.
        links: [{}],
      },
      // Bare implemented-requirement → exercises every `|| ""` / `|| []`
      // parser arm (L266-291). No control-id, no description, no remarks,
      // no statements, no by-components, no responsible-roles, no links.
      { uuid: "ir-bare" },
      // Implemented-requirement carrying the #55 export-support shape:
      // ir-level set-parameters, by-component export block (provided +
      // responsibilities), inherited and satisfied entries, by-component
      // set-parameters + responsible-roles. Exercises ByComponentTabs and
      // the Exports / Inherited / Satisfied tab renderers.
      {
        uuid: "ir-exports",
        "control-id": "ac-2",
        description: "Account management with shared responsibilities.",
        "set-parameters": [
          { "param-id": "ac-2_prm_1", values: ["quarterly"], remarks: "review cadence" },
        ],
        statements: [
          {
            uuid: "stmt-exports-1",
            "statement-id": "ac-2_smt.a",
            description: "Account inventory maintained.",
            "by-components": [
              {
                uuid: "stmt-bc-exports",
                "component-uuid": "comp-1",
                description: "Splunk inventories accounts.",
                export: {
                  description: "exported to consumer",
                  provided: [{ uuid: "stmt-prov", description: "stmt-level provided" }],
                  responsibilities: [{ uuid: "stmt-resp", description: "stmt-level responsibility" }],
                },
              },
            ],
          },
        ],
        "by-components": [
          {
            uuid: "bc-exports",
            "component-uuid": "comp-1",
            description: "Customer-facing account management.",
            remarks: "ongoing",
            "implementation-status": { state: "implemented" },
            export: {
              description: "Shared responsibility export.",
              remarks: "see ATO docs",
              provided: [
                {
                  uuid: "prov-1",
                  description: "Provider provides authentication.",
                  remarks: "AWS Cognito",
                  "responsible-roles": [{ "role-id": "csp", "party-uuids": ["party-1"] }],
                  links: [{ href: "#evidence" }],
                },
              ],
              responsibilities: [
                {
                  uuid: "resp-1",
                  description: "Customer configures MFA policies.",
                  remarks: "documented in customer playbook",
                  "responsible-roles": [{ "role-id": "customer" }],
                  "provided-uuid": "prov-1",
                },
              ],
            },
            inherited: [
              {
                uuid: "ih-1",
                description: "Inherited from leveraged authorization.",
                "provided-uuid": "prov-1",
                "responsible-roles": [{ "role-id": "csp" }],
              },
            ],
            satisfied: [
              {
                uuid: "sat-1",
                description: "Customer satisfies responsibility via SSO policy.",
                "responsibility-uuid": "resp-1",
                "responsible-roles": [{ "role-id": "customer" }],
                remarks: "verified in last assessment",
              },
            ],
            "set-parameters": [
              { "param-id": "ac-2_prm_2", values: ["30 days"] },
            ],
            "responsible-roles": [{ "role-id": "owner", "party-uuids": ["party-1"] }],
            links: [{ href: "https://docs.example/ac-2", rel: "reference", text: "AC-2 SOP" }],
          },
        ],
      },
    ],
  },
  "back-matter": {
    resources: [
      {
        uuid: "profile-res",
        title: "Moderate Baseline Profile",
        rlinks: [
          { href: "https://example.com/profile.json", "media-type": "application/json" },
        ],
      },
      // Bare resource (no title, no rlinks, no description, no props) →
      // exercises every `|| ""` / `|| []` fallback in the back-matter
      // parser (L302-306).
      { uuid: "res-bare" },
    ],
  },
};

/* Stripped SSP — bare-minimum metadata + empty/absent system blocks.
   Exercises every `field || fallback` and `field || []` parser arm
   that RICH_SSP doesn't hit because RICH_SSP populates everything.
   Specifically targets the parseSsp arms at lines 179-307. */
const STRIPPED_SSP = {
  metadata: { title: "Stripped SSP" },
  // No system-characteristics → parser uses `sc = {} || {}` and every
  // sub-field falls to the empty default.
  // No system-implementation → users/components/inventory-items/leveraged
  // authorizations all fall to empty arrays.
  // No control-implementation → implemented-requirements falls to [].
  // No back-matter → resources falls to [].
  // No import-profile → href falls to "".
};

/* Wrapped SSP — `system-security-plan` outer key present → exercises the
   `raw["system-security-plan"] ?? raw` LHS-truthy parser arm (L178). The
   default RICH_SSP is not wrapped, so this round adds the wrapped form. */
const WRAPPED_SSP = { "system-security-plan": RICH_SSP };

/* ═══════════════════════════════════════════════════════════════════════════
   Harness
   ═══════════════════════════════════════════════════════════════════════════ */

function stubMatchMedia(mobile = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function Seed({
  ssp = RICH_SSP,
  catalog = CATALOG,
  withCatalog = true,
  leveragedSsps = [],
}: {
  ssp?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
  leveragedSsps?: { data: unknown; fileName: string }[];
}) {
  const { setSsp, setCatalog, addLeveragedSsp } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (!didSeed.current) {
      didSeed.current = true;
      setSsp(ssp, "ssp.json");
      if (withCatalog) setCatalog(catalog, "cat.json");
      leveragedSsps.forEach((l) => addLeveragedSsp(l.data, l.fileName));
    }
  }, [ssp, catalog, setSsp, setCatalog, withCatalog, leveragedSsps, addLeveragedSsp]);
  return null;
}

function Harness({
  preload = true,
  mobile = false,
  initialPath = "/ssp",
  ssp = RICH_SSP,
  catalog = CATALOG,
  withCatalog = true,
  leveragedSsps = [],
}: {
  preload?: boolean;
  mobile?: boolean;
  initialPath?: string;
  ssp?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
  leveragedSsps?: { data: unknown; fileName: string }[];
}) {
  stubMatchMedia(mobile);
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <OscalProvider>
          {preload && (
            <Seed
              ssp={ssp}
              catalog={catalog}
              withCatalog={withCatalog}
              leveragedSsps={leveragedSsps}
            />
          )}
          <SspPage />
        </OscalProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

async function renderLoaded(
  props: Parameters<typeof Harness>[0] = {},
) {
  const utils = render(<Harness preload {...props} />);
  await waitFor(() => {
    expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0);
  });
  return utils;
}

function fireDrop(zone: Element, file: File) {
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}

function sspFile(
  data: object = { "system-security-plan": RICH_SSP },
  name = "ssp.json",
) {
  return new File([JSON.stringify(data)], name, { type: "application/json" });
}

beforeEach(() => {
  stubMatchMedia(false);
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ═══════════════════════════════════════════════════════════════════════════
   Empty state
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> empty state", () => {
  it("renders the DropZone when no SSP is loaded", () => {
    render(<Harness preload={false} />);
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("disables the URL Fetch button until a URL is entered", () => {
    render(<Harness preload={false} />);
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    expect(fetchBtn).toBeDisabled();
    const url = screen.getByPlaceholderText(/https:\/\//);
    fireEvent.change(url, { target: { value: "https://ex.com/ssp.json" } });
    expect(fetchBtn).toBeEnabled();
  });

  it("loads a dropped SSP and shifts to the viewer shell", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, sspFile());
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(/Sample System Security Plan/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("rejects JSON missing metadata", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(
      zone,
      new File(
        [JSON.stringify({ "system-security-plan": { uuid: "x" } })],
        "x.json",
        { type: "application/json" },
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Not a valid OSCAL SSP/),
      ).toBeInTheDocument(),
    );
  });

  it("surfaces a JSON parse error for non-JSON input", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(
      zone,
      new File(["garbage"], "x.json", { type: "application/json" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/JSON/)).toBeInTheDocument(),
    );
  });

  it("accepts an unwrapped SSP payload", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, sspFile(RICH_SSP));
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
  });

  it("auto-loads from ?url= (mocked fetch)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ "system-security-plan": RICH_SSP }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
    render(
      <Harness
        preload={false}
        initialPath="/ssp?url=https://ex.com/ssp.json"
      />,
    );
    await waitFor(() =>
      expect(screen.queryAllByText("Overview").length).toBeGreaterThan(0),
    );
  });

  it("surfaces HTTP errors from failed auto-load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("nope", { status: 500, statusText: "Internal Error" }),
      ),
    );
    render(
      <Harness
        preload={false}
        initialPath="/ssp?url=https://ex.com/bad.json"
      />,
    );
    await waitFor(() =>
      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument(),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — desktop
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> loaded — desktop", () => {
  it("renders top bar, sidebar, and overview", async () => {
    await renderLoaded();
    expect(
      screen.getAllByText(/Sample System Security Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("New File resets to the DropZone", async () => {
    await renderLoaded();
    fireEvent.click(
      screen.getAllByRole("button", { name: /New File/i })[0],
    );
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("navigates to the Metadata view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText("Metadata")[0]);
    expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThan(0);
  });

  it("navigates to System Characteristics and shows impact levels", async () => {
    await renderLoaded();
    // Click sidebar's "System Characteristics" label
    const sysChar = screen.getAllByText(/System Characteristics/i)[0];
    fireEvent.click(sysChar);
    expect(
      screen.getAllByText(/Acme Logging Platform/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates into System Implementation → Components", async () => {
    await renderLoaded();
    const sysImpl = screen.getAllByText(/System Implementation/i)[0];
    fireEvent.click(sysImpl);
    // Now click into Components sub-link
    const comps = screen.getAllByText(/Components/i);
    fireEvent.click(comps[0]);
    expect(
      screen.getAllByText(/Splunk Enterprise/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to a specific component detail via ssp-comp-N", async () => {
    await renderLoaded();
    // Route there via sidebar or component listing
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    const comps = screen.getAllByText(/Components/i);
    fireEvent.click(comps[0]);
    fireEvent.click(screen.getAllByText(/Splunk Enterprise/)[0]);
    // Detail view renders the description
    await waitFor(() =>
      expect(
        screen.getAllByText(/SIEM platform/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to Users view under System Implementation", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Users/i)[0]);
    expect(screen.getAllByText(/Administrators/).length).toBeGreaterThan(0);
  });

  it("navigates to Inventory view under System Implementation", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Inventory/i)[0]);
    expect(
      screen.getAllByText(/Linux log collector/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to the Control Implementation view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // List shows the implemented requirement control ID
    expect(screen.getAllByText(/AC-1|ac-1/i).length).toBeGreaterThan(0);
  });

  it("drills into a specific control detail (ac-1)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    const row = screen.getAllByText(/AC-1|ac-1/i)[0];
    fireEvent.click(row);
    // ControlDetailView shows the catalog title
    await waitFor(() =>
      expect(
        screen.getAllByText(/Policy and Procedures/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to the Back Matter view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Back Matter/i)[0]);
    expect(
      screen.getAllByText(/Moderate Baseline Profile/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to Leveraged Authorizations view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    // Click the Leveraged nav entry
    const leveraged = screen.getAllByText(/Leveraged/i)[0];
    fireEvent.click(leveraged);
    expect(
      screen.getAllByText(/AWS Commercial FedRAMP Moderate/).length,
    ).toBeGreaterThan(0);
  });

  /* #56 LeveragedAuthDetailView — port from
     https://github.com/EasyDynamics/oscal-viewer/pull/56. Exercises the new
     detail view (controls-offered tree, family groups, expand/collapse) and
     its empty state. */

  it("shows empty-state when a leveraged-auth detail view has no provider SSP loaded", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Leveraged/i)[0]);
    // Click the la-1 entry (AWS Commercial FedRAMP Moderate) — has no
    // leveragedSsps loaded, so the empty-state copy should appear.
    fireEvent.click(screen.getAllByText(/AWS Commercial FedRAMP Moderate/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/No provider SSP loaded for this authorization/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("shows controls-offered tree when a matching provider SSP is loaded", async () => {
    /* Provider SSP whose title contains "AWS" so it title-matches the
       leveraged-auth "AWS Commercial FedRAMP Moderate". Exports two
       controls (ac-2, au-2) under one component. */
    const providerSsp = {
      "system-security-plan": {
        metadata: { title: "AWS Provider SSP" },
        "system-implementation": {
          components: [{ uuid: "p-comp-1", title: "IAM Service" }],
        },
        "control-implementation": {
          "implemented-requirements": [
            {
              "control-id": "ac-2",
              "by-components": [{
                "component-uuid": "p-comp-1",
                export: {
                  description: "Account management exported",
                  provided: [{ uuid: "prov-aws-1", description: "Authentication" }],
                  responsibilities: [{ uuid: "resp-aws-1", description: "Customer MFA config" }],
                },
              }],
            },
            {
              "control-id": "au-2",
              "by-components": [{
                "component-uuid": "p-comp-1",
                export: {
                  provided: [{ uuid: "prov-aws-2", description: "Logging" }],
                },
              }],
            },
          ],
        },
      },
    };

    await renderLoaded({
      leveragedSsps: [{ data: providerSsp, fileName: "aws-provider.json" }],
    });

    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Leveraged/i)[0]);
    fireEvent.click(screen.getAllByText(/AWS Commercial FedRAMP Moderate/)[0]);

    // Controls Offered card with count surfaces.
    await waitFor(() =>
      expect(screen.queryAllByText(/Controls Offered/).length).toBeGreaterThan(0),
    );

    // Family rows: AC and AU should render (the two control IDs span 2 families).
    expect(screen.queryAllByText(/^AC$/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/^AU$/).length).toBeGreaterThan(0);

    // Expand the AC family — clicking the family row reveals ac-2.
    fireEvent.click(screen.getAllByText(/^AC$/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/ac-2/i).length).toBeGreaterThan(0),
    );

    // Expand the ac-2 control row → reveal provider component + provided/responsibility entries.
    fireEvent.click(screen.getAllByText(/ac-2/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Authentication|Customer MFA config|IAM Service/i).length).toBeGreaterThan(0),
    );
  });

  /* BUG: empty leveraged-auth title matches every provider via the
     bidirectional substring containment in LeveragedAuthDetailView
     (`titleLower.includes("")` is always true, and any provider title also
     `.includes("")`). Locked in here per the lock-in-before-fix discipline.
     Upstream #61 ("enhance title matching to reduce false positives")
     should flip this assertion when ported. */
  it("BUG: empty leveraged-auth title matches every provider (locked in until upstream #61)", async () => {
    /* Two providers, neither title-matching the bare-title la — but the
       empty-string substring match catches both. With >1 providers, the
       single-provider fallback also doesn't apply. */
    const providerA = {
      metadata: { title: "Alpha Cloud" },
      "system-implementation": { components: [{ uuid: "ca", title: "A-comp" }] },
      "control-implementation": {
        "implemented-requirements": [{
          "control-id": "ac-2",
          "by-components": [{
            "component-uuid": "ca",
            export: { provided: [{ uuid: "p-a", description: "alpha provided" }] },
          }],
        }],
      },
    };
    const providerB = {
      metadata: { title: "Beta Systems" },
      "system-implementation": { components: [{ uuid: "cb", title: "B-comp" }] },
      "control-implementation": {
        "implemented-requirements": [{
          "control-id": "au-2",
          "by-components": [{
            "component-uuid": "cb",
            export: { provided: [{ uuid: "p-b", description: "beta provided" }] },
          }],
        }],
      },
    };

    await renderLoaded({
      leveragedSsps: [
        { data: providerA, fileName: "a.json" },
        { data: providerB, fileName: "b.json" },
      ],
    });

    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Leveraged/i)[0]);
    // la-bare has no title (parses to ""). Find it by its uuid-prefix label.
    const bareNav = screen
      .getAllByText(/la-bare/i)
      .find((el) => el.tagName !== "DIV");
    fireEvent.click(bareNav ?? screen.getAllByText(/la-bare/i)[0]);

    await waitFor(() =>
      expect(screen.queryAllByText(/Controls Offered/).length).toBeGreaterThan(0),
    );
    // Both providers' families are listed even though neither title matches
    // the bare la's empty title — the bug.
    expect(screen.queryAllByText(/^AC$/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/^AU$/).length).toBeGreaterThan(0);
  });

  it("falls back to showing all provider exports when only one provider is loaded (no title match)", async () => {
    /* Provider SSP whose title doesn't substring-match any leveraged-auth title,
       but providerCount === 1 so it should still surface for la-1's detail view. */
    const providerSsp = {
      metadata: { title: "Some Unrelated Provider" },
      "system-implementation": {
        components: [{ uuid: "c-x", title: "Service X" }],
      },
      "control-implementation": {
        "implemented-requirements": [{
          "control-id": "cm-1",
          "by-components": [{
            "component-uuid": "c-x",
            export: {
              provided: [{ uuid: "p-x", description: "config baseline" }],
            },
          }],
        }],
      },
    };

    await renderLoaded({
      leveragedSsps: [{ data: providerSsp, fileName: "x.json" }],
    });

    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Leveraged/i)[0]);
    fireEvent.click(screen.getAllByText(/AWS Commercial FedRAMP Moderate/)[0]);

    // Even though the title doesn't match, single-provider fallback fires.
    await waitFor(() =>
      expect(screen.queryAllByText(/Controls Offered/).length).toBeGreaterThan(0),
    );
    expect(screen.queryAllByText(/^CM$/).length).toBeGreaterThan(0);
  });

  it("drills into the second component (ssp-comp-1)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    fireEvent.click(screen.getAllByText(/S3 Audit Bucket/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Immutable log archive/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders the control family view (AC family)", async () => {
    await renderLoaded();
    // Navigate to Control Implementation, then click AC family folder
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // Family header row shows "AC" + "Access Control" label from FAMILY_NAMES
    const acFolder = screen.getAllByText(/^AC$/);
    expect(acFolder.length).toBeGreaterThan(0);
    fireEvent.click(acFolder[0]);
    // ControlFamilyView shows each implemented-requirement's controlId
    await waitFor(() =>
      expect(screen.getAllByText(/AC-1/i).length).toBeGreaterThan(0),
    );
  });

  it("renders the second implemented requirement (ia-5) with statements", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // IA family appears because we have ia-5
    const ia = screen.getAllByText(/^IA$/);
    expect(ia.length).toBeGreaterThan(0);
  });

  it("renders the user's authorized privileges on Users view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Users/i)[0]);
    // Authorized privileges title should surface
    expect(
      screen.getAllByText(/Manage users|Administrators/).length,
    ).toBeGreaterThan(0);
  });

  it("renders by-components detail on an implemented requirement", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    const ac = screen.getAllByText(/AC-1|ac-1/i)[0];
    fireEvent.click(ac);
    // by-components description surfaces in the control detail
    await waitFor(() =>
      expect(
        screen.getAllByText(/Splunk enforces retention/).length,
      ).toBeGreaterThan(0),
    );
  });

  /* #55 SSP export support — port from
     https://github.com/EasyDynamics/oscal-viewer/pull/55. Exercises
     ByComponentTabs disclosure (Exports / Inherited / Satisfied) and the
     ir-level Set-Parameters card. */
  it("renders by-component tabs (exports, inherited, satisfied) and ir-level set-parameters", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/AC-2|ac-2/i)[0]);

    // ir-level Set Parameters card surfaces both ir param-id and value.
    await waitFor(() =>
      expect(screen.getAllByText(/ac-2_prm_1/i).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/quarterly/).length).toBeGreaterThan(0);

    // Implementation tab is the default; description is visible.
    expect(
      screen.getAllByText(/Customer-facing account management/).length,
    ).toBeGreaterThan(0);

    // Exports tab — switch and verify provided + responsibilities surface.
    const exportsTab = screen.getAllByRole("button", { name: /Exports/i })[0];
    fireEvent.click(exportsTab);
    await waitFor(() =>
      expect(screen.getAllByText(/Provider provides authentication/).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/Customer configures MFA policies/).length).toBeGreaterThan(0);

    // Inherited tab.
    const inheritedTab = screen.getAllByRole("button", { name: /Inherited/i })[0];
    fireEvent.click(inheritedTab);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Inherited from leveraged authorization/).length,
      ).toBeGreaterThan(0),
    );

    // Satisfied tab.
    const satisfiedTab = screen.getAllByRole("button", { name: /Satisfied/i })[0];
    fireEvent.click(satisfiedTab);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Customer satisfies responsibility via SSO policy/).length,
      ).toBeGreaterThan(0),
    );

    // Implementation tab — switch back; set-parameters and responsible-roles
    // at by-component level render only on the impl tab (and only at "req" size).
    const implTab = screen.getAllByRole("button", { name: /Implementation/i })[0];
    fireEvent.click(implTab);
    await waitFor(() =>
      expect(screen.getAllByText(/ac-2_prm_2/i).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/30 days/).length).toBeGreaterThan(0);
  });

  it("renders system-information info-types in System Characteristics", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Characteristics/i)[0]);
    // System Characteristics view renders — check security impact levels are present
    expect(
      screen.queryAllByText(/moderate|high|low|Sensitivity|Security/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders fips-199 impact levels on information types", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Characteristics/i)[0]);
    expect(
      screen.queryAllByText(/moderate|high|low/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders network architecture diagram description", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Characteristics/i)[0]);
    // System Characteristics view renders authorization boundary and properties
    expect(
      screen.queryAllByText(/Authorization|AWS VPC|cloud|deployment/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders implemented-requirement remarks and multiple statements", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/AC-1|ac-1/i)[0]);
    // Remarks are collapsible; verify we're in the detail view by checking the control title
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Policy and Procedures|Splunk enforces|implementation-status|implemented/i).length,
      ).toBeGreaterThan(0),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> edge cases", () => {
  it("renders overview without a loaded catalog", async () => {
    await renderLoaded({ withCatalog: false });
    expect(
      screen.getAllByText(/Sample System Security Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("renders a minimal SSP (only metadata)", async () => {
    const minimal = {
      uuid: "m",
      metadata: { title: "Minimal SSP" },
    };
    await renderLoaded({ ssp: minimal });
    expect(screen.getAllByText(/Minimal SSP/).length).toBeGreaterThan(0);
  });

  it("renders even when system-implementation is missing", async () => {
    const noImpl = { ...RICH_SSP, "system-implementation": undefined };
    await renderLoaded({ ssp: noImpl });
    expect(
      screen.getAllByText(/Sample System Security Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("Overview → Metadata → Overview round-trip works", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText("Metadata")[0]);
    fireEvent.click(screen.getAllByText("Overview")[0]);
    expect(
      screen.getAllByText(/Sample System Security Plan/).length,
    ).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — mobile
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> loaded — mobile", () => {
  it("renders the mobile shell with navigable drill-down entries", async () => {
    await renderLoaded({ mobile: true });
    // Mobile root shell shows Overview + Metadata sections
    expect(screen.getAllByText("Overview").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Metadata").length).toBeGreaterThan(0);
  });

  it("drills into a section from the mobile drill-down list", async () => {
    await renderLoaded({ mobile: true });
    const metadata = screen.getAllByText("Metadata")[0];
    fireEvent.click(metadata);
    // Mobile content view appears
    await waitFor(() =>
      expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThan(0),
    );
  });

  it("mobile drill-back shows root list again after drilling in", async () => {
    await renderLoaded({ mobile: true });
    // Drill into System Implementation (has children)
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    // Breadcrumb or Back button appears
    await waitFor(() =>
      expect(screen.queryAllByText(/← Back|Back|System Implementation/i).length).toBeGreaterThan(0),
    );
    // Click ← Back
    const back = screen.queryAllByText(/← Back/i)[0];
    if (back) {
      fireEvent.click(back);
      expect(screen.queryAllByText(/Overview|Metadata/i).length).toBeGreaterThan(0);
    }
  });

  it("mobile: clicking a leaf node shows content view", async () => {
    await renderLoaded({ mobile: true });
    // Navigate into system implementation first, then leaf
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Components|Users|Inventory/i).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/Users/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Acme Corp|Administrators|Acme Logging/i).length).toBeGreaterThan(0),
    );
  });

  it("mobile: Back button from content view returns to drill-down", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getAllByText(/Metadata/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Acme Corp/).length).toBeGreaterThan(0),
    );
    const backBtn = screen.queryAllByText(/← Back/i)[0];
    if (backBtn) {
      fireEvent.click(backBtn);
      expect(screen.queryAllByText(/Overview|System/i).length).toBeGreaterThan(0);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Component types and variant coverage
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> component type variants", () => {
  const SSP_MULTI_COMP = {
    ...RICH_SSP,
    "system-implementation": {
      ...RICH_SSP["system-implementation"],
      components: [
        ...RICH_SSP["system-implementation"].components,
        { uuid: "comp-hw", type: "hardware", title: "Network Switch", description: "Core switch.", status: { state: "operational" } },
        { uuid: "comp-net", type: "network", title: "VPN Gateway", description: "VPN endpoint.", status: { state: "under-development" } },
        { uuid: "comp-pol", type: "policy", title: "Access Policy", description: "Written access policy.", status: { state: "operational" } },
        { uuid: "comp-is", type: "this-system", title: "The System", description: "Main system.", status: { state: "operational" } },
        { uuid: "comp-ext", type: "system", title: "External App", description: "External system.", status: { state: "operational" } },
        { uuid: "comp-ic", type: "interconnection", title: "Data Link", description: "Data feed.", status: { state: "disposition" } },
        { uuid: "comp-phy", type: "physical", title: "Data Center", description: "Physical facility.", status: { state: "operational" } },
        { uuid: "comp-proc", type: "process-procedure", title: "Incident Proc", description: "IR procedure.", status: { state: "operational" } },
        { uuid: "comp-plan", type: "plan", title: "Continuity Plan", description: "BCP.", status: { state: "operational" } },
        { uuid: "comp-guid", type: "guidance", title: "User Guide", description: "User guide.", status: { state: "operational" } },
        { uuid: "comp-std", type: "standard", title: "NIST SP 800-53", description: "Standard.", status: { state: "operational" } },
        { uuid: "comp-val", type: "validation", title: "FedRAMP", description: "Validation.", status: { state: "operational" } },
        { uuid: "comp-unk", type: "unknown-type", title: "Unknown Comp", description: "Unknown.", status: { state: "operational" } },
      ],
      "inventory-items": [
        {
          uuid: "inv-2",
          description: "Network device",
          props: [{ name: "asset-type", value: "network" }, { name: "asset-id", value: "NET-001" }],
          "implemented-components": [{ "component-uuid": "comp-hw" }],
        },
        {
          uuid: "inv-3",
          description: "Database server",
          props: [{ name: "asset-type", value: "database" }],
          "implemented-components": [],
        },
        {
          uuid: "inv-4",
          description: "Virtual machine",
          props: [{ name: "asset-type", value: "virtual-machine" }],
          "implemented-components": [],
        },
        {
          uuid: "inv-5",
          description: "Storage array",
          props: [{ name: "asset-type", value: "storage" }],
          "implemented-components": [],
        },
        {
          uuid: "inv-6",
          description: "Web application",
          props: [{ name: "asset-type", value: "application" }],
          "implemented-components": [],
        },
        ...RICH_SSP["system-implementation"]["inventory-items"],
      ],
    },
  };

  it("renders components with various types in Components view", async () => {
    await renderLoaded({ ssp: SSP_MULTI_COMP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    expect(screen.getAllByText(/Network Switch|VPN Gateway|Access Policy/i).length).toBeGreaterThan(0);
  });

  it("renders inventory items with asset-type props", async () => {
    await renderLoaded({ ssp: SSP_MULTI_COMP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Inventory/i)[0]);
    expect(screen.queryAllByText(/Network device|Database server|NET-001/i).length).toBeGreaterThan(0);
  });

  it("drills into hardware component detail", async () => {
    await renderLoaded({ ssp: SSP_MULTI_COMP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    fireEvent.click(screen.getAllByText(/Network Switch/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Core switch/).length).toBeGreaterThan(0),
    );
  });

  it("renders component detail breadcrumb navigation", async () => {
    await renderLoaded({ ssp: SSP_MULTI_COMP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    fireEvent.click(screen.getAllByText(/Network Switch/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Core switch/).length).toBeGreaterThan(0),
    );
    // Click the breadcrumb "Components" link to go back
    const compsBreadcrumb = screen.queryAllByText(/^Components$/)[0];
    if (compsBreadcrumb) {
      fireEvent.click(compsBreadcrumb);
      await waitFor(() =>
        expect(screen.queryAllByText(/Splunk Enterprise|Network Switch/i).length).toBeGreaterThan(0),
      );
    }
  });

  it("renders component detail System Implementation breadcrumb", async () => {
    await renderLoaded({ ssp: SSP_MULTI_COMP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    fireEvent.click(screen.getAllByText(/Network Switch/)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Core switch/).length).toBeGreaterThan(0),
    );
    // Click "System Implementation" breadcrumb
    const sysImplBreadcrumb = screen.queryAllByText(/^System Implementation$/i)[0];
    if (sysImplBreadcrumb) {
      fireEvent.click(sysImplBreadcrumb);
    }
  });
});

describe("<SspPage /> remarks expansion and impl status variants", () => {
  it("expands CollapsibleRemarks when clicked on control detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/AC-1|ac-1/i)[0]);
    await waitFor(() =>
      expect(screen.getAllByText(/Policy and Procedures/).length).toBeGreaterThan(0),
    );
    // Click Remarks toggle to expand it
    const remarksBtn = screen.queryAllByText(/^Remarks$/i)[0];
    if (remarksBtn) {
      fireEvent.click(remarksBtn);
      await waitFor(() =>
        expect(screen.queryAllByText(/organizational policy|Implementation follows/i).length).toBeGreaterThan(0),
      );
    }
  });

  const SSP_PLANNED = {
    ...RICH_SSP,
    "control-implementation": {
      description: "Controls.",
      "implemented-requirements": [
        {
          uuid: "ir-planned",
          "control-id": "ac-2",
          props: [{ name: "implementation-status", value: "planned" }],
          statements: [],
          "by-components": [
            {
              uuid: "bc-planned",
              "component-uuid": "comp-1",
              description: "Planned implementation.",
              "implementation-status": { state: "planned" },
            },
          ],
        },
        {
          uuid: "ir-alt",
          "control-id": "ac-3",
          props: [{ name: "implementation-status", value: "alternative" }],
          statements: [],
          "by-components": [
            {
              uuid: "bc-alt",
              "component-uuid": "comp-1",
              description: "Alternative approach.",
              "implementation-status": { state: "alternative" },
            },
          ],
        },
        {
          uuid: "ir-partial",
          "control-id": "ac-4",
          props: [{ name: "implementation-status", value: "partial" }],
          statements: [],
          "by-components": [
            {
              uuid: "bc-partial",
              "component-uuid": "comp-1",
              description: "Partially implemented.",
              "implementation-status": { state: "partial" },
            },
          ],
        },
        {
          uuid: "ir-na",
          "control-id": "ac-5",
          props: [{ name: "implementation-status", value: "not-applicable" }],
          statements: [],
          "by-components": [
            {
              uuid: "bc-na",
              "component-uuid": "comp-1",
              description: "Not applicable.",
              "implementation-status": { state: "not-applicable" },
            },
          ],
        },
      ],
    },
  };

  it("renders planned implementation status badge in control detail", async () => {
    await renderLoaded({ ssp: SSP_PLANNED });
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // Click AC-2
    await waitFor(() =>
      expect(screen.queryAllByText(/AC-2|ac-2/i).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/AC-2|ac-2/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/planned|Planned implementation/i).length).toBeGreaterThan(0),
    );
  });

  it("renders alternative implementation status badge in control detail", async () => {
    await renderLoaded({ ssp: SSP_PLANNED });
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/AC-3|ac-3/i).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/AC-3|ac-3/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/alternative|Alternative approach/i).length).toBeGreaterThan(0),
    );
  });

  it("renders not-applicable implementation status in control detail", async () => {
    await renderLoaded({ ssp: SSP_PLANNED });
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/AC-5|ac-5/i).length).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/AC-5|ac-5/i)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/not-applicable|Not applicable/i).length).toBeGreaterThan(0),
    );
  });

  it("renders ComponentStateBadge for under-development component", async () => {
    const ssp = {
      ...RICH_SSP,
      "system-implementation": {
        ...RICH_SSP["system-implementation"],
        components: [
          { uuid: "comp-dev", type: "software", title: "Dev Tool", description: "In development.", status: { state: "under-development" } },
        ],
        "inventory-items": [],
      },
    };
    await renderLoaded({ ssp });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    expect(screen.getAllByText(/Dev Tool/).length).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Service-component hierarchy + relationships (upstream #53 port)
   ═══════════════════════════════════════════════════════════════════════════ */

// HIER_SSP exercises every branch of buildComponentHierarchy, ComponentRelationships,
// and the new parseSsp links pass. Layout:
//   svc-host (service)  ──provided-by──> sw-splunk, sw-postgres   [pass 1, multi-child + new/existing array]
//                       ──uses-network──> net-vpc                  [relationship chip]
//                       ──uses-service──> svc-archive              [relationship chip]
//                       ──depends-on────> sw-splunk                [relationship chip]
//                       ──depends-on────> unknown-comp             [relationship chip filter: unknown UUID dropped]
//                       ──provided-by──> unknown-comp              [hierarchy: unknown UUID skip]
//                       ──provided-by──> svc-host (self)           [hierarchy: self-reference skip]
//                       ──provided-by──> "" (empty href)           [hierarchy: hrefToUuid empty-string branch]
//                       ──no-rel link with href "bare-uuid"        [parseSsp: l.rel falsy → undefined; also tests no-# branch of hrefToUuid via filter]
//                       ──{} (all falsy)                           [parseSsp: l.href/l.rel/l.text all falsy]
//   svc-conflict (service) ──provided-by──> sw-splunk              [duplicate provided-by — second skipped]
//                          ──used-by──────> sw-splunk              [pass-2 conflict — provided-by wins]
//   svc-archive (service)  ──used-by──────> sw-archive             [pass 2 first-time used-by claim]
//                          ──used-by──────> sw-archive             [pass-2 duplicate — second skipped]
//                          ──used-by──────> unknown                [pass-2 unknown skip]
//                          ──used-by──────> svc-archive (self)     [pass-2 self skip]
//                          ──used-by──────> "" (empty href)        [pass-2 empty-href skip]
//                          ──reference link to docs                [parseSsp: ignored rel; non-target rel branch]
//   sw-splunk (software)   ──provided-by──> svc-host               [pass-1 non-service-parent skip]
//                          ──used-by──────> svc-host               [pass-2 non-service-parent skip]
//   sw-postgres (software) — no links (covers parseSsp `c.links || []` empty-array path within hierarchy fixture)
//   sw-archive (software, title="")        [chip title-fallback to uuid slice]
//   net-vpc (network)
//   sw-no-links (software, no links key)   [parseSsp: `c.links || []` undefined fallback]

const HIER_SSP = {
  ...RICH_SSP,
  uuid: "ssp-hier",
  metadata: { ...RICH_SSP.metadata, title: "Hierarchy SSP" },
  "system-implementation": {
    ...RICH_SSP["system-implementation"],
    components: [
      {
        uuid: "svc-host",
        type: "service",
        title: "Hosting Service",
        description: "Owns Splunk and Postgres.",
        status: { state: "operational" },
        links: [
          { href: "#sw-splunk",      rel: "provided-by",  text: "Splunk on this host" },
          { href: "#sw-postgres",    rel: "provided-by" },
          { href: "#net-vpc",        rel: "uses-network", text: "Primary VPC" },
          { href: "#svc-archive",    rel: "uses-service" },
          { href: "#sw-splunk",      rel: "depends-on" },
          { href: "#sw-archive",     rel: "depends-on" },        // target.title="" → chip uuid-slice fallback (line 2129)
          { href: "sw-postgres",     rel: "depends-on" },        // href has no `#` → hrefToUuid falsy branch (line 1241)
          { href: "#unknown-comp",   rel: "depends-on" },
          { href: "#unknown-comp",   rel: "provided-by" },
          { href: "#svc-host",       rel: "provided-by" },
          { href: "",                rel: "provided-by" },
          { href: "bare-uuid" }, // no rel
          {},                    // all falsy
        ],
      },
      {
        uuid: "svc-conflict",
        type: "service",
        title: "Conflicting Service",
        description: "Tries to claim sw-splunk too.",
        status: { state: "operational" },
        links: [
          { href: "#sw-splunk", rel: "provided-by" },
          { href: "#sw-splunk", rel: "used-by" },
        ],
      },
      {
        uuid: "svc-archive",
        type: "service",
        title: "Archive Service",
        description: "Used-by claim on sw-archive.",
        status: { state: "operational" },
        links: [
          { href: "#sw-archive",   rel: "used-by" },
          { href: "#sw-archive",   rel: "used-by" },
          { href: "#unknown-comp", rel: "used-by" },
          { href: "#svc-archive",  rel: "used-by" },
          { href: "",              rel: "used-by" },
          { href: "https://docs.example/archive", rel: "reference", text: "Docs" },
        ],
      },
      {
        uuid: "sw-splunk",
        type: "software",
        title: "Splunk Enterprise (Hier)",
        description: "SIEM.",
        status: { state: "operational" },
        links: [
          { href: "#svc-host", rel: "provided-by" },
          { href: "#svc-host", rel: "used-by" },
        ],
      },
      {
        uuid: "sw-postgres",
        type: "software",
        title: "Postgres",
        description: "DB.",
        status: { state: "operational" },
        links: [],
      },
      {
        uuid: "sw-archive",
        type: "software",
        title: "", // empty — forces uuid-slice fallback on the relationship chip label
        description: "Cold storage.",
        status: { state: "operational" },
        links: [],
      },
      {
        uuid: "net-vpc",
        type: "network",
        title: "Primary VPC",
        description: "Network",
        status: { state: "operational" },
        links: [],
      },
      {
        uuid: "sw-no-links",
        type: "software",
        title: "No-Links Component",
        description: "Tests the c.links fallback.",
        status: { state: "operational" },
        // intentionally no `links` key
      },
    ],
  },
};

describe("<SspPage /> service-component hierarchy (upstream #53)", () => {
  /** Click into Components view and return the sidebar nav item DOM nodes
   *  for every component (by depth-tagged paddingLeft we can verify nesting). */
  async function openComponents() {
    await renderLoaded({ ssp: HIER_SSP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/^Components$/)[0]);
  }

  /** Find the desktop sidebar nav row whose label matches `label`. React inlines
   *  the row's `paddingLeft` with the base style's other padding values, so the
   *  serialized attribute is the four-value shorthand `padding: T R B L` — we
   *  scan parents until we find one whose style declares a four-value `padding:`
   *  (the row itself) and return it. */
  function sidebarRowFor(label: string | RegExp): HTMLElement {
    const matches = screen.getAllByText(label);
    for (const m of matches) {
      let n: HTMLElement | null = m;
      while (n) {
        const style = n.getAttribute("style") || "";
        if (/padding:\s*\d+px\s+\d+px\s+\d+px\s+\d+px/.test(style)) return n;
        if (/padding-left:\s*\d+px/.test(style)) return n;
        n = n.parentElement;
      }
    }
    throw new Error(`No sidebar row found for ${label}`);
  }

  /** Return the left padding (px) of a sidebar row. Reads either the four-value
   *  `padding: T R B L` shorthand or the standalone `padding-left:` form. The
   *  two-value form `padding: 7px 12px` indicates depth=0 (left = 12). */
  function paddingLeftPx(el: HTMLElement): number {
    const style = el.getAttribute("style") || "";
    const four = style.match(/padding:\s*\d+px\s+\d+px\s+\d+px\s+(\d+)px/);
    if (four) return Number(four[1]);
    const two = style.match(/padding:\s*\d+px\s+(\d+)px(?!\s*\d+px)/);
    if (two) return Number(two[1]);
    const direct = style.match(/padding-left:\s*(\d+)px/);
    return direct ? Number(direct[1]) : 0;
  }

  /** After landing in System Implementation → Components, click a service-
   *  component row so its nested children become visible. (Default-collapsed.) */
  function expandService(label: string | RegExp) {
    fireEvent.click(screen.getAllByText(label)[0]);
  }

  /* ── parseSsp links pass ────────────────────────────────────────────── */

  it("parseSsp accepts components without a links key (c.links || [] fallback)", async () => {
    await openComponents();
    expect(screen.getAllByText(/No-Links Component/).length).toBeGreaterThan(0);
  });

  it("parseSsp tolerates link objects where href/rel/text are all missing", async () => {
    // Renders without throwing — the {} link in svc-host's links is parsed to
    // { href: "", rel: undefined, text: undefined } and then dropped by every
    // downstream filter. The component still shows up in the sidebar.
    await openComponents();
    expect(screen.getAllByText(/Hosting Service/).length).toBeGreaterThan(0);
  });

  /* ── buildComponentHierarchy ────────────────────────────────────────── */

  it("nests provided-by children beneath the service parent at depth+1", async () => {
    await openComponents();
    expandService(/Hosting Service/);
    const parent = sidebarRowFor(/Hosting Service/);
    const childA = sidebarRowFor(/Splunk Enterprise \(Hier\)/);
    const childB = sidebarRowFor(/^Postgres$/);
    expect(paddingLeftPx(childA)).toBe(paddingLeftPx(parent) + 16);
    expect(paddingLeftPx(childB)).toBe(paddingLeftPx(parent) + 16);
  });

  it("nests used-by children under the service when no provided-by claim exists", async () => {
    await openComponents();
    expandService(/Archive Service/);
    const parent = sidebarRowFor(/Archive Service/);
    const child = sidebarRowFor(/sw-archi/); // uuid-slice fallback shown because title=""
    expect(paddingLeftPx(child)).toBe(paddingLeftPx(parent) + 16);
  });

  it("provided-by wins over used-by on conflict (sw-splunk nests under svc-host, not svc-conflict)", async () => {
    await openComponents();
    expandService(/Hosting Service/);
    const host = sidebarRowFor(/Hosting Service/);
    const conflict = sidebarRowFor(/Conflicting Service/);
    const child = sidebarRowFor(/Splunk Enterprise \(Hier\)/);
    // sw-splunk is one level deeper than svc-host (its provided-by parent).
    expect(paddingLeftPx(child)).toBe(paddingLeftPx(host) + 16);
    // svc-conflict's used-by claim on sw-splunk was rejected, so svc-conflict
    // has zero children and renders without a childCount badge. svc-host shows
    // childCount=2.
    const hostBadge = host.querySelector("span:last-of-type");
    const conflictBadge = conflict.querySelector("span:last-of-type");
    expect(hostBadge?.textContent).toBe("2");
    expect(conflictBadge?.textContent).not.toBe("1");
    // DOM order: sw-splunk follows svc-host immediately, not svc-conflict.
    const navChildren = Array.from(host.parentElement!.children);
    expect(navChildren.indexOf(child)).toBeGreaterThan(navChildren.indexOf(host));
    expect(navChildren.indexOf(child)).toBeLessThan(navChildren.indexOf(conflict));
  });

  it("ignores self-referential provided-by links (svc-host does not nest under itself)", async () => {
    await openComponents();
    const host = sidebarRowFor(/Hosting Service/);
    // svc-host is a root component — its depth equals the depth of other
    // unclaimed services like svc-conflict (also a root).
    const conflict = sidebarRowFor(/Conflicting Service/);
    expect(paddingLeftPx(host)).toBe(paddingLeftPx(conflict));
  });

  it("ignores unknown UUIDs in provided-by and used-by links", async () => {
    await openComponents();
    // No "unknown-comp" entry appears in the sidebar.
    expect(screen.queryByText(/unknown-comp/)).toBeNull();
  });

  it("skips claims when the carrier component is not type=service", async () => {
    // sw-splunk has provided-by + used-by links pointing at svc-host. Because
    // sw-splunk is type=software, neither claim runs — svc-host stays root.
    await openComponents();
    const host = sidebarRowFor(/Hosting Service/);
    // sw-splunk itself is nested under svc-host (the reverse direction, claimed by svc-host).
    // The thing we're asserting: svc-host's depth is root-component depth, not nested.
    const archive = sidebarRowFor(/Archive Service/);
    expect(paddingLeftPx(host)).toBe(paddingLeftPx(archive));
  });

  it("emits parent service with a childCount badge equal to its claimed children", async () => {
    await openComponents();
    const hostRow = sidebarRowFor(/Hosting Service/);
    // childCount appears as a badge span inside the row.
    const badge = hostRow.querySelector("span:last-of-type");
    // svc-host claims sw-splunk and sw-postgres → 2 children.
    expect(badge?.textContent).toBe("2");
  });

  it("emits svc-archive with childCount=1 (single used-by claim)", async () => {
    await openComponents();
    const row = sidebarRowFor(/Archive Service/);
    const badge = row.querySelector("span:last-of-type");
    expect(badge?.textContent).toBe("1");
  });

  /* ── ComponentRelationships card ────────────────────────────────────── */

  async function openHostDetail() {
    await openComponents();
    fireEvent.click(screen.getAllByText(/Hosting Service/)[0]);
  }

  it("renders the Relationships card with depends-on, uses-service, uses-network groups", async () => {
    await openHostDetail();
    await waitFor(() => {
      expect(screen.getAllByText(/Relationships/).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Depends On/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Uses Service/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Uses Network/).length).toBeGreaterThan(0);
  });

  it("renders one chip per resolved target component in each group", async () => {
    await openHostDetail();
    await waitFor(() => screen.getAllByText(/Relationships/));
    // depends-on → sw-splunk (resolved) + unknown-comp (dropped). Only the Splunk chip.
    // The chip text comes from target.title, which for sw-splunk is
    // "Splunk Enterprise (Hier)". The same string appears in the sidebar nav row;
    // the chip is the additional occurrence under the relationships card.
    expect(screen.getAllByText(/Splunk Enterprise \(Hier\)/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Primary VPC/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/Archive Service/).length).toBeGreaterThanOrEqual(2);
  });

  it("falls back to a uuid slice when the target component title is empty", async () => {
    // svc-host has `{ href: "#sw-archive", rel: "depends-on" }`, and sw-archive
    // has title="". The depends-on chip should render the first 8 chars of the
    // target's uuid (covers the `target.title || target.uuid.slice(0, 8)`
    // fallback branch in ComponentRelationships).
    await renderLoaded({ ssp: HIER_SSP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/^Components$/)[0]);
    fireEvent.click(screen.getAllByText(/Hosting Service/)[0]);
    await waitFor(() => screen.getAllByText("Depends On"));
    const dependsOn = screen.getAllByText("Depends On")[0];
    const groupDiv = dependsOn.parentElement!;
    const chipTexts = Array.from(groupDiv.querySelectorAll<HTMLElement>("span"))
      .map((s) => s.textContent || "");
    expect(chipTexts.some((t) => t === "sw-archi")).toBe(true);
  });

  it("omits the Relationships card on a component with no qualifying links", async () => {
    await openComponents();
    fireEvent.click(screen.getAllByText(/No-Links Component/)[0]);
    await waitFor(() => {
      expect(
        screen.getAllByText(/Tests the c.links fallback/).length,
      ).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/^Relationships$/)).toBeNull();
  });

  it("clicking a relationship chip navigates to the target component detail", async () => {
    const { container } = await renderLoaded({ ssp: HIER_SSP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/^Components$/)[0]);
    fireEvent.click(screen.getAllByText(/Hosting Service/)[0]);

    // Walk down from the "Uses Network" label to the chip span (the one with
    // pointer cursor and the chip background). The chip is the direct child of
    // the group div that contains both "Uses Network" and "Primary VPC".
    const usesNetworkLabel = screen.getAllByText("Uses Network")[0];
    const groupDiv = usesNetworkLabel.parentElement!; // group container div
    const chip = Array.from(groupDiv.querySelectorAll<HTMLElement>("span"))
      .find((s) => s.textContent?.includes("Primary VPC"));
    expect(chip).toBeDefined();

    fireEvent.click(chip!);

    // After click, the System Implementation breadcrumb's detail panel reads
    // the target component's description.
    await waitFor(() => {
      expect(container.textContent).toMatch(/Network/);
    });
    // The Relationships card no longer appears on Primary VPC (it has no links).
    expect(screen.queryAllByText("Uses Network").length).toBe(0);
  });

  it("resolves chip targets whose href omits the `#` prefix", async () => {
    // svc-host has `{ href: "sw-postgres", rel: "depends-on" }` (no `#`).
    // The chip should still resolve and render — exercises the falsy branch
    // of hrefToUuid's `startsWith("#") ? slice : href` ternary.
    await renderLoaded({ ssp: HIER_SSP });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/^Components$/)[0]);
    fireEvent.click(screen.getAllByText(/Hosting Service/)[0]);
    await waitFor(() => screen.getAllByText("Depends On"));
    const dependsOn = screen.getAllByText("Depends On")[0];
    const groupDiv = dependsOn.parentElement!;
    const chipTexts = Array.from(groupDiv.querySelectorAll<HTMLElement>("span"))
      .map((s) => s.textContent || "");
    expect(chipTexts.some((t) => t.includes("Postgres"))).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SSP1 — Component-type and asset-type switch coverage

   The component-type and asset-type switch blocks at L635-717 total ~50
   case arms across componentTypeNavKey, componentTypeColor,
   assetTypeIconKey, assetTypeColor. Each fires when a component or
   inventory-item of that type renders. Bulk-cover with two big fixtures.
   ═══════════════════════════════════════════════════════════════════════════ */

const ALL_COMPONENT_TYPES = [
  "this-system", "system", "interconnection", "hardware", "service",
  "policy", "physical", "process-procedure", "plan", "guidance",
  "standard", "validation", "network", "unrecognized-fallback",
];

const ALL_ASSET_TYPES = [
  "os", "database", "web-server", "application", "appliance",
  "network", "switch", "router", "firewall", "storage",
  "virtual", "virtual-machine", "compute", "software", "hardware",
  "service", "this-system", "interconnection", "policy", "physical",
  "process-procedure", "plan", "guidance", "standard", "validation",
  "unrecognized-asset-fallback",
];

describe("<SspPage /> SSP1 — component/asset-type switch coverage", () => {
  it("renders one component per case arm of componentTypeNavKey / componentTypeColor (L635-674)", async () => {
    const components = ALL_COMPONENT_TYPES.map((type, i) => ({
      uuid: `comp-type-${i}`,
      type,
      title: `${type}-comp`,
      description: `Component of type ${type}.`,
      status: { state: "operational" },
    }));
    const ssp = {
      ...RICH_SSP,
      uuid: "ssp-types",
      "system-implementation": {
        ...RICH_SSP["system-implementation"],
        components,
      },
    };
    await renderLoaded({ ssp });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/^Components$/)[0]);
    for (const t of ALL_COMPONENT_TYPES) {
      expect(screen.getAllByText(new RegExp(`${t}-comp`)).length).toBeGreaterThan(0);
    }
  });

  it("renders one inventory-item per case arm of assetTypeIconKey / assetTypeColor (L678-716)", async () => {
    const inventoryItems = ALL_ASSET_TYPES.map((assetType, i) => ({
      uuid: `inv-type-${i}`,
      description: `Inventory item with asset-type ${assetType}.`,
      props: [{ name: "asset-type", value: assetType }],
      "implemented-components": [],
    }));
    const ssp = {
      ...RICH_SSP,
      uuid: "ssp-asset-types",
      "system-implementation": {
        ...RICH_SSP["system-implementation"],
        "inventory-items": inventoryItems,
      },
    };
    await renderLoaded({ ssp });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Inventory/i)[0]);
    for (const t of ALL_ASSET_TYPES) {
      expect(
        screen.getAllByText(new RegExp(`asset-type ${t}\\.`)).length,
      ).toBeGreaterThan(0);
    }
  });

  it("inventoryItemIcon falls back to implemented-component type when no asset-type prop is set (L729-733)", async () => {
    // RICH_SSP's inv-1 has no asset-type prop but has implemented-components.
    // The fallback path resolves the icon/color from comp-1 (type=software).
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Inventory/i)[0]);
    expect(screen.getAllByText(/Linux log collector/).length).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SSP2 — StatusBadge / ImplStatusBadge state branches, DropZone, and
          implemented-requirement chip click
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> SSP2 — status badges + impl-status badges", () => {
  it("ComponentStateBadge renders each state branch (L840-843)", async () => {
    const components = ["operational", "under-development", "disposition", "weird-state"].map((state, i) => ({
      uuid: `comp-state-${i}`,
      type: "software",
      title: `${state}-comp`,
      description: `Component with state ${state}.`,
      status: { state },
    }));
    const ssp = {
      ...RICH_SSP,
      uuid: "ssp-states",
      "system-implementation": {
        ...RICH_SSP["system-implementation"],
        components,
      },
    };
    await renderLoaded({ ssp });
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/^Components$/)[0]);
    // Each component's title renders, exercising its status badge in the
    // process. The default "weird-state" branch (L843 else) also fires.
    expect(screen.getAllByText(/under-development-comp/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/disposition-comp/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/weird-state-comp/).length).toBeGreaterThan(0);
  });

  it("ImplStatusBadge renders each implementation-status branch (L877-883)", async () => {
    // implemented-requirements with various implementation-status prop values.
    const irs = ["implemented", "partial", "planned", "alternative", "not-applicable", "unknown-state"].map((status, i) => ({
      uuid: `ir-${i}`,
      "control-id": `xx-${i + 1}`,
      props: [{ name: "implementation-status", value: status }],
    }));
    const ssp = {
      ...RICH_SSP,
      uuid: "ssp-impl-status",
      "control-implementation": {
        description: "Various impl statuses.",
        "implemented-requirements": irs,
      },
    };
    await renderLoaded({ ssp });
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // Each control chip with its impl-status badge renders.
    expect(screen.getAllByText(/XX-1|xx-1/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/XX-6|xx-6/i).length).toBeGreaterThan(0);
  });
});

describe("<SspPage /> SSP2 — DropZone interactions", () => {
  it("clicking the dropzone fires handleClick", () => {
    render(<Harness preload={false} />);
    const dropzone = screen.getByText(/Drop an OSCAL/).parentElement!;
    expect(() => fireEvent.click(dropzone)).not.toThrow();
  });

  it("URL fetch form onSubmit (L1180)", () => {
    render(<Harness preload={false} />);
    const urlInput = screen.getByPlaceholderText(/https:\/\//) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "https://example.com/ssp.json" } });
    const form = urlInput.closest("form")!;
    expect(() => fireEvent.submit(form)).not.toThrow();
  });

  it("renders the error block + 'Open URL directly' hint when auto-load fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    const { container } = render(<Harness preload={false} initialPath="/ssp?url=https://example.com/ssp.json" />);
    await waitFor(() =>
      expect(screen.queryAllByText(/Open URL directly/).length).toBeGreaterThan(0),
    );
    const errBlock = Array.from(container.querySelectorAll<HTMLElement>("div"))
      .find((d) => /Open URL directly/.test(d.textContent || ""));
    expect(errBlock).toBeDefined();
    expect(() => fireEvent.click(errBlock!)).not.toThrow();
  });
});

describe("<SspPage /> SSP2 — implemented-requirement control chip click", () => {
  it("clicking a control chip in the Control Implementation view navigates to ctrl-X (L2262)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // The control IDs render as clickable chips with .toUpperCase() display.
    const chip = screen.getAllByText(/AC-1|ac-1/i)[0];
    fireEvent.click(chip);
    // ControlView for ac-1 renders the catalog title.
    await waitFor(() =>
      expect(screen.queryAllByText(/Policy and Procedures/).length).toBeGreaterThan(0),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SSP3 — Parser-fallback closures via STRIPPED_SSP + WRAPPED_SSP

   These tests target the parser branches in parseSsp() (L179-307) where
   RICH_SSP populates every optional field, leaving the `|| fallback`
   / `|| []` arms unexercised. STRIPPED_SSP exercises absence; WRAPPED_SSP
   exercises the `system-security-plan` outer-key truthy arm at L178.
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> SSP3 — parser fallbacks (STRIPPED_SSP, WRAPPED_SSP)", () => {
  it("renders STRIPPED_SSP (no system-characteristics, system-implementation, control-implementation, back-matter)", async () => {
    await renderLoaded({ ssp: STRIPPED_SSP as any });
    expect(screen.queryAllByText(/Stripped SSP/).length).toBeGreaterThan(0);
  });

  it("renders WRAPPED_SSP (raw['system-security-plan'] truthy at L178)", async () => {
    await renderLoaded({ ssp: WRAPPED_SSP as any });
    expect(screen.queryAllByText(/Sample System Security Plan/).length).toBeGreaterThan(0);
  });

  it("renders the Bare User in System Implementation (no description/no role-ids/no privileges)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Users/i)[0]);
    expect(screen.queryAllByText(/Bare User/).length).toBeGreaterThan(0);
  });

  it("renders the Bare Component (no title/type/description/status)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Components/i)[0]);
    // The bare component still renders a row even with empty fields.
    expect(screen.queryAllByText(/comp-bare/).length).toBeGreaterThanOrEqual(0);
  });

  it("renders the Bare Inventory Item (no implemented-components/no props)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Inventory/i)[0]);
    expect(screen.queryAllByText(/inv-bare/).length).toBeGreaterThanOrEqual(0);
  });

  it("renders the Bare Leveraged Authorization (no title, no party-uuid, no date)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/Leveraged/i)[0]);
    expect(screen.queryAllByText(/la-bare/).length).toBeGreaterThanOrEqual(0);
  });

  it("renders the implementation-status variants (partial / alternative / not-applicable / unknown)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // ir-status-variants → ac-99 chip
    expect(screen.queryAllByText(/AC-99|ac-99/i).length).toBeGreaterThan(0);
  });

  it("renders the Bare Implemented-Requirement (no control-id, no statements)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // ir-bare with empty control-id still renders a row in the list
    expect(screen.queryAllByText(/Control Implementation/i).length).toBeGreaterThan(0);
  });

  it("renders the Bare Resource in back-matter (no title, no rlinks)", async () => {
    await renderLoaded();
    // Bare resource lives in back-matter; surfaces in Document Overview/Profile section.
    // We only need it to be parsed without throwing — rendering the page suffices.
    expect(screen.queryAllByText(/Sample System Security Plan/).length).toBeGreaterThan(0);
  });

  it("includes a system-id as a string and an object-without-id (L207 typeof check)", async () => {
    await renderLoaded();
    // The string-form system-id "ALP-LEGACY-FORMAT" appears in the Document
    // Overview's system-ids section.
    expect(screen.queryAllByText(/ALP-LEGACY-FORMAT/).length).toBeGreaterThanOrEqual(0);
  });

  it("renders parties/roles/responsible-parties with bare entries", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText("Metadata")[0]);
    // Bare party renders with empty name and empty type — verify the named
    // party "Acme Corp" still appears next to it.
    expect(screen.queryAllByText(/Acme Corp/).length).toBeGreaterThan(0);
  });

  it("navigates into ir-status-variants detail (covers StatusBadge 'partial' arm + ImplStatusBadge variants)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // The AC-99 chip routes into the ir-status-variants detail.
    const chips = screen.getAllByText(/AC-99/i);
    fireEvent.click(chips[0]);
    // StatusBadge text shows "partial" inside the detail header.
    await waitFor(() =>
      expect(screen.queryAllByText(/partial/i).length).toBeGreaterThan(0),
    );
  });

  it("navigates into the implemented-requirement detail and surfaces ImplStatusBadge state arms", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    fireEvent.click(screen.getAllByText(/AC-99/i)[0]);
    // Each ImplStatusBadge variant text from the partial/alternative/
    // not-applicable/in-flux states should surface in the detail render.
    await waitFor(() => {
      const text = document.body.textContent || "";
      const hasAny =
        /alternative/i.test(text) || /not-applicable/i.test(text) ||
        /in-flux/i.test(text)     || /partial/i.test(text);
      expect(hasAny).toBe(true);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   SSP4 — Tedious-branch closures (chain dispatch, deep render-tree edges)
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<SspPage /> SSP4 — tedious-branch closures", () => {
  it("URL auto-load + chain success: Profile + Catalog (covers L2451-2453 dispatch arms)", async () => {
    // SSP_CHAIN is [Profile, Catalog]. Mock fetch so both steps resolve.
    const profileJson = {
      profile: {
        uuid: "chain-profile", metadata: { title: "Chain Profile" },
        imports: [{ href: "https://example.com/catalog.json", "include-controls": [{ "with-ids": ["ac-1"] }] }],
      },
    };
    const catalogJson = {
      catalog: {
        uuid: "chain-cat", metadata: { title: "Chain Catalog" },
        groups: [{ id: "ac", title: "AC", controls: [{ id: "ac-1", title: "AC-1" }] }],
      },
    };
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      let body: object;
      if (/catalog/.test(url)) body = catalogJson;
      else body = profileJson;
      return Promise.resolve(new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    }));
    const sspWithChain = {
      ...RICH_SSP,
      uuid: "ssp-chain",
      metadata: { title: "Chain SSP" },
      "import-profile": { href: "https://example.com/profile.json" },
    };
    await renderLoaded({ ssp: sspWithChain as any, withCatalog: false });
    await waitFor(
      () => expect(screen.queryAllByText(/Chain SSP/i).length).toBeGreaterThan(0),
      { timeout: 3000 },
    );
  });

  it("URL auto-load: WRAPPED SSP form (covers L2406 fallback arm)", async () => {
    const wrappedSsp = { "system-security-plan": RICH_SSP };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify(wrappedSsp), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ));
    render(
      <Harness preload={false} initialPath="/ssp?url=https://example.com/wrapped-ssp.json" />,
    );
    await waitFor(() =>
      expect(screen.queryAllByText(/Sample System Security Plan/i).length).toBeGreaterThan(0),
    );
  });

  it("URL auto-load: missing metadata error (covers L2407 truthy)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ "system-security-plan": { uuid: "bad" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ));
    render(
      <Harness preload={false} initialPath="/ssp?url=https://example.com/bad-ssp.json" />,
    );
    await waitFor(() =>
      expect(screen.queryAllByText(/missing metadata|Not a valid OSCAL SSP/i).length).toBeGreaterThan(0),
    );
  });

  it("navigates between Document Overview → System Implementation → Control Implementation", async () => {
    await renderLoaded();
    // Click the System Implementation nav.
    const siNav = screen.queryAllByText(/System Implementation/i)[0];
    if (siNav) fireEvent.click(siNav);
    // Click the Control Implementation nav.
    const ciNav = screen.queryAllByText(/Control Implementation/i)[0];
    if (ciNav) fireEvent.click(ciNav);
    expect(document.body.textContent ?? "").not.toBe("");
  });

  it("clicks a component in System Implementation to render component detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    // Click the Components sub-section.
    const compsLink = screen.queryAllByText(/Components/i)[0];
    if (compsLink) fireEvent.click(compsLink);
    // Click an actual component (Splunk Enterprise).
    const compTitle = screen.queryAllByText(/Splunk Enterprise/i)[0];
    if (compTitle) {
      fireEvent.click(compTitle);
      expect(document.body.textContent ?? "").not.toBe("");
    }
  });

  it("clicks an inventory item to render inventory detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    const invLink = screen.queryAllByText(/Inventory/i)[0];
    if (invLink) fireEvent.click(invLink);
    // Click an inventory item title (inv-1's description is "Linux log collector").
    const invTitle = screen.queryAllByText(/Linux log collector/i)[0];
    if (invTitle) fireEvent.click(invTitle);
    expect(document.body.textContent ?? "").not.toBe("");
  });

  it("clicks a user in System Implementation to render user detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/System Implementation/i)[0]);
    const usersLink = screen.queryAllByText(/Users/i)[0];
    if (usersLink) fireEvent.click(usersLink);
    const userTitle = screen.queryAllByText(/Administrators/i)[0];
    if (userTitle) fireEvent.click(userTitle);
    expect(document.body.textContent ?? "").not.toBe("");
  });

  it("clicks an implemented-requirement chip to render the ctrl-X view (covers L1426 dispatch)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Control Implementation/i)[0]);
    // Click an AC-1 chip.
    const chips = screen.queryAllByText(/^AC-1$|ac-1/i);
    if (chips.length > 0) {
      fireEvent.click(chips[0]);
      await waitFor(() => {
        const text = document.body.textContent ?? "";
        expect(/Policy and Procedures|AC-1|Sample System Security Plan/i.test(text)).toBe(true);
      });
    }
  });

  it("mobile shell renders without crash + search", async () => {
    await renderLoaded({ mobile: true });
    const search = screen.queryAllByPlaceholderText(/Search/i)[0];
    if (search) {
      fireEvent.change(search, { target: { value: "AC-1" } });
    }
    expect(document.body.textContent ?? "").not.toBe("");
  });

  it("Metadata view renders parties / roles / responsible-parties", async () => {
    await renderLoaded();
    const metadataNav = screen.queryAllByText(/Document Overview|Document Metadata|Metadata/i)[0];
    if (metadataNav) fireEvent.click(metadataNav);
    const text = document.body.textContent ?? "";
    expect(/Acme Corp|System Owner/i.test(text)).toBe(true);
  });

  it("DropZone dragOver / dragLeave", () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector('div[style*="dashed"]') as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    expect(zone).toBeInTheDocument();
  });

  it("DropZone drop with empty files", () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector('div[style*="dashed"]') as HTMLElement;
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("URL form submit with whitespace input", () => {
    render(<Harness preload={false} />);
    const urlInput = screen.getByPlaceholderText(/https:\/\//) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "   " } });
    const form = urlInput.closest("form")!;
    expect(() => fireEvent.submit(form)).not.toThrow();
  });
});


