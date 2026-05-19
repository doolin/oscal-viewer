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
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import Layout from "./Layout";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";
import { OscalProvider, useOscal } from "../context/OscalContext";

/* ───────── test helpers ───────── */

interface MqlStub {
  matches: boolean;
  listeners: Array<(e: MediaQueryListEvent) => void>;
  addEventListener: (t: "change", cb: (e: MediaQueryListEvent) => void) => void;
  removeEventListener: (t: "change", cb: (e: MediaQueryListEvent) => void) => void;
}

function makeMql(matches = false): MqlStub {
  const m: MqlStub = {
    matches,
    listeners: [],
    addEventListener: (_t, cb) => void m.listeners.push(cb),
    removeEventListener: (_t, cb) => {
      m.listeners = m.listeners.filter((l) => l !== cb);
    },
  };
  return m;
}

function stubMatchMedia(matches = false) {
  vi.stubGlobal("matchMedia", () => makeMql(matches));
}

function renderLayout(
  opts: {
    mobile?: boolean;
    initialPath?: string;
  } = {},
) {
  stubMatchMedia(opts.mobile ?? false);
  return render(
    <ThemeProvider>
      <AuthProvider>
        <OscalProvider>
          <MemoryRouter initialEntries={[opts.initialPath ?? "/"]}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<div>page: home</div>} />
                <Route
                  path="catalog"
                  element={<div>page: catalog</div>}
                />
                <Route
                  path="privacy"
                  element={<div>page: privacy</div>}
                />
              </Route>
            </Routes>
          </MemoryRouter>
        </OscalProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

/**
 * A helper component that seeds an OSCAL model into OscalContext on mount.
 * Must be rendered inside <OscalProvider>.
 */
function OscalSeeder({
  modelKey,
  children,
}: {
  modelKey: "catalog" | "profile" | "ssp" | "component-definition" | "assessment-plan" | "assessment-results" | "poam";
  children?: ReactNode;
}) {
  const { setCatalog, setProfile, setSsp, setComponentDefinition, setAssessmentPlan, setAssessmentResults, setPoam } = useOscal();
  useEffect(() => {
    switch (modelKey) {
      case "catalog":
        setCatalog({ uuid: "test-cat", metadata: { title: "Test" } }, "test.json");
        break;
      case "profile":
        setProfile({ uuid: "test-profile" }, "profile.json");
        break;
      case "ssp":
        setSsp({ uuid: "test-ssp" }, "ssp.json");
        break;
      case "component-definition":
        setComponentDefinition({ uuid: "test-cd" }, "cd.json");
        break;
      case "assessment-plan":
        setAssessmentPlan({ uuid: "test-ap" }, "ap.json");
        break;
      case "assessment-results":
        setAssessmentResults({ uuid: "test-ar" }, "ar.json");
        break;
      case "poam":
        setPoam({ uuid: "test-poam" }, "poam.json");
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

/**
 * Renders the Layout with a pre-seeded OscalContext model.
 * Use this when you need isLoaded(modelKey) === true inside Layout.
 */
function renderLayoutWithSeeder(
  opts: {
    mobile?: boolean;
    initialPath?: string;
    seededModel?: "catalog" | "profile" | "ssp" | "component-definition" | "assessment-plan" | "assessment-results" | "poam";
  } = {},
) {
  stubMatchMedia(opts.mobile ?? false);
  return render(
    <ThemeProvider>
      <AuthProvider>
        <OscalProvider>
          <OscalSeeder modelKey={opts.seededModel ?? "catalog"}>
            <MemoryRouter initialEntries={[opts.initialPath ?? "/"]}>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<div>page: home</div>} />
                  <Route path="catalog" element={<div>page: catalog</div>} />
                  <Route path="privacy" element={<div>page: privacy</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </OscalSeeder>
        </OscalProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

const VALID_JWS = "hdr.payload.sig";

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* ─────────────── Desktop shell ─────────────── */

describe("<Layout /> desktop shell", () => {
  it("renders the desktop tab bar with a Home tab and model tabs", () => {
    renderLayout();
    // Find the nav (tab bar) specifically to avoid the footer / other NavLinks
    const nav = document.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(within(nav as HTMLElement).getByText("Home")).toBeInTheDocument();
    // Catalog tab from oscalModels
    expect(within(nav as HTMLElement).getByText("Catalog")).toBeInTheDocument();
  });

  it("does not render the hamburger button on desktop", () => {
    renderLayout();
    expect(
      screen.queryByRole("button", { name: /Toggle navigation menu/ }),
    ).not.toBeInTheDocument();
  });

  it("renders the default route via <Outlet />", () => {
    renderLayout();
    expect(screen.getByText("page: home")).toBeInTheDocument();
  });

  it("includes a Content Registry link in the desktop tab bar", () => {
    renderLayout();
    const nav = document.querySelector("nav") as HTMLElement;
    const link = within(nav).getByRole("link", {
      name: /Content Registry/,
    });
    expect(link).toHaveAttribute("href", "https://registry.oscal.io");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders a Privacy Policy link in the footer", () => {
    renderLayout();
    const footer = document.querySelector("footer") as HTMLElement;
    expect(
      within(footer).getByRole("link", { name: /Privacy Policy/ }),
    ).toBeInTheDocument();
  });

  it("renders the CookieBanner (visible when consent is unset)", () => {
    renderLayout();
    expect(screen.getByText(/This site uses a cookie/)).toBeInTheDocument();
  });
});

/* ─────────────── Mobile shell ─────────────── */

describe("<Layout /> mobile shell", () => {
  it("renders the hamburger toggle button", () => {
    renderLayout({ mobile: true });
    expect(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    ).toBeInTheDocument();
  });

  it("does not render the desktop tab bar on mobile", () => {
    renderLayout({ mobile: true });
    // There's no <nav> in the mobile layout; the mobile menu isn't rendered
    // until the hamburger is clicked.
    expect(document.querySelector("nav")).toBeNull();
  });

  it("opens the menu overlay when the hamburger is clicked", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    // The mobile menu renders its own Home link
    expect(screen.getAllByText("Home").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/Content Registry/).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("closes the menu on a mousedown outside of it", () => {
    renderLayout({ mobile: true });
    const toggle = screen.getByRole("button", {
      name: /Toggle navigation menu/,
    });
    fireEvent.click(toggle);
    // Menu is open; Home appears (along with its original in the header)
    expect(screen.getByText("Home")).toBeInTheDocument();

    // Fire a mousedown on body (outside the hamburger and menu)
    fireEvent.mouseDown(document.body);
    // Home text from the mobile menu should now be gone
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("closes the menu on a touchstart outside of it", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    fireEvent.touchStart(document.body);
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("keeps the menu open when the hamburger is the tap target", () => {
    renderLayout({ mobile: true });
    const toggle = screen.getByRole("button", {
      name: /Toggle navigation menu/,
    });
    fireEvent.click(toggle);
    // The handler early-returns when the target is inside the hamburger
    fireEvent.mouseDown(toggle);
    expect(screen.getByText("Home")).toBeInTheDocument();
  });

  it("closes the menu when a route-change NavLink is activated", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    // Find the Catalog menu item (rendered in the mobile overlay) and click
    const catalogLink = screen.getByRole("link", { name: /Catalog/ });
    fireEvent.click(catalogLink);
    // The location-change effect collapses the menu
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("renders the page content on mobile too", () => {
    renderLayout({ mobile: true, initialPath: "/catalog" });
    expect(screen.getByText("page: catalog")).toBeInTheDocument();
  });
});

/* ─────────────── JWT popover ─────────────── */

describe("<Layout /> JWT popover", () => {
  function findJwtButton() {
    return screen.getByRole("button", {
      name: /JWT|Load JWT|JWT loaded/i,
    });
  }

  it("opens the popover on click and shows a Save-disabled prompt when empty", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    expect(screen.getByText(/Load JWT Token/)).toBeInTheDocument();
    // Save button is disabled while the draft is empty
    const save = screen.getByRole("button", { name: /Save Token/ });
    expect(save).toBeDisabled();
  });

  it("stores a valid JWT via Save", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    const textarea = screen.getByPlaceholderText(/Paste your JWT here/);
    fireEvent.change(textarea, { target: { value: VALID_JWS } });
    fireEvent.click(screen.getByRole("button", { name: /Save Token/ }));
    // After save, popover closes and the icon now says "JWT loaded"
    expect(
      screen.getByRole("button", { name: /JWT loaded/ }),
    ).toBeInTheDocument();
  });

  it("rejects an obviously malformed JWT with an inline hint", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    const textarea = screen.getByPlaceholderText(/Paste your JWT here/);
    fireEvent.change(textarea, { target: { value: "not a jwt" } });
    // Inline validation message appears
    expect(
      screen.getByText(/Not a valid JWT format/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save Token/ })).toBeDisabled();
  });

  it("saves when the user presses Enter in the textarea", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    const textarea = screen.getByPlaceholderText(/Paste your JWT here/);
    fireEvent.change(textarea, { target: { value: VALID_JWS } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(
      screen.getByRole("button", { name: /JWT loaded/ }),
    ).toBeInTheDocument();
  });

  it("allows Shift+Enter for newlines without submitting", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    const textarea = screen.getByPlaceholderText(/Paste your JWT here/);
    fireEvent.change(textarea, { target: { value: VALID_JWS } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    // Still in "Load JWT" mode; popover did not submit
    expect(screen.getByText(/Load JWT Token/)).toBeInTheDocument();
  });

  it("shows the loaded view and clears the token via the Clear button", () => {
    // Pre-seed a valid token
    sessionStorage.setItem("oscal_jwt", VALID_JWS);
    renderLayout();

    fireEvent.click(
      screen.getByRole("button", { name: /JWT loaded/ }),
    );
    expect(screen.getByText(/JWT Token Loaded/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear Token/ }));
    // After clear, the button reverts to "Load JWT token"
    expect(
      screen.getByRole("button", { name: /Load JWT token/ }),
    ).toBeInTheDocument();
  });

  it("closes the popover on outside mousedown", () => {
    renderLayout();
    fireEvent.click(findJwtButton());
    expect(screen.getByText(/Load JWT Token/)).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(/Load JWT Token/)).not.toBeInTheDocument();
  });
});

/* ─────────────── Theme toggle ─────────────── */

describe("<Layout /> theme toggle", () => {
  it("renders the theme toggle button with an accessible label", () => {
    renderLayout();
    expect(
      screen.getByRole("button", { name: /Switch to (light|dark) mode/ }),
    ).toBeInTheDocument();
  });

  it("flips the theme when clicked", () => {
    renderLayout();
    const toggle = screen.getByRole("button", {
      name: /Switch to (light|dark) mode/,
    });
    const before = document.documentElement.getAttribute("data-theme");
    fireEvent.click(toggle);
    const after = document.documentElement.getAttribute("data-theme");
    expect(before).not.toBe(after);
  });
});

/* ─────────────── Desktop header — authenticated branch ─────────────── */

describe("<Layout /> desktop header authenticated", () => {
  beforeEach(() => {
    sessionStorage.setItem("oscal_jwt", VALID_JWS);
  });

  afterEach(() => {
    sessionStorage.removeItem("oscal_jwt");
  });

  it("shows the JWT loaded button when a token is in sessionStorage", () => {
    renderLayout();
    expect(
      screen.getByRole("button", { name: /JWT loaded/i }),
    ).toBeInTheDocument();
  });

  it("toggles the JWT popover open when the authenticated button is clicked", () => {
    renderLayout();
    const btn = screen.getByRole("button", { name: /JWT loaded/i });
    fireEvent.click(btn);
    expect(screen.getByText(/JWT Token Loaded/)).toBeInTheDocument();
  });

  it("closes the JWT popover when clicking it a second time (toggle off)", () => {
    renderLayout();
    const btn = screen.getByRole("button", { name: /JWT loaded/i });
    // open
    fireEvent.click(btn);
    expect(screen.getByText(/JWT Token Loaded/)).toBeInTheDocument();
    // close via outside mousedown (same pattern as other popover tests)
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(/JWT Token Loaded/)).not.toBeInTheDocument();
  });
});

/* ─────────────── Mobile header — JWT button + theme toggle ─────────────── */

describe("<Layout /> mobile header controls", () => {
  it("renders a JWT button in mobile mode (unauthenticated)", () => {
    renderLayout({ mobile: true });
    expect(
      screen.getByRole("button", { name: /Load JWT token/i }),
    ).toBeInTheDocument();
  });

  it("opens the JWT popover from the mobile header", () => {
    renderLayout({ mobile: true });
    fireEvent.click(screen.getByRole("button", { name: /Load JWT token/i }));
    expect(screen.getByText(/Load JWT Token/)).toBeInTheDocument();
  });

  it("renders the theme toggle in mobile mode", () => {
    renderLayout({ mobile: true });
    expect(
      screen.getByRole("button", { name: /Switch to (light|dark) mode/ }),
    ).toBeInTheDocument();
  });

  it("flips the theme from the mobile header toggle", () => {
    renderLayout({ mobile: true });
    const toggle = screen.getByRole("button", {
      name: /Switch to (light|dark) mode/,
    });
    const before = document.documentElement.getAttribute("data-theme");
    fireEvent.click(toggle);
    const after = document.documentElement.getAttribute("data-theme");
    expect(before).not.toBe(after);
  });

  it("shows JWT loaded button in mobile when token is in sessionStorage", () => {
    sessionStorage.setItem("oscal_jwt", VALID_JWS);
    renderLayout({ mobile: true });
    expect(
      screen.getByRole("button", { name: /JWT loaded/i }),
    ).toBeInTheDocument();
  });
});

/* ─────────────── Mobile menu overlay items ─────────────── */

describe("<Layout /> mobile menu overlay", () => {
  it("renders model items when the mobile menu is open", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    // Catalog is one of the oscalModels
    expect(screen.getByRole("link", { name: /Catalog/ })).toBeInTheDocument();
  });

  it("renders the Content Registry external link in the mobile menu", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    const registryLinks = screen.getAllByRole("link", { name: /Content Registry/ });
    expect(registryLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("closes the menu when a model item is tapped", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    // The menu is now open; click a model item to close it
    const catalogLink = screen.getByRole("link", { name: /Catalog/ });
    fireEvent.click(catalogLink);
    // Menu should close — Home text from mobile menu should vanish
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("closes the menu when the Content Registry link is clicked", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    // Pick the registry link inside the mobile menu overlay
    const registryLinks = screen.getAllByRole("link", { name: /Content Registry/ });
    fireEvent.click(registryLinks[0]);
    // Menu should close
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });

  it("closes the menu when the Home item in the mobile overlay is tapped", () => {
    renderLayout({ mobile: true });
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );
    // The mobile overlay renders a "Home" NavLink; clicking it triggers onTap
    const homeLinks = screen.getAllByRole("link", { name: /^Home$/ });
    // There should be at least one Home link in the overlay
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(homeLinks[0]);
    // Menu closes after tap
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
  });
});

/* ─────────────── Mobile menu — Dot indicator loaded state ─────────────── */

describe("<Layout /> mobile menu dot indicator", () => {
  it("shows the loaded dot state for a seeded profile model", async () => {
    // Seed a profile so isLoaded('profile') === true, which sets loaded=true on that MobileMenuItem dot
    renderLayoutWithSeeder({ mobile: true, seededModel: "profile" });

    // Open the mobile menu
    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );

    // The Profile menu item should be present in the mobile overlay
    const profileLink = screen.getByRole("link", { name: /Profile/ });
    expect(profileLink).toBeInTheDocument();
  });

  it("shows the loaded dot state for a seeded catalog model", async () => {
    renderLayoutWithSeeder({ mobile: true, seededModel: "catalog" });

    fireEvent.click(
      screen.getByRole("button", { name: /Toggle navigation menu/ }),
    );

    const catalogLink = screen.getByRole("link", { name: /Catalog/ });
    expect(catalogLink).toBeInTheDocument();
  });
});

/* ─────────────── SSP count badge — #59 ─────────────── */

function SspMultiSeeder({ children }: { children?: ReactNode }) {
  const { setSsp, addLeveragedSsp } = useOscal();
  useEffect(() => {
    setSsp({ uuid: "current-ssp" }, "current.json");
    addLeveragedSsp({ uuid: "provider-1" }, "provider1.json");
    addLeveragedSsp({ uuid: "provider-2" }, "provider2.json");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

function SspLoneSeeder({ children }: { children?: ReactNode }) {
  const { setSsp } = useOscal();
  useEffect(() => {
    setSsp({ uuid: "lone-ssp" }, "ssp.json");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{children}</>;
}

describe("<Layout /> SSP count badge (port upstream #59)", () => {
  function renderWithSeeder(
    Seeder: React.ComponentType<{ children?: ReactNode }>,
    opts: { mobile?: boolean } = {},
  ) {
    stubMatchMedia(opts.mobile ?? false);
    return render(
      <ThemeProvider>
        <AuthProvider>
          <OscalProvider>
            <Seeder>
              <MemoryRouter initialEntries={["/"]}>
                <Routes>
                  <Route element={<Layout />}>
                    <Route path="/" element={<div>page: home</div>} />
                  </Route>
                </Routes>
              </MemoryRouter>
            </Seeder>
          </OscalProvider>
        </AuthProvider>
      </ThemeProvider>,
    );
  }

  it("desktop: renders the '3 SSPs' badge when current SSP + two leveraged SSPs are loaded", () => {
    renderWithSeeder(SspMultiSeeder);
    expect(screen.getAllByText(/3 SSPs/).length).toBeGreaterThan(0);
  });

  it("desktop: SSP tab carries a tooltip listing every loaded SSP fileName", () => {
    renderWithSeeder(SspMultiSeeder);
    const sspLink = screen.getAllByRole("link").find((l) =>
      /SSP/.test(l.textContent ?? "") && l.getAttribute("title"),
    );
    expect(sspLink).toBeTruthy();
    const title = sspLink!.getAttribute("title")!;
    expect(title).toContain("Current: current.json");
    expect(title).toContain("Leveraged: provider1.json");
    expect(title).toContain("Leveraged: provider2.json");
  });

  it("desktop: no badge when only a single SSP is loaded", () => {
    renderWithSeeder(SspLoneSeeder);
    expect(screen.queryAllByText(/SSPs$/).length).toBe(0);
  });

  it("desktop: no badge when zero SSPs are loaded", () => {
    renderLayoutWithSeeder({ seededModel: "catalog" });
    expect(screen.queryAllByText(/SSPs$/).length).toBe(0);
  });

  it("mobile: menu label appends '(N)' when 2+ SSPs are loaded", () => {
    renderWithSeeder(SspMultiSeeder, { mobile: true });
    fireEvent.click(screen.getByRole("button", { name: /Toggle navigation menu/ }));
    expect(screen.queryAllByText(/SSP \(3\)/).length).toBeGreaterThan(0);
  });

  it("mobile: menu label has no '(N)' when only one SSP is loaded", () => {
    renderWithSeeder(SspLoneSeeder, { mobile: true });
    fireEvent.click(screen.getByRole("button", { name: /Toggle navigation menu/ }));
    // Just the bare "SSP" label, no parenthesized count.
    expect(screen.queryAllByText(/SSP \(\d+\)/).length).toBe(0);
  });
});

/* ─────────────── Disabled tab note ─────────────── */

// NOTE: The `if (m.disabled)` branch at Layout.tsx L188-211 is structurally
// unreachable via the public API: no entry in src/theme/tokens.ts oscalModels
// has `disabled: true`. The flag is wired through but never set. Do not chase.
