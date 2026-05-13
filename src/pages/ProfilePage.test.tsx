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
import { useEffect, useRef, type ReactNode } from "react";
import ProfilePage from "./ProfilePage";
import { OscalProvider, useOscal, type Catalog } from "../context/OscalContext";
import { AuthProvider } from "../context/AuthContext";

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

/** A catalog that the sample profile targets — controls are referenced below. */
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
          params: [{ id: "ac-1_prm_1", label: "organization-defined roles" }],
          parts: [
            {
              id: "ac-1-stmt",
              name: "statement",
              prose: "Develop, document, and disseminate {{ insert: param, ac-1_prm_1 }}.",
            },
          ],
          controls: [
            {
              id: "ac-1.1",
              title: "Policy Updates",
              props: [{ name: "label", value: "AC-1(1)" }],
            },
          ],
        },
        {
          id: "ac-2",
          title: "Account Management",
          props: [{ name: "label", value: "AC-2" }],
        },
      ],
    },
    {
      id: "ia",
      title: "Identification and Authentication",
      controls: [
        {
          id: "ia-5",
          title: "Authenticator Management",
          props: [{ name: "label", value: "IA-5" }],
          params: [{ id: "ia-5_prm_1", label: "organization-defined frequency" }],
          parts: [
            { id: "ia-5-stmt", name: "statement", prose: "IA-5 statement." },
            { id: "ia-5-gdn", name: "guidance", prose: "IA-5 original guidance." },
            { id: "ia-5-ex", name: "example", prose: "IA-5 example prose." },
          ],
        },
      ],
    },
  ],
};

/** A rich profile: include-controls + modify alters/set-parameters + back-matter. */
interface Profile {
  uuid: string;
  metadata: {
    title: string;
    version?: string;
    "last-modified"?: string;
    "oscal-version"?: string;
    published?: string;
    parties?: any[];
    roles?: any[];
    props?: any[];
    links?: any[];
  };
  imports: any[];
  merge?: any;
  modify?: any;
  "back-matter"?: { resources?: any[] };
}

const RICH_PROFILE: Profile = {
  uuid: "prof-1",
  metadata: {
    title: "Sample Profile",
    version: "1.0",
    "last-modified": "2026-04-01T00:00:00Z",
    "oscal-version": "1.1.2",
    parties: [{ uuid: "p-1", type: "organization", name: "Acme Corp" }],
    roles: [{ id: "owner", title: "Owner" }],
    props: [{ name: "marking", value: "public" }],
    links: [
      { href: "https://example.com/p", rel: "reference", text: "Profile home" },
    ],
  },
  imports: [
    {
      href: "#cat-res",
      "include-controls": [
        { "with-ids": ["ac-1", "ac-1.1", "ia-5"] },
      ],
    },
  ],
  merge: { flat: {} },
  modify: {
    "set-parameters": [
      { "param-id": "ac-1_prm_1", values: ["senior official"] },
      { "param-id": "ia-5_prm_1", values: ["every 60 days"] },
    ],
    alters: [
      {
        "control-id": "ac-1",
        adds: [
          {
            name: "statement",
            by: "after",
            position: "ending",
            parts: [{ name: "statement", prose: "Added organization-specific guidance." }],
          },
        ],
        removes: [{ "name-ref": "guidance" }],
      },
      {
        "control-id": "ac-1.1",
        adds: [
          {
            by: "before",
            position: "starting",
            parts: [{ name: "statement", prose: "Enhancement prefix prose." }],
          },
        ],
      },
      {
        "control-id": "ia-5",
        adds: [
          {
            by: "id",
            position: "before",
            parts: [{ name: "guidance", prose: "IA-5 added guidance." }],
          },
        ],
        removes: [{ "name-ref": "example" }, { "by-id": "doesnt-matter-id" }],
      },
    ],
  },
  "back-matter": {
    resources: [
      {
        uuid: "cat-res",
        title: "Source Catalog",
        rlinks: [{ href: "https://example.com/cat.json", "media-type": "application/json" }],
      },
    ],
  },
};

/** Preload profile + catalog (optional) into OscalProvider once. */
function Seed({
  profile = RICH_PROFILE,
  catalog = CATALOG,
  withCatalog = true,
}: {
  profile?: Profile;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  const { setProfile, setCatalog } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (!didSeed.current) {
      didSeed.current = true;
      setProfile(profile as any, "profile.json");
      if (withCatalog) setCatalog(catalog, "cat.json");
    }
  }, [setProfile, setCatalog, profile, catalog, withCatalog]);
  return null;
}

function Harness({
  preload = true,
  mobile = false,
  initialPath = "/profile",
  profile = RICH_PROFILE,
  catalog = CATALOG,
  withCatalog = true,
}: {
  preload?: boolean;
  mobile?: boolean;
  initialPath?: string;
  profile?: Profile;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  stubMatchMedia(mobile);
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <OscalProvider>
          {preload && (
            <Seed profile={profile} catalog={catalog} withCatalog={withCatalog} />
          )}
          <ProfilePage />
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

function profileFile(
  data: object = { profile: RICH_PROFILE },
  name = "profile.json",
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
   Empty state — DropZone
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<ProfilePage /> empty state", () => {
  it("renders the DropZone when no profile is loaded", () => {
    render(<ProfilePage />, {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/profile"]}>
          <AuthProvider>
            <OscalProvider>{children}</OscalProvider>
          </AuthProvider>
        </MemoryRouter>
      ),
    });
    expect(screen.getByText(/OSCAL Profile Viewer/)).toBeInTheDocument();
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("disables the URL Fetch button until a URL is entered", () => {
    render(<Harness preload={false} />);
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    expect(fetchBtn).toBeDisabled();
    const url = screen.getByPlaceholderText(/https:\/\//);
    fireEvent.change(url, { target: { value: "https://ex.com/p.json" } });
    expect(fetchBtn).toBeEnabled();
  });

  it("loads a dropped profile and shifts to the viewer shell", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, profileFile());
    await waitFor(() =>
      expect(
        screen.getAllByText(/OSCAL Profile Viewer/).length,
      ).toBeGreaterThan(0),
    );
    await waitFor(() =>
      expect(screen.queryByText("Overview")).not.toBeNull(),
    );
  });

  it("surfaces 'no metadata' error on a malformed profile drop", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(
      zone,
      new File([JSON.stringify({ profile: { uuid: "x" } })], "x.json", {
        type: "application/json",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Not an OSCAL Profile/)).toBeInTheDocument(),
    );
  });

  it("surfaces 'no imports' when a profile has metadata but no imports", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(
      zone,
      new File(
        [JSON.stringify({ profile: { uuid: "x", metadata: { title: "t" } } })],
        "x.json",
        { type: "application/json" },
      ),
    );
    await waitFor(() =>
      expect(screen.getByText(/no imports/)).toBeInTheDocument(),
    );
  });

  it("surfaces a JSON parse error on a non-JSON drop", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(
      zone,
      new File(["not json"], "x.json", { type: "application/json" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/JSON/)).toBeInTheDocument(),
    );
  });

  it("accepts a profile at the root (no `profile` wrapper key)", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, profileFile(RICH_PROFILE));
    await waitFor(() =>
      expect(screen.queryByText("Overview")).not.toBeNull(),
    );
  });

  it("auto-loads when ?url= points at a valid profile (mocked fetch)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ profile: RICH_PROFILE }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(
      <Harness preload={false} initialPath="/profile?url=https://ex.com/p.json" />,
    );
    await waitFor(() =>
      expect(screen.queryByText("Overview")).not.toBeNull(),
    );
  });

  it("shows an HTTP error in the DropZone when auto-load fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("nope", { status: 500, statusText: "Internal Error" }),
      ),
    );
    render(
      <Harness preload={false} initialPath="/profile?url=https://ex.com/p.json" />,
    );
    await waitFor(() =>
      expect(screen.getByText(/HTTP 500/)).toBeInTheDocument(),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — desktop
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<ProfilePage /> loaded — desktop", () => {
  it("renders the top bar, filename, and overview content", async () => {
    await renderLoaded();
    expect(screen.getByText(/OSCAL Profile Viewer/)).toBeInTheDocument();
    expect(screen.getByText("profile.json")).toBeInTheDocument();
    // Overview lists the family header count
    expect(
      screen.getAllByText(/Sample Profile/).length,
    ).toBeGreaterThan(0);
  });

  it("New File resets to the DropZone", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "New File" }));
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("navigates to the Metadata view via sidebar", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Metadata"));
    expect(screen.getAllByText(/Acme Corp/).length).toBeGreaterThan(0);
  });

  it("navigates to the Imports view via sidebar", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Imports"));
    // Imports view shows the import href / include / exclude sections
    expect(
      screen.getAllByText(/include-controls|Include controls|Imports|Include/i)
        .length,
    ).toBeGreaterThan(0);
  });

  it("renders family headers (Access Control, Identification and Authentication)", async () => {
    await renderLoaded();
    expect(
      screen.getAllByText(/Access Control/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Identification and Authentication/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates into a family view when a family row is clicked", async () => {
    await renderLoaded();
    const acRows = screen.getAllByText(/Access Control/);
    fireEvent.click(acRows[0]);
    // FamilyView renders a "Controls (N)" section and "Base Controls" MField
    expect(
      screen.getAllByText(/Controls \(\d+\)/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Base Controls/)).toBeInTheDocument();
  });

  it("navigates to a control detail via the family view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    // FamilyView shows "AC-1" as a clickable row. Click it.
    fireEvent.click(screen.getAllByText("AC-1")[0]);
    // ControlModView shows the catalog title
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Policy and Procedures/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders modify alter contributions in the control detail view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    fireEvent.click(screen.getAllByText("AC-1")[0]);
    // The profile's alter "adds" a statement that should be visible in the
    // resolved ControlModView
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Added organization-specific guidance/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("filters the sidebar tree by a control ID / label search", async () => {
    await renderLoaded();
    const search = screen.getByPlaceholderText("Search controls");
    fireEvent.change(search, { target: { value: "ia" } });
    // The IA family row remains visible
    expect(
      screen.getAllByText(/Identification and Authentication/).length,
    ).toBeGreaterThan(0);
  });

  it("expand / collapse family rows without navigation side effects", async () => {
    await renderLoaded();
    const family = screen.getAllByText(/Access Control/)[0];
    // Clicking the row fires onClick AND onToggle (expand chevron behaviour)
    fireEvent.click(family);
    fireEvent.click(family);
    // Family stays visible in the sidebar either way
    expect(
      screen.getAllByText(/Access Control/).length,
    ).toBeGreaterThan(0);
  });

  it("drills into an enhancement control detail (ac-1.1)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Access Control/)[0]);
    // Expand the parent control to reveal enhancements
    fireEvent.click(screen.getAllByText("AC-1")[0]);
    fireEvent.click(screen.getAllByText(/AC-1\(1\)/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Enhancement prefix prose/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("drills into an IA family control detail and shows modify alter prose", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Identification and Authentication/)[0]);
    fireEvent.click(screen.getAllByText("IA-5")[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/IA-5 added guidance/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders modified parameter value from profile overrides (every 60 days)", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Identification and Authentication/)[0]);
    fireEvent.click(screen.getAllByText("IA-5")[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/every 60 days/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("expand/collapse persists sidebar state", async () => {
    await renderLoaded();
    const family = screen.getAllByText(/Access Control/)[0];
    fireEvent.click(family);
    const titleCountAfterClick = screen.getAllByText(/Access Control/).length;
    fireEvent.click(family);
    expect(
      screen.getAllByText(/Access Control/).length,
    ).toBe(titleCountAfterClick);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — mobile
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<ProfilePage /> loaded — mobile", () => {
  it("renders the mobile shell with a New button and root drill list", async () => {
    await renderLoaded({ mobile: true });
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("pressing New on the mobile top bar resets to the DropZone", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByRole("button", { name: "New" }));
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("drills into a family and shows its controls by label", async () => {
    await renderLoaded({ mobile: true });
    const family = screen.getAllByText(/Access Control/)[0];
    fireEvent.click(family);
    await waitFor(() =>
      expect(screen.getAllByText(/AC-1/).length).toBeGreaterThan(0),
    );
  });

  it("mobile search filter works on control IDs", async () => {
    await renderLoaded({ mobile: true });
    const search = screen.getByPlaceholderText(/Search controls/);
    fireEvent.change(search, { target: { value: "ia-5" } });
    // IA-5 control label is shown in the sidebar after filtering
    expect(
      screen.getAllByText(/IA-5/).length,
    ).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<ProfilePage /> edge cases", () => {
  it("renders the Overview even when no catalog is loaded", async () => {
    await renderLoaded({ withCatalog: false });
    expect(
      screen.getAllByText(/Sample Profile/).length,
    ).toBeGreaterThan(0);
  });

  it("handles include-all imports (pulls IDs from alters when no catalog)", async () => {
    const includeAll: Profile = {
      ...RICH_PROFILE,
      imports: [{ href: "#cat-res", "include-all": {} }],
      modify: {
        alters: [
          {
            "control-id": "ac-99",
            adds: [],
          },
        ],
      },
    };
    await renderLoaded({ profile: includeAll, withCatalog: false });
    expect(
      screen.getAllByText(/Sample Profile/).length,
    ).toBeGreaterThan(0);
  });

  it("handles include-all imports with a loaded catalog (pulls every ID)", async () => {
    const includeAll: Profile = {
      ...RICH_PROFILE,
      imports: [{ href: "#cat-res", "include-all": {} }],
    };
    await renderLoaded({ profile: includeAll });
    expect(
      screen.getAllByText(/Access Control/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates back to Overview after visiting Metadata", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Metadata"));
    fireEvent.click(screen.getAllByText("Overview")[0]);
    expect(
      screen.getAllByText(/Sample Profile/).length,
    ).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   controlIds collector — current (incomplete) behavior

   These tests lock in what the controlIds collector at ProfilePage.tsx:748-788
   actually does today. The OSCAL Profile spec defines three include-controls
   mechanisms (`with-ids`, `matching.pattern` globs) plus exclude-controls;
   the current implementation honors only `with-ids` on `include-controls`
   and silently drops the rest.

   Per `.development/plans/quirks.md` section 1 — these are real spec-
   conformance bugs queued for a follow-on fix. The tests below ASSERT the
   buggy behavior so the fix shows up as a clear, scoped failure set when
   it lands. Do not "correct" these expectations — change the product code
   instead and watch them flip.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Navigate the loaded Profile page to the Imports view and return the
 *  rendered Selected Control IDs count + ordered list of displayed labels. */
async function readSelectedControls(): Promise<{ count: number; labels: string[] }> {
  fireEvent.click(screen.getByText("Imports"));
  await waitFor(() => {
    expect(screen.getAllByText(/Selected Control IDs/).length).toBeGreaterThan(0);
  });
  const label = screen.getAllByText(/Selected Control IDs/)[0];
  const m = label.textContent?.match(/\((\d+)\)/);
  const count = m ? Number(m[1]) : NaN;
  // SectionLabel renders <div>{children}</div>; the chips container is its
  // next sibling (a flex wrap div with one <span> per id).
  const chipsContainer = label.nextElementSibling as HTMLElement | null;
  const labels = chipsContainer
    ? Array.from(chipsContainer.querySelectorAll("span"))
        .map((s) => s.textContent || "")
        .filter((t) => t.length > 0)
    : [];
  return { count, labels };
}

function profileWithImports(imports: any[], extras: Partial<typeof RICH_PROFILE> = {}): Profile {
  return { ...RICH_PROFILE, ...extras, imports };
}

describe("<ProfilePage /> controlIds — matching patterns (BUG: currently dropped)", () => {
  it("BUG: `matching.pattern: ac-*` is silently ignored — selection is empty when only matching is set", async () => {
    const p = profileWithImports([
      { href: "#cat-res", "include-controls": [{ matching: [{ pattern: "ac-*" }] }] },
    ]);
    await renderLoaded({ profile: p });
    const { count } = await readSelectedControls();
    // SPEC: count should be 3 (ac-1, ac-1.1, ac-2). Current implementation:
    // collector only reads `with-ids`, so matching never contributes.
    expect(count).toBe(0);
  });

  it("BUG: `with-ids` works but the `matching` half of the same clause is dropped", async () => {
    const p = profileWithImports([
      {
        href: "#cat-res",
        "include-controls": [
          { "with-ids": ["ac-1"], matching: [{ pattern: "ac-*" }] },
        ],
      },
    ]);
    await renderLoaded({ profile: p });
    const { count, labels } = await readSelectedControls();
    // SPEC: count should be 3 (ac-1 + ac-1.1 + ac-2 via matching, deduped).
    // Current: only `with-ids` contributes → just ac-1.
    expect(count).toBe(1);
    expect(labels).toEqual(["AC-1"]);
  });

  it("BUG: a matching-only clause with no with-ids contributes nothing alongside a working with-ids clause", async () => {
    const p = profileWithImports([
      {
        href: "#cat-res",
        "include-controls": [
          { matching: [{ pattern: "ia-*" }] }, // dropped
          { "with-ids": ["ac-1"] },             // kept
        ],
      },
    ]);
    await renderLoaded({ profile: p });
    const { count, labels } = await readSelectedControls();
    // SPEC: ac-1 + ia-5 = 2. Current: just ac-1.
    expect(count).toBe(1);
    expect(labels).toEqual(["AC-1"]);
  });
});

describe("<ProfilePage /> controlIds — exclude-controls (BUG: currently ignored)", () => {
  it("BUG: `exclude-controls[].with-ids` does not subtract from the include set", async () => {
    const p = profileWithImports([
      {
        href: "#cat-res",
        "include-controls": [{ "with-ids": ["ac-1", "ac-1.1", "ia-5"] }],
        "exclude-controls": [{ "with-ids": ["ac-1.1"] }],
      },
    ]);
    await renderLoaded({ profile: p });
    const { count, labels } = await readSelectedControls();
    // SPEC: exclude ac-1.1 → count 2. Current: excludes are silently dropped
    // → count 3 with ac-1.1 still present.
    expect(count).toBe(3);
    expect(labels).toContain("AC-1(1)");
  });

  it("BUG: `exclude-controls[].matching` against include-all does not narrow the universe", async () => {
    const p = profileWithImports([
      {
        href: "#cat-res",
        "include-all": {},
        "exclude-controls": [{ matching: [{ pattern: "ac-*" }] }],
      },
    ]);
    await renderLoaded({ profile: p });
    const { count, labels } = await readSelectedControls();
    // SPEC: include-all minus ac-* → just ia-5 (count 1). Current: exclude
    // is dropped → full catalog (4: ac-1, ac-1.1, ac-2, ia-5).
    expect(count).toBe(4);
    expect(labels).toContain("AC-1");
    expect(labels).toContain("IA-5");
  });
});

describe("<ProfilePage /> controlIds — current behavior edge cases", () => {
  it("returns an empty selection when an import has neither include-all nor include-controls", async () => {
    const p = profileWithImports([{ href: "#cat-res" }]);
    await renderLoaded({ profile: p });
    const { count } = await readSelectedControls();
    expect(count).toBe(0);
  });

  it("a clause with no `with-ids` key contributes nothing to the include set", async () => {
    const p = profileWithImports([
      {
        href: "#cat-res",
        "include-controls": [
          {},                                // empty clause — covers the `if (ic["with-ids"])` false branch
          { "with-ids": ["ia-5"] },          // working clause
        ],
      },
    ]);
    await renderLoaded({ profile: p });
    const { count, labels } = await readSelectedControls();
    expect(count).toBe(1);
    expect(labels).toEqual(["IA-5"]);
  });

  it("retains duplicates when the same id appears in two imports' with-ids (no dedup)", async () => {
    const p = profileWithImports([
      { href: "#cat-1", "include-controls": [{ "with-ids": ["ac-1", "ia-5"] }] },
      { href: "#cat-2", "include-controls": [{ "with-ids": ["ac-1"] }] },
    ]);
    await renderLoaded({ profile: p });
    const { count, labels } = await readSelectedControls();
    // Current collector does not de-dup. ac-1 appears twice in the array,
    // and the rendered count reflects that. Note: the chip list renders one
    // span per id (React keys by id), so the visible chip count differs
    // from the numeric count. The count is the load-bearing assertion.
    expect(count).toBe(3);
    // De-dup is also queued in quirks.md as part of the same spec-fix round.
    expect(new Set(labels).size).toBeLessThanOrEqual(2);
  });

  it("include-all walks groups recursively when collecting the catalog universe", async () => {
    // Exercises the `for (const sg of g.groups ?? []) collectFromGroup(sg)`
    // branch of the include-all collector — a nested group with a leaf
    // control should still be picked up.
    const nestedCatalog: Catalog = {
      uuid: "cat-nested",
      metadata: { title: "Nested" },
      groups: [
        {
          id: "outer",
          title: "Outer",
          groups: [
            {
              id: "inner",
              title: "Inner",
              controls: [{ id: "sr-1", title: "Supply Risk", props: [{ name: "label", value: "SR-1" }] }],
            },
          ],
        },
      ],
    };
    const p = profileWithImports([{ href: "#cat-res", "include-all": {} }]);
    await renderLoaded({ profile: p, catalog: nestedCatalog });
    const { count, labels } = await readSelectedControls();
    expect(count).toBe(1);
    expect(labels).toEqual(["SR-1"]);
  });

  it("include-all walks the top-level `controls` array when the catalog has no groups", async () => {
    // Exercises the second collection loop — for catalogs that expose a
    // top-level `controls` array instead of `groups`.
    const flatCatalog: Catalog = {
      uuid: "cat-flat",
      metadata: { title: "Flat Catalog" },
      controls: [
        {
          id: "pm-1",
          title: "Top-Level Control",
          props: [{ name: "label", value: "PM-1" }],
          controls: [{ id: "pm-1.1", title: "Enhancement", props: [{ name: "label", value: "PM-1(1)" }] }],
        },
      ],
    };
    const p = profileWithImports([{ href: "#cat-res", "include-all": {} }]);
    await renderLoaded({ profile: p, catalog: flatCatalog });
    const { count, labels } = await readSelectedControls();
    expect(count).toBe(2);
    expect(labels).toContain("PM-1");
    expect(labels).toContain("PM-1(1)");
  });
});
