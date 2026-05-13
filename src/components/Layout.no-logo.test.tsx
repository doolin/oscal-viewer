/* ═══════════════════════════════════════════════════════════════════════════
   Layout — no-logoUrl branch coverage.

   The default theme (oscalio) has brand.logoUrl set, so the `!brand.logoUrl`
   else-branch at Layout.tsx L124-150 is never executed in Layout.test.tsx.
   This file mocks the tokens module to force logoUrl = "" so that branch
   executes, covering lines 125-150 (the tagline/no-logo desktop header path).
   ═══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// ── Mock the tokens module BEFORE importing Layout ──
// Vitest hoists vi.mock() calls, so this runs before any imports below.
vi.mock("../theme/tokens", async (importOriginal) => {
  const original = await importOriginal<typeof import("../theme/tokens")>();
  return {
    ...original,
    brand: {
      ...original.brand,
      logoUrl: "",   // force the no-logo branch
    },
  };
});

// These imports run after vi.mock has been hoisted and applied
import Layout from "./Layout";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";
import { OscalProvider } from "../context/OscalContext";

const VALID_JWS = "hdr.payload.sig";

function stubMatchMediaDesktop() {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    listeners: [],
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderNoLogo() {
  stubMatchMediaDesktop();
  return render(
    <ThemeProvider>
      <AuthProvider>
        <OscalProvider>
          <MemoryRouter initialEntries={["/"]}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<div>page: home</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </OscalProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("<Layout /> desktop header — no logoUrl branch", () => {
  it("renders the tagline span when brand.logoUrl is empty", () => {
    renderNoLogo();
    // The no-logo branch renders <span style={styles.tagline}>{brand.tagline}</span>
    // so the tagline text should appear somewhere in the document
    // (brand.tagline is "OSCAL.io" from the oscalio theme)
    expect(document.body.textContent).toContain("OSCAL");
  });

  it("renders the JWT button in the no-logo desktop header", () => {
    renderNoLogo();
    expect(
      screen.getByRole("button", { name: /Load JWT token/i }),
    ).toBeInTheDocument();
  });

  it("opens the JWT popover from the no-logo desktop header", () => {
    renderNoLogo();
    fireEvent.click(screen.getByRole("button", { name: /Load JWT token/i }));
    expect(screen.getByText(/Load JWT Token/)).toBeInTheDocument();
  });

  it("shows authenticated button in no-logo desktop header when JWT is seeded", () => {
    sessionStorage.setItem("oscal_jwt", VALID_JWS);
    renderNoLogo();
    expect(
      screen.getByRole("button", { name: /JWT loaded/i }),
    ).toBeInTheDocument();
  });

  it("renders the theme toggle in the no-logo desktop header", () => {
    renderNoLogo();
    expect(
      screen.getByRole("button", { name: /Switch to (light|dark) mode/ }),
    ).toBeInTheDocument();
  });
});
