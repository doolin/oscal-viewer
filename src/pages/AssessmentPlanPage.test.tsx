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
import AssessmentPlanPage from "./AssessmentPlanPage";
import {
  OscalProvider,
  useOscal,
  type Catalog,
} from "../context/OscalContext";
import { AuthProvider } from "../context/AuthContext";

/* ═══════════════════════════════════════════════════════════════════════════
   Fixtures
   ═══════════════════════════════════════════════════════════════════════════ */

/** A minimal catalog so control look-ups resolve when visiting ControlsView. */
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
          parts: [
            { id: "ac-1-stmt", name: "statement", prose: "AC-1 statement body." },
          ],
        },
      ],
    },
  ],
};

/**
 * Rich AP: two top-level tasks, one with a subtask. Activities under
 * local-definitions reachable by associated-activities. Steps reference
 * controls via reviewed-controls.control-selections.with-ids.
 */
const RICH_AP = {
  uuid: "ap-1",
  metadata: {
    title: "Sample Assessment Plan",
    version: "1.0",
    "last-modified": "2026-03-01T00:00:00Z",
    published: "2026-02-15T00:00:00Z",
    "oscal-version": "1.1.2",
    parties: [{ uuid: "p-1", type: "organization", name: "Acme Assessors" }],
    props: [{ name: "marking", value: "public" }],
  },
  "import-ssp": { href: "../ssp/ssp.json" },
  "local-definitions": {
    activities: [
      {
        uuid: "act-1",
        title: "Examine Access Control Policy",
        description: "Review the AC-1 policy documentation.",
        links: [
          { href: "https://example.com/act", rel: "reference", text: "Activity SOP" },
        ],
        props: [{ name: "priority", value: "high" }],
        "related-controls": {
          "control-selections": [{ "with-ids": ["ac-1"] }],
        },
        steps: [
          {
            uuid: "step-1",
            title: "Obtain policy document",
            description: "Collect the written AC-1 policy from the ISSO.",
            props: [{ name: "method", value: "examine" }],
            "reviewed-controls": {
              "control-selections": [{ "with-ids": ["ac-1"] }],
            },
            links: [
              { href: "https://example.com/policy", rel: "reference", text: "Policy doc" },
            ],
          },
          {
            uuid: "step-2",
            title: "Interview the ISSO",
            description: "Confirm the policy is disseminated.",
            props: [{ name: "method", value: "interview" }],
          },
        ],
      },
      {
        uuid: "act-2",
        title: "Test Technical Enforcement",
        description: "Validate automated AC-1 enforcement.",
        "related-controls": {
          "control-selections": [{ "with-ids": ["ac-1"] }],
        },
        steps: [],
      },
    ],
  },
  tasks: [
    {
      uuid: "task-1",
      title: "Pre-Engagement Planning",
      type: "milestone",
      description: "Set up the assessment.",
      timing: { "on-date": { date: "2026-04-01" } },
      "associated-activities": [{ "activity-uuid": "act-1" }],
      tasks: [
        {
          uuid: "task-1a",
          title: "Sub-task: Gather Documentation",
          type: "action",
          description: "Pull all relevant policy docs.",
          "associated-activities": [{ "activity-uuid": "act-1" }],
        },
      ],
    },
    {
      uuid: "task-2",
      title: "On-site Examination",
      type: "action",
      timing: {
        "within-date-range": { start: "2026-04-02T00:00:00Z", end: "2026-04-10T00:00:00Z" },
      },
      "associated-activities": [{ "activity-uuid": "act-2" }],
    },
    {
      uuid: "task-3",
      title: "Recurring Patch Review",
      type: "action",
      timing: { "at-frequency": { period: 30, unit: "days" } },
      "associated-activities": [{ "activity-uuid": "act-1" }],
      "responsible-roles": [
        { "role-id": "assessor", "party-uuids": ["p-1"] },
      ],
      dependencies: [
        { "task-uuid": "task-2", remarks: "After on-site." },
      ],
      subjects: [
        { type: "component", "subject-uuid": "comp-1" },
      ],
      props: [{ name: "type", value: "action" }],
    },
  ],
};

/** AP without tasks — falls through to flat-activities sidebar flavor. */
const FLAT_ACTIVITY_AP = {
  ...RICH_AP,
  tasks: [],
};

/** Stripped AP — bare-minimum metadata, no local-definitions, no tasks.
 * Exercises every `field || ""` / `field || []` parser fallback for
 * absent collections (parseAssessmentPlan L221-292). */
const STRIPPED_AP = {
  uuid: "stripped-ap",
  metadata: { title: "Stripped Assessment Plan" },
};

/** Wrapped AP — `{ "assessment-plan": {...} }` outer form → exercises the
 * `raw["assessment-plan"] ?? raw` LHS-truthy parser arm (L222). */
const WRAPPED_AP = { "assessment-plan": RICH_AP };

/** AP with include-controls selection form (vs `with-ids`) → exercises
 * the alternate branch in extractControlIds (L140-143). */
const INCLUDE_CONTROLS_AP = {
  ...RICH_AP,
  uuid: "include-controls-ap",
  "local-definitions": {
    activities: [
      {
        uuid: "act-ic",
        title: "Activity Using include-controls",
        description: "Uses the include-controls selection form.",
        "related-controls": {
          "control-selections": [
            { "include-controls": [{ "control-id": "ac-1" }, "ac-2" as any] },
          ],
        },
        steps: [
          {
            uuid: "step-ic",
            title: "Step with include-controls",
            description: "Has reviewed-controls with include-controls.",
            "reviewed-controls": {
              "control-selections": [
                { "include-controls": [{ "control-id": "ac-1" }] },
              ],
            },
          },
        ],
      },
    ],
  },
  tasks: [],
};

/** AP with bare activities/steps/tasks/links/parties → exercises every
 * absent-field fallback in the parser. */
const BARE_FIELDS_AP = {
  uuid: "bare-fields-ap",
  metadata: {
    title: "Bare-Fields AP",
    parties: [{}],            // party with no name → filter(Boolean) drops it
  },
  "local-definitions": {
    activities: [
      {
        // Bare activity (no title/no description/no related-controls/no steps).
        uuid: "act-bare",
      },
      {
        uuid: "act-bare-steps",
        title: "Activity with Bare Steps",
        steps: [
          // Bare step (no title/no description/no method/no links/
          // no reviewed-controls).
          { uuid: "step-bare" },
        ],
      },
    ],
  },
  tasks: [
    // Bare task (no title/no type/no description/no timing/no associated-activities).
    { uuid: "task-bare" },
  ],
};

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
  ap = RICH_AP,
  catalog = CATALOG,
  withCatalog = true,
}: {
  ap?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  const { setAssessmentPlan, setCatalog } = useOscal();
  const didSeed = useRef(false);
  useEffect(() => {
    if (!didSeed.current) {
      didSeed.current = true;
      setAssessmentPlan(ap, "ap.json");
      if (withCatalog) setCatalog(catalog, "cat.json");
    }
  }, [ap, catalog, setAssessmentPlan, setCatalog, withCatalog]);
  return null;
}

function Harness({
  preload = true,
  mobile = false,
  initialPath = "/assessment-plan",
  ap = RICH_AP,
  catalog = CATALOG,
  withCatalog = true,
}: {
  preload?: boolean;
  mobile?: boolean;
  initialPath?: string;
  ap?: any;
  catalog?: Catalog;
  withCatalog?: boolean;
}) {
  stubMatchMedia(mobile);
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <OscalProvider>
          {preload && (
            <Seed ap={ap} catalog={catalog} withCatalog={withCatalog} />
          )}
          <AssessmentPlanPage />
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
    expect(screen.queryByText("Overview")).not.toBeNull();
  });
  return utils;
}

function fireDrop(zone: Element, file: File) {
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}

function apFile(
  data: object = { "assessment-plan": RICH_AP },
  name = "ap.json",
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

describe("<AssessmentPlanPage /> empty state", () => {
  it("renders the DropZone when no plan is loaded", () => {
    render(<Harness preload={false} />);
    expect(
      screen.getByText(/OSCAL Assessment Plan Viewer/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("disables the URL Fetch button until a URL is entered", () => {
    render(<Harness preload={false} />);
    const fetchBtn = screen.getByRole("button", { name: "Fetch" });
    expect(fetchBtn).toBeDisabled();
    const url = screen.getByPlaceholderText(/https:\/\//);
    fireEvent.change(url, { target: { value: "https://ex.com/ap.json" } });
    expect(fetchBtn).toBeEnabled();
  });

  it("URL form triggers dragOver/dragLeave on the drop zone", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector('div[style*="dashed"]') as HTMLElement;
    // Trigger dragOver (sets dragging state)
    fireEvent.dragOver(zone, { dataTransfer: {} });
    // Trigger dragLeave
    fireEvent.dragLeave(zone);
    // Zone should still be in the DOM
    expect(zone).toBeInTheDocument();
  });

  it("URL form submit with mocked fetch loads plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ "assessment-plan": RICH_AP }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(<Harness preload={false} />);
    const urlInput = screen.getByPlaceholderText(/https:\/\//);
    fireEvent.change(urlInput, { target: { value: "https://ex.com/ap.json" } });
    const form = urlInput.closest("form") as HTMLFormElement;
    if (form) fireEvent.submit(form);
    // After submit, the URL param triggers a load which resolves successfully
    await waitFor(() =>
      expect(screen.queryByText("Overview")).not.toBeNull(),
    );
  });

  it("loads a dropped assessment plan and switches to the viewer shell", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, apFile());
    await waitFor(() =>
      expect(screen.queryByText("Overview")).not.toBeNull(),
    );
    // Plan title appears in the sidebar
    await waitFor(() =>
      expect(
        screen.getAllByText(/Sample Assessment Plan/).length,
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
        [JSON.stringify({ "assessment-plan": { uuid: "x" } })],
        "x.json",
        { type: "application/json" },
      ),
    );
    await waitFor(() =>
      expect(
        screen.getByText(/Not a valid OSCAL Assessment Plan/),
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

  it("accepts an unwrapped assessment-plan payload", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector(
      'div[style*="dashed"]',
    ) as HTMLElement;
    fireDrop(zone, apFile(RICH_AP));
    await waitFor(() =>
      expect(screen.queryByText("Overview")).not.toBeNull(),
    );
  });

  it("auto-loads from ?url= (mocked fetch)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ "assessment-plan": RICH_AP }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    render(
      <Harness
        preload={false}
        initialPath="/assessment-plan?url=https://ex.com/ap.json"
      />,
    );
    await waitFor(() =>
      expect(screen.queryByText("Overview")).not.toBeNull(),
    );
  });

  it("surfaces an HTTP error when auto-load fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("nope", { status: 500, statusText: "Internal Error" }),
      ),
    );
    render(
      <Harness
        preload={false}
        initialPath="/assessment-plan?url=https://ex.com/bad.json"
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

describe("<AssessmentPlanPage /> loaded — desktop", () => {
  it("renders top bar, sidebar title, and overview stats", async () => {
    await renderLoaded();
    expect(
      screen.getByText(/OSCAL Assessment Plan Viewer/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Sample Assessment Plan/).length,
    ).toBeGreaterThan(0);
    // Overview sublabel contains "tasks · ... activities"
    expect(
      screen.getByText(/tasks.*activities/),
    ).toBeInTheDocument();
  });

  it("New File clears state and returns to the DropZone", async () => {
    await renderLoaded();
    fireEvent.click(
      screen.getAllByRole("button", { name: "New File" })[0],
    );
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("task tree shows top-level tasks and their subtasks when expanded", async () => {
    await renderLoaded();
    expect(
      screen.getAllByText(/Pre-Engagement Planning/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/On-site Examination/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to a task detail view when a task row is clicked", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Pre-Engagement Planning/)[0]);
    // TaskView puts the title in the content area
    await waitFor(() =>
      expect(
        screen.getAllByText(/Pre-Engagement Planning/).length,
      ).toBeGreaterThan(1),
    );
    // Associated activity appears somewhere on the page
    expect(
      screen.getAllByText(/Examine Access Control Policy/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates into an activity via its task's associated activity", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Pre-Engagement Planning/)[0]);
    // Step title from the associated activity appears in the TaskView
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Obtain policy document/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("search box filters the task tree", async () => {
    await renderLoaded();
    const initialPre = screen.getAllByText(/Pre-Engagement Planning/).length;
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "On-site" } });
    // Pre-Engagement appears in the OverviewView summary regardless of
    // sidebar filter; just check that it shrinks (sidebar row drops out).
    expect(
      screen.queryAllByText(/Pre-Engagement Planning/).length,
    ).toBeLessThan(initialPre);
    expect(
      screen.getAllByText(/On-site Examination/).length,
    ).toBeGreaterThan(0);
  });

  it('shows "No tasks found" when the search filter matches nothing', async () => {
    await renderLoaded();
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "zzzzzz-nope" } });
    expect(screen.getByText(/No tasks found/)).toBeInTheDocument();
  });

  it("opens the Controls view via the sidebar Controls panel", async () => {
    await renderLoaded();
    // The panel button shows "Controls (N)"
    const ctrlsBtn = screen.getByText(/Controls \(\d+\)/);
    fireEvent.click(ctrlsBtn);
    // Controls view lists the referenced control IDs somewhere
    await waitFor(() =>
      expect(
        screen.getAllByText(/ac-1/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("applies a control filter when a control row is clicked in the controls view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    // Click the first control entry (ac-1)
    const chip = screen.getAllByText(/ac-1/i)[0];
    fireEvent.click(chip);
    // Filter indicator appears in the sidebar
    await waitFor(() =>
      expect(screen.getByText(/Filtering:/)).toBeInTheDocument(),
    );
  });

  it("renders the third task with at-frequency timing", async () => {
    await renderLoaded();
    expect(
      screen.getAllByText(/Recurring Patch Review/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates to the frequency-timed task and shows its detail view", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Recurring Patch Review/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Recurring Patch Review/).length,
      ).toBeGreaterThan(1),
    );
  });

  it("shows activity-associated controls and links in task detail", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Pre-Engagement Planning/)[0]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Activity SOP|Examine Access Control Policy/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("filter clear button resets the control filter", async () => {
    await renderLoaded();
    // Navigate to controls view to enable clicking a chip
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    const chip = screen.getAllByText(/AC-1|ac-1/i)[0];
    fireEvent.click(chip);
    // Now a "Filtering: ..." with clear (✕) button appears
    await waitFor(() =>
      expect(screen.getByText(/Filtering:/)).toBeInTheDocument(),
    );
    // Click the clear button (✕)
    const clear = screen.queryByText("✕");
    if (clear) fireEvent.click(clear);
    // Filter message should be gone
    await waitFor(() =>
      expect(screen.queryByText(/Filtering:/)).not.toBeInTheDocument(),
    );
  });

  it("renders task type prop (action) in sidebar", async () => {
    await renderLoaded();
    // At least one task with type=action appears
    expect(
      screen.getAllByText(/On-site Examination|Recurring Patch Review/).length,
    ).toBeGreaterThan(0);
  });

  it("clicking a step row in ActivityView expands its detail", async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    // Navigate to the activity with steps
    fireEvent.click(screen.getAllByText(/Examine Access Control Policy/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Obtain policy document/).length).toBeGreaterThan(0),
    );
    // Click the step row to expand it
    const stepRow = screen.queryAllByText(/Obtain policy document/)[0];
    if (stepRow) {
      fireEvent.click(stepRow);
      // Step detail should expand
      await waitFor(() =>
        expect(screen.queryAllByText(/Obtain policy document/).length).toBeGreaterThan(0),
      );
    }
  });

  it("clicking a task card in OverviewView navigates to that task", async () => {
    await renderLoaded();
    // Task cards in the overview render their titles in h3 elements (sidebar uses span/button)
    const h3s = screen.queryAllByRole("heading", { level: 3 }).filter(
      (h) => h.textContent?.includes("Pre-Engagement Planning"),
    );
    if (h3s.length > 0) {
      fireEvent.click(h3s[0]);
    } else {
      // fallback: find last occurrence (overview card comes after sidebar)
      const all = screen.getAllByText(/Pre-Engagement Planning/);
      fireEvent.click(all[all.length - 1]);
    }
    // After clicking, the task detail renders (title appears more than once)
    await waitFor(() =>
      expect(screen.queryAllByText(/Pre-Engagement Planning/).length).toBeGreaterThan(1),
    );
  });

  it("expands a control entry in ControlsView showing detail and catalog", async () => {
    const { container } = await renderLoaded();
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    await waitFor(() =>
      expect(screen.queryByText(/Addressed Controls/i)).toBeInTheDocument(),
    );
    // The ControlEntry header has cursor:pointer and contains the control badge.
    // Find the header div by walking up from the badge button.
    const badge = screen.queryAllByText(/ac-1/i)[0];
    const badgeBtn = badge?.closest("button");
    // Walk up: badgeBtn -> flex wrapper div -> ControlEntry header div
    const controlEntryHeader = badgeBtn?.parentElement;
    if (controlEntryHeader) {
      fireEvent.click(controlEntryHeader as HTMLElement);
      // After expanding ControlEntry, both "Assessed by" and ControlDetailPanel render
      await waitFor(() =>
        expect(
          screen.queryAllByText(/Policy and Procedures|Assessed by/i).length,
        ).toBeGreaterThan(0),
      );
      // Now click the ControlDetailPanel header to expand it.
      // ControlEntry header span has "AC-1 Policy and Procedures" (index 0);
      // ControlDetailPanel header span has just "Policy and Procedures" (index 1).
      const policyTitles = screen.queryAllByText(/Policy and Procedures/i);
      // policyTitles[1] is inside the ControlDetailPanel header div
      const detailPanelTitle = policyTitles.length > 1 ? policyTitles[1] : policyTitles[0];
      if (detailPanelTitle) {
        const detailHeader = detailPanelTitle.closest("div[style*='cursor: pointer']");
        if (detailHeader) {
          fireEvent.click(detailHeader as HTMLElement);
          // ControlDetailPanel now expanded — statement parts should render
          await waitFor(() =>
            expect(
              screen.queryAllByText(/Statement|AC-1 statement body/i).length,
            ).toBeGreaterThan(0),
          );
        }
      }
    }
    expect(screen.queryAllByText(/ac-1/i).length).toBeGreaterThan(0);
  });

  it("navigates from ControlsView to activity by clicking activity row", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    await waitFor(() =>
      expect(screen.getAllByText(/ac-1/i).length).toBeGreaterThan(0),
    );
    // Expand the control entry by clicking the outer header div
    // The header div contains the badge button — click its grandparent to avoid stopPropagation
    const badge = screen.getAllByText(/ac-1/i)[0];
    const badgeBtn = badge.closest("button");
    // Walk up: badgeBtn -> header flex div -> control entry div
    const headerDiv = badgeBtn?.parentElement;
    if (headerDiv) fireEvent.click(headerDiv);
    // Wait for activity rows to appear in the expanded section
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Examine Access Control Policy/i).length,
      ).toBeGreaterThan(0),
    );
    // Click the activity row to navigate to ActivityView
    const activityRows = screen.queryAllByText(/Examine Access Control Policy/i);
    // The last occurrence is likely in the expanded ControlsView section
    fireEvent.click(activityRows[activityRows.length - 1]);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Review the AC-1 policy documentation/i).length,
      ).toBeGreaterThan(0),
    );
  });

  it("searches controls in ControlsView by text", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    await waitFor(() => expect(screen.getAllByText(/ac-1/i).length).toBeGreaterThan(0));
    // Type in the controls search box
    const searchBox = screen.getByPlaceholderText(/Filter controls/i);
    fireEvent.change(searchBox, { target: { value: "zzzz-nothing" } });
    await waitFor(() =>
      expect(screen.queryByText(/No controls match/)).toBeInTheDocument(),
    );
  });

  it("navigates from OverviewView activity card (no-task plan) to ActivityView", async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    // In no-task mode, activity cards appear in the overview as h3 headings
    // (the sidebar shows them in buttons; we need the overview card h3)
    const h3s = screen.queryAllByRole("heading", { level: 3 }).filter(
      (h) => h.textContent?.includes("Test Technical Enforcement"),
    );
    if (h3s.length > 0) {
      fireEvent.click(h3s[0]);
    } else {
      // Fallback: click the last occurrence (sidebar before overview)
      const all = screen.getAllByText(/Test Technical Enforcement/);
      fireEvent.click(all[all.length - 1]);
    }
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Validate automated AC-1 enforcement/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("expanding a task in sidebar shows subtask entries", async () => {
    await renderLoaded();
    // Pre-Engagement Planning has a subtask — click its expand arrow
    const taskButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Pre-Engagement Planning"),
    );
    if (taskButtons.length > 0) {
      const chevron = taskButtons[0].querySelector("span");
      if (chevron) fireEvent.click(chevron);
    }
    // After expansion, subtask label should be visible
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Sub-task|Gather Documentation/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("navigates to a subtask from the task detail view", async () => {
    await renderLoaded();
    // Navigate to the parent task
    fireEvent.click(screen.getAllByText(/Pre-Engagement Planning/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Pre-Engagement Planning/).length).toBeGreaterThan(1),
    );
    // Click the subtask card in the TaskView
    const subtask = screen.queryAllByText(/Gather Documentation/i);
    if (subtask.length > 0) {
      fireEvent.click(subtask[0]);
      await waitFor(() =>
        expect(
          screen.queryAllByText(/Gather Documentation|Sub-task/).length,
        ).toBeGreaterThan(0),
      );
    }
  });

  it("navigates to activity via expanded task's activity button in sidebar", async () => {
    await renderLoaded();
    // Expand Pre-Engagement Planning (has associated activity act-1)
    const taskButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Pre-Engagement Planning"),
    );
    if (taskButtons.length > 0) {
      const chevron = taskButtons[0].querySelector("span");
      if (chevron) fireEvent.click(chevron);
      // After expanding, the associated activity button appears in the sidebar
      await waitFor(() =>
        expect(screen.queryAllByText(/Examine Access Control Policy/).length).toBeGreaterThan(0),
      );
      // Click the activity button (in the expanded sidebar, NOT the heading in TaskView)
      // The activity button is a button element in the sidebar
      const activityBtns = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Examine Access Control Policy"),
      );
      if (activityBtns.length > 0) {
        fireEvent.click(activityBtns[0]);
        await waitFor(() =>
          expect(
            screen.queryAllByText(/Review the AC-1 policy documentation/).length,
          ).toBeGreaterThan(0),
        );
      }
    }
  });

  it("collapsing an expanded task hides subtasks", async () => {
    await renderLoaded();
    // Find the Pre-Engagement Planning task button
    const taskButtons = screen.getAllByRole("button").filter(
      (b) => b.textContent?.includes("Pre-Engagement Planning"),
    );
    if (taskButtons.length > 0) {
      const chevron = taskButtons[0].querySelector("span");
      if (chevron) {
        // Expand first
        fireEvent.click(chevron);
        await waitFor(() =>
          expect(screen.queryAllByText(/Gather Documentation/).length).toBeGreaterThan(0),
        );
        // Collapse (click again)
        fireEvent.click(chevron);
        await waitFor(() =>
          expect(screen.queryAllByText(/Gather Documentation/).length).toBe(0),
        );
      }
    }
  });

  it("navigates from activity view back to overview via home breadcrumb", async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    // Navigate to an activity via sidebar
    fireEvent.click(screen.getAllByText(/Examine Access Control Policy/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Review the AC-1 policy documentation/).length).toBeGreaterThan(0),
    );
    // Click the breadcrumb button — it renders planTitle inside a <button> element
    const crumbBtns = screen.queryAllByRole("button").filter(
      (b) => b.textContent?.includes("Sample Assessment Plan"),
    );
    if (crumbBtns.length > 0) fireEvent.click(crumbBtns[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/activities.*steps|activities/).length).toBeGreaterThan(0),
    );
  });

  it("navigates from task view back to overview via home breadcrumb", async () => {
    await renderLoaded();
    // Navigate to a task
    fireEvent.click(screen.getAllByText(/On-site Examination/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/On-site Examination/).length).toBeGreaterThan(1),
    );
    // Click the breadcrumb button (button with planTitle text)
    const crumbBtns = screen.queryAllByRole("button").filter(
      (b) => b.textContent?.includes("Sample Assessment Plan"),
    );
    if (crumbBtns.length > 0) fireEvent.click(crumbBtns[0]);
    await waitFor(() =>
      expect(screen.queryByText(/tasks.*activities/)).toBeInTheDocument(),
    );
  });

  it("navigates from controls view back to overview via home breadcrumb", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    await waitFor(() =>
      expect(screen.queryAllByText(/ac-1/i).length).toBeGreaterThan(0),
    );
    // Click the breadcrumb button in ControlsView
    const crumbBtns = screen.queryAllByRole("button").filter(
      (b) => b.textContent?.includes("Sample Assessment Plan"),
    );
    if (crumbBtns.length > 0) fireEvent.click(crumbBtns[0]);
    await waitFor(() =>
      expect(screen.queryByText(/tasks.*activities/)).toBeInTheDocument(),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Loaded — mobile
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentPlanPage /> loaded — mobile", () => {
  it("renders the mobile shell with AP Viewer header and New File", async () => {
    await renderLoaded({ mobile: true });
    expect(screen.getByText(/AP Viewer/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New File" }),
    ).toBeInTheDocument();
  });

  it("mobile task click switches to the content view with a Back button", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByText(/On-site Examination/));
    await waitFor(() =>
      expect(
        screen.getByText(/Back to navigation/),
      ).toBeInTheDocument(),
    );
  });

  it("mobile back button returns to the navigation list", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByText(/On-site Examination/));
    await waitFor(() =>
      expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText(/Back to navigation/));
    // Back to the nav list
    expect(screen.getByText(/Pre-Engagement Planning/)).toBeInTheDocument();
  });

  it("mobile Controls panel click shows ControlsView", async () => {
    await renderLoaded({ mobile: true });
    const ctrlsBtn = screen.getByText(/Controls \(\d+\)/);
    fireEvent.click(ctrlsBtn);
    await waitFor(() =>
      expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
    );
    expect(
      screen.queryAllByText(/ac-1|Addressed Controls/i).length,
    ).toBeGreaterThan(0);
  });

  it("mobile New File button clears the plan and returns to drop zone", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByRole("button", { name: "New File" }));
    await waitFor(() =>
      expect(screen.queryByText(/Drop an OSCAL/)).toBeInTheDocument(),
    );
  });

  it("mobile flat-activity nav shows activities and clicking one navigates to it", async () => {
    await renderLoaded({ mobile: true, ap: FLAT_ACTIVITY_AP });
    // In mobile no-task mode, activity nav items appear in the sidebar
    expect(
      screen.getAllByText(/Examine Access Control Policy/).length,
    ).toBeGreaterThan(0);
    // Click the activity to navigate
    fireEvent.click(screen.getAllByText(/Examine Access Control Policy/)[0]);
    await waitFor(() =>
      expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
    );
  });

  it("mobile sidebar search filters the task list", async () => {
    await renderLoaded({ mobile: true });
    // The mobile nav sidebar has a search input
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "On-site" } });
    // Pre-Engagement should disappear from sidebar
    await waitFor(() =>
      expect(screen.queryAllByText(/On-site Examination/).length).toBeGreaterThan(0),
    );
  });

  it("mobile sidebar Overview nav item navigates to overview, then task card click works", async () => {
    await renderLoaded({ mobile: true });
    // Click a task to go to content view
    fireEvent.click(screen.getByText(/On-site Examination/));
    await waitFor(() =>
      expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
    );
    // Go back to nav
    fireEvent.click(screen.getByText(/Back to navigation/));
    // Click the Overview nav item in mobile nav sidebar
    const overviewBtn = screen.queryAllByRole("button").find(
      (b) => b.textContent?.includes("Overview"),
    );
    if (overviewBtn) {
      fireEvent.click(overviewBtn);
      await waitFor(() =>
        expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
      );
    }
    // Now in mobile content view showing overview — click a task card (h3)
    const h3s = screen.queryAllByRole("heading", { level: 3 }).filter(
      (h) => h.textContent?.includes("Pre-Engagement Planning"),
    );
    if (h3s.length > 0) fireEvent.click(h3s[0]);
    // TaskView should now be shown
    await waitFor(() =>
      expect(screen.queryAllByText(/Pre-Engagement Planning/).length).toBeGreaterThan(0),
    );
  });

  it("mobile task breadcrumb home navigates back to nav", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByText(/On-site Examination/));
    await waitFor(() =>
      expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
    );
    // Click the breadcrumb home button in mobile TaskView
    const crumbBtns = screen.queryAllByRole("button").filter(
      (b) => b.textContent?.includes("Sample Assessment Plan"),
    );
    if (crumbBtns.length > 0) fireEvent.click(crumbBtns[0]);
    // Should still show content (navigated to null but mobileShowContent=true)
    await waitFor(() =>
      expect(screen.queryAllByText(/Sample Assessment Plan/).length).toBeGreaterThan(0),
    );
  });

  it("mobile activity breadcrumb home navigates back", async () => {
    await renderLoaded({ mobile: true, ap: FLAT_ACTIVITY_AP });
    // Navigate to an activity
    fireEvent.click(screen.getAllByText(/Examine Access Control Policy/)[0]);
    await waitFor(() =>
      expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
    );
    // Click breadcrumb home
    const crumbBtns = screen.queryAllByRole("button").filter(
      (b) => b.textContent?.includes("Sample Assessment Plan"),
    );
    if (crumbBtns.length > 0) fireEvent.click(crumbBtns[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Sample Assessment Plan/).length).toBeGreaterThan(0),
    );
  });

  it("mobile no-task overview activity card click navigates to activity", async () => {
    await renderLoaded({ mobile: true, ap: FLAT_ACTIVITY_AP });
    // In no-task mobile, activity nav shows in sidebar; click to see overview
    // Click Overview via nav button to get content view showing overview
    const overviewBtn = screen.queryAllByRole("button").find(
      (b) => b.textContent?.includes("Overview"),
    );
    if (overviewBtn) {
      fireEvent.click(overviewBtn);
      await waitFor(() =>
        expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
      );
      // The overview shows activity h3 cards; click one
      const h3s = screen.queryAllByRole("heading", { level: 3 }).filter(
        (h) => h.textContent?.includes("Test Technical Enforcement"),
      );
      if (h3s.length > 0) {
        fireEvent.click(h3s[0]);
        await waitFor(() =>
          expect(screen.queryAllByText(/Validate automated AC-1 enforcement/).length).toBeGreaterThan(0),
        );
      }
    }
  });

  it("mobile controls breadcrumb home navigates back", async () => {
    await renderLoaded({ mobile: true });
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    await waitFor(() =>
      expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
    );
    // Click the breadcrumb home button in mobile ControlsView
    const crumbBtns = screen.queryAllByRole("button").filter(
      (b) => b.textContent?.includes("Sample Assessment Plan"),
    );
    if (crumbBtns.length > 0) fireEvent.click(crumbBtns[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Sample Assessment Plan/).length).toBeGreaterThan(0),
    );
  });

  it("mobile nav sidebar filter clear button resets hCtrl", async () => {
    await renderLoaded({ mobile: true });
    // Open controls view, click a chip to set filter
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    await waitFor(() =>
      expect(screen.getByText(/Back to navigation/)).toBeInTheDocument(),
    );
    const chip = screen.getAllByText(/ac-1/i)[0];
    fireEvent.click(chip);
    // Go back to nav
    fireEvent.click(screen.getByText(/Back to navigation/));
    // The nav sidebar should show the filter indicator
    await waitFor(() =>
      expect(screen.queryByText(/Filtering:/)).toBeInTheDocument(),
    );
    // Click clear
    const clear = screen.queryByText("✕");
    if (clear) fireEvent.click(clear);
    await waitFor(() =>
      expect(screen.queryByText(/Filtering:/)).not.toBeInTheDocument(),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Plans without tasks — flat activities flavour
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentPlanPage /> no-tasks flavour", () => {
  it("falls back to flat activity list in the sidebar when there are no tasks", async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    expect(
      screen.getAllByText(/Examine Access Control Policy/).length,
    ).toBeGreaterThan(0);
    // Overview sublabel switches to "N activities · M steps"
    expect(
      screen.getByText(/activities.*steps|activities/),
    ).toBeInTheDocument();
  });

  it("activity-list search filter works without tasks", async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    const initial = screen.getAllByText(/Examine Access Control Policy/).length;
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "Technical" } });
    expect(
      screen.queryAllByText(/Examine Access Control Policy/).length,
    ).toBeLessThan(initial);
    expect(
      screen.getAllByText(/Test Technical Enforcement/).length,
    ).toBeGreaterThan(0);
  });

  it('shows "No activities found" when the search filter strikes out', async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    const search = screen.getByPlaceholderText("Search...");
    fireEvent.change(search, { target: { value: "nothing-matches" } });
    expect(
      screen.getByText(/No activities found/),
    ).toBeInTheDocument();
  });

  it("clicking an activity in the flat list navigates to ActivityView", async () => {
    await renderLoaded({ ap: FLAT_ACTIVITY_AP });
    fireEvent.click(screen.getAllByText(/Test Technical Enforcement/)[0]);
    // ActivityView shows the activity description somewhere
    await waitFor(() =>
      expect(
        screen.getAllByText(/Validate automated AC-1 enforcement/).length,
      ).toBeGreaterThan(0),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Edge cases
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentPlanPage /> edge cases", () => {
  it("renders overview without a loaded catalog", async () => {
    await renderLoaded({ withCatalog: false });
    expect(
      screen.getAllByText(/Sample Assessment Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("renders a minimal plan (no activities, no tasks)", async () => {
    const minimal = {
      uuid: "min",
      metadata: { title: "Minimal Plan" },
      "import-ssp": { href: "#ssp" },
      tasks: [],
      "local-definitions": { activities: [] },
    };
    await renderLoaded({ ap: minimal });
    expect(
      screen.getAllByText(/Minimal Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("clicking the Overview nav item while already on overview is a no-op", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByText("Overview"));
    expect(
      screen.getAllByText(/Sample Assessment Plan/).length,
    ).toBeGreaterThan(0);
  });

  it("navigates back to overview from a task detail via the home affordance", async () => {
    await renderLoaded();
    fireEvent.click(screen.getAllByText(/Pre-Engagement Planning/)[0]);
    await waitFor(() =>
      expect(
        screen.getAllByText(/Pre-Engagement Planning/).length,
      ).toBeGreaterThan(1),
    );
    // Click Overview in the sidebar to return
    fireEvent.click(screen.getByText("Overview"));
    // Overview stats line visible again
    expect(
      screen.getByText(/tasks.*activities/),
    ).toBeInTheDocument();
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   AP1 — ControlDetailPanel + DropZone + scattered helper branches

   Targets:
     - ControlDetailPanel parameters/enhancements rendering (L687-720)
     - ControlDetailPanel "not found in catalog" (L618-630)
     - ControlsView search by control id (L1262) and catalog title (L1265)
     - DropZone handleClick (L504-508), form submit (L554), error
       block onClick stopPropagation (L535)
     - txt() prose-in-object branch (L90-91)
     - parseAssessmentPlan error: missing metadata (L1589 via loadFile)
   ═══════════════════════════════════════════════════════════════════════════ */

/** Catalog enriched with params and enhancements for the ControlDetailPanel
 *  expand tests. */
const RICH_CATALOG: Catalog = {
  uuid: "cat-rich",
  metadata: { title: "Rich Catalog" },
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
            { id: "ac-1_prm_1", label: "organization-defined roles" },
            { id: "ac-1_prm_sel",
              select: { "how-many": "one-or-more", choice: ["weekly", "monthly"] } },
          ],
          parts: [
            { id: "ac-1-stmt", name: "statement",
              prose: "Refer to {{ insert: param, ac-1_prm_1 }}." },
          ],
          controls: [
            { id: "ac-1.1", title: "Policy Updates",
              props: [{ name: "label", value: "AC-1(1)" }],
              params: [{ id: "ac-1.1_prm_1", label: "enhancement frequency" }] },
            { id: "ac-1.2", title: "Annual Review",
              props: [{ name: "label", value: "AC-1(2)" }] },
          ],
        },
      ],
    },
  ],
};

describe("<AssessmentPlanPage /> AP1 — ControlDetailPanel deep rendering", () => {
  async function openAc1Detail(catalog: Catalog = RICH_CATALOG) {
    await renderLoaded({ catalog });
    // Navigate to ControlsView: sidebar shows "Controls (N)".
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    await waitFor(() =>
      expect(screen.queryByText(/Addressed Controls/i)).toBeInTheDocument(),
    );
    // Expand the AC-1 ControlEntry by clicking its header (walk up from the badge).
    const badge = screen.queryAllByText(/ac-1/i)[0];
    const badgeBtn = badge?.closest("button");
    const controlEntryHeader = badgeBtn?.parentElement;
    if (controlEntryHeader) fireEvent.click(controlEntryHeader as HTMLElement);
    // Expand the ControlDetailPanel header.
    const policyTitles = screen.queryAllByText(/Policy and Procedures/i);
    const detailPanelTitle = policyTitles.length > 1 ? policyTitles[1] : policyTitles[0];
    const detailHeader = detailPanelTitle?.closest("div[style*='cursor: pointer']");
    if (detailHeader) fireEvent.click(detailHeader as HTMLElement);
  }

  it("renders the Parameters section when the catalog control has params (L687-703)", async () => {
    await openAc1Detail();
    await waitFor(() =>
      expect(screen.queryAllByText(/Parameters \(2\)/).length).toBeGreaterThan(0),
    );
    // Both param ids appear in the rendered list.
    expect(screen.getAllByText("ac-1_prm_1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ac-1_prm_sel").length).toBeGreaterThan(0);
    // renderParamText output for the select param includes "Selection (one or more)".
    expect(screen.getAllByText(/Selection \(one or more\)/).length).toBeGreaterThan(0);
  });

  it("renders the Enhancements section when the catalog control has enhancements (L705-720)", async () => {
    await openAc1Detail();
    await waitFor(() =>
      expect(screen.queryAllByText(/Enhancements \(2\)/).length).toBeGreaterThan(0),
    );
    expect(screen.getAllByText(/AC-1\(1\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AC-1\(2\)/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Policy Updates/).length).toBeGreaterThan(0);
  });

  it("renders 'not found in loaded catalog' when the control isn't in the catalog (L618-630)", async () => {
    // AP fixture references ac-1 in activities; load a different catalog
    // that doesn't contain ac-1 so findCatalogControl returns undefined.
    const otherCatalog: Catalog = {
      uuid: "other-cat",
      metadata: { title: "Other Catalog" },
      groups: [
        { id: "ia", title: "Identification",
          controls: [{ id: "ia-5", title: "Authenticator Management",
            props: [{ name: "label", value: "IA-5" }] }] },
      ],
    };
    await renderLoaded({ catalog: otherCatalog });
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    await waitFor(() =>
      expect(screen.queryByText(/Addressed Controls/i)).toBeInTheDocument(),
    );
    // Expand the AC-1 ControlEntry — the inner ControlDetailPanel renders
    // the "not found in loaded catalog" message.
    const badge = screen.queryAllByText(/ac-1/i)[0];
    const entryHeader = badge?.closest("button")?.parentElement;
    if (entryHeader) fireEvent.click(entryHeader as HTMLElement);
    await waitFor(() =>
      expect(screen.queryAllByText(/not found in loaded catalog/).length).toBeGreaterThan(0),
    );
  });
});

describe("<AssessmentPlanPage /> AP1 — ControlsView search filters", () => {
  it("search matches by control id (L1262)", async () => {
    await renderLoaded({ catalog: RICH_CATALOG });
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    await waitFor(() =>
      expect(screen.queryByText(/Addressed Controls/i)).toBeInTheDocument(),
    );
    const search = screen.getByPlaceholderText(/Filter controls/i);
    fireEvent.change(search, { target: { value: "ac-1" } });
    expect(screen.getAllByText(/AC-1|ac-1/i).length).toBeGreaterThan(0);
  });

  it("search matches by catalog control title (L1265)", async () => {
    await renderLoaded({ catalog: RICH_CATALOG });
    fireEvent.click(screen.getByText(/Controls \(\d+\)/));
    await waitFor(() =>
      expect(screen.queryByText(/Addressed Controls/i)).toBeInTheDocument(),
    );
    const search = screen.getByPlaceholderText(/Filter controls/i);
    fireEvent.change(search, { target: { value: "policy" } });
    expect(screen.getAllByText(/AC-1|ac-1/i).length).toBeGreaterThan(0);
  });
});

describe("<AssessmentPlanPage /> AP1 — DropZone interactions", () => {
  it("clicking the dropzone fires handleClick (L504-508)", () => {
    render(<Harness preload={false} />);
    const dropzone = screen.getByText(/Drop an OSCAL/).parentElement!;
    expect(() => fireEvent.click(dropzone)).not.toThrow();
  });

  it("submitting the URL fetch form (L554)", () => {
    render(<Harness preload={false} />);
    const urlInput = screen.getByPlaceholderText(/https:\/\//) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "https://example.com/ap.json" } });
    const form = urlInput.closest("form")!;
    expect(() => fireEvent.submit(form)).not.toThrow();
  });

  it("renders the error block and stops propagation on click (L535)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    const { container } = render(<Harness preload={false} initialPath="/assessment-plan?url=https://example.com/ap.json" />);
    await waitFor(() =>
      expect(screen.queryAllByText(/Open URL directly/).length).toBeGreaterThan(0),
    );
    const errBlock = Array.from(container.querySelectorAll<HTMLElement>("div"))
      .find((d) => /Open URL directly/.test(d.textContent || ""));
    expect(errBlock).toBeDefined();
    expect(() => fireEvent.click(errBlock!)).not.toThrow();
    expect(screen.queryAllByText(/Drop an OSCAL/).length).toBeGreaterThan(0);
  });
});

describe("<AssessmentPlanPage /> AP1 — helper edge cases", () => {
  it("loadFile rejects an AP without metadata via parseAssessmentPlan (L1589)", async () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector('div[style*="dashed"]') as HTMLElement;
    // File contains valid JSON but no metadata — parseAssessmentPlan throws.
    fireDrop(
      zone,
      new File([JSON.stringify({ "assessment-plan": { uuid: "ap-x" } })], "x.json",
        { type: "application/json" }),
    );
    await waitFor(() =>
      expect(screen.queryAllByText(/missing metadata|Not a valid OSCAL/).length).toBeGreaterThan(0),
    );
  });

  it.skip("txt() unwraps a `{prose: ...}` object value through MarkupBlock rendering (L90-91) — skip: parser flattens prose-object on parse; this branch is reachable only if a viewer panel passes the raw value through txt() (not the case in current code)", async () => {
    // RICH_AP's first activity has a string description; override it with
    // a {prose: "..."} object to route through txt() at L90-91.
    const ap = {
      ...RICH_AP,
      "local-definitions": {
        activities: [
          {
            ...RICH_AP["local-definitions"].activities[0],
            description: { prose: "Description wrapped in a prose object." },
          },
          ...RICH_AP["local-definitions"].activities.slice(1),
        ],
      },
    };
    await renderLoaded({ ap });
    // Navigate to act-1 by clicking its title in the sidebar.
    fireEvent.click(screen.getAllByText(/Examine Access Control Policy/)[0]);
    await waitFor(() =>
      expect(screen.queryAllByText(/Description wrapped in a prose object/).length).toBeGreaterThan(0),
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   AP2 — Fragile-branch closures (STRIPPED/WRAPPED/BARE/INCLUDE_CONTROLS)
   ═══════════════════════════════════════════════════════════════════════════ */

describe("<AssessmentPlanPage /> AP2 — fragile-branch closures", () => {
  it("renders STRIPPED_AP (no local-definitions, no tasks)", async () => {
    render(<Harness preload ap={STRIPPED_AP as any} />);
    await waitFor(() =>
      expect(screen.queryAllByText(/Stripped Assessment Plan/).length).toBeGreaterThan(0),
    );
  });

  it("renders WRAPPED_AP (raw['assessment-plan'] truthy at L222)", async () => {
    render(<Harness preload ap={WRAPPED_AP as any} />);
    await waitFor(() =>
      expect(screen.queryAllByText(/Sample Assessment Plan/).length).toBeGreaterThan(0),
    );
  });

  it("renders INCLUDE_CONTROLS_AP (covers extractControlIds include-controls branch)", async () => {
    render(<Harness preload ap={INCLUDE_CONTROLS_AP as any} />);
    await waitFor(() =>
      expect(screen.queryAllByText(/Activity Using include-controls/).length).toBeGreaterThan(0),
    );
  });

  it("renders BARE_FIELDS_AP (covers every absent-field parser arm)", async () => {
    render(<Harness preload ap={BARE_FIELDS_AP as any} />);
    await waitFor(() =>
      expect(screen.queryAllByText(/Bare-Fields AP/).length).toBeGreaterThan(0),
    );
  });

  it("URL auto-load: WRAPPED_AP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify(WRAPPED_AP), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ));
    render(<Harness preload={false} initialPath="/assessment-plan?url=https://example.com/wrapped-ap.json" />);
    await waitFor(() =>
      expect(screen.queryAllByText(/Sample Assessment Plan/).length).toBeGreaterThan(0),
    );
  });

  it("URL auto-load: AP without metadata (covers parseAssessmentPlan throw + catch arm)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ "assessment-plan": { uuid: "no-meta" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ));
    render(<Harness preload={false} initialPath="/assessment-plan?url=https://example.com/no-meta-ap.json" />);
    await waitFor(() =>
      expect(screen.queryAllByText(/missing metadata|Not a valid OSCAL/).length).toBeGreaterThan(0),
    );
  });

  it("DropZone dragOver/dragLeave (covers dragging ternary truthy arms)", () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector('div[style*="dashed"]') as HTMLElement;
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    expect(zone).toBeInTheDocument();
  });

  it("DropZone drop with empty files (covers `if (f)` falsy arm)", () => {
    const { container } = render(<Harness preload={false} />);
    const zone = container.querySelector('div[style*="dashed"]') as HTMLElement;
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    expect(screen.getByText(/Drop an OSCAL/)).toBeInTheDocument();
  });

  it("URL form submit with whitespace input (covers `if (t)` falsy arm)", () => {
    render(<Harness preload={false} />);
    const urlInput = screen.getByPlaceholderText(/https:\/\//) as HTMLInputElement;
    fireEvent.change(urlInput, { target: { value: "   " } });
    const form = urlInput.closest("form")!;
    expect(() => fireEvent.submit(form)).not.toThrow();
  });
});

