/* eslint-disable @typescript-eslint/no-explicit-any */
/* ═══════════════════════════════════════════════════════════════════════════
   HomePage — disabled-model + no-favicon branch coverage.

   The main HomePage.test.tsx covers desktop + mobile flows with the live
   theme/tokens module. The conditional arms that remain partial there are:

   - `brand.favicon ? <img/> : <IconShield/>` (L20) — `brand.favicon` is
     truthy in the live theme; the falsy arm never fires.
   - `m.disabled ? gray-style : color-style` and its
     `m.disabled ? <div>{inner}</div> : <Link>{inner}</Link>` companion
     (L118/L119/L129/L136/L139/L144) — no oscalModels entry sets
     `disabled: true` in the live tokens, so the truthy arms never fire.

   This file mocks `../theme/tokens` to provide a brand without a favicon
   and an oscalModels array that includes a disabled entry, then renders
   HomePage with that mock active. We isolate the mock to this file so
   the live-token tests in HomePage.test.tsx are unaffected (vi.mock is
   per-test-file in Vitest).
   ═══════════════════════════════════════════════════════════════════════════ */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("../theme/tokens", async () => {
  const actual = await vi.importActual<typeof import("../theme/tokens")>(
    "../theme/tokens",
  );
  return {
    ...actual,
    brand: {
      ...actual.brand,
      // Force the favicon-falsy branch in HomePage L20.
      favicon: "",
    },
    oscalModels: [
      // One disabled entry → fires `m.disabled` truthy across
      // L118/L119/L129/L136/L139/L144.
      {
        key: "disabled-stub",
        label: "Disabled Model",
        path: "/disabled-stub",
        description: "A model with disabled=true for branch coverage.",
        color: "#000000",
        disabled: true,
      },
      // One enabled entry as control (so the page still renders
      // its enabled-side ternary arms as before).
      {
        key: "enabled-stub",
        label: "Enabled Model",
        path: "/enabled-stub",
        description: "An enabled model.",
        color: "#444444",
      },
    ],
  };
});

import HomePage from "./HomePage";

function stubMatchMedia(mobile = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

beforeEach(() => stubMatchMedia(false));
afterEach(() => vi.unstubAllGlobals());

describe("<HomePage /> disabled-model + no-favicon variants", () => {
  it("renders the IconShield fallback when brand.favicon is empty (L20 falsy arm)", () => {
    render(<HomePage />, { wrapper });
    // The brand heading still renders.
    expect(screen.getAllByRole("heading", { level: 1 }).length).toBeGreaterThan(0);
    // The favicon <img> isn't in the document; the fallback IconShield
    // SVG is. We assert no <img> in the banner area (the GitHub link is
    // an <a>, not an img).
    expect(document.querySelector('img')).toBeNull();
  });

  it("renders a 'Coming soon' label for a disabled model (L139 truthy arm)", () => {
    render(<HomePage />, { wrapper });
    expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();
  });

  it("renders the disabled model card inside a <div> rather than a <Link> (L144 truthy arm)", () => {
    render(<HomePage />, { wrapper });
    const disabledHeading = screen.getByRole("heading", { level: 3, name: "Disabled Model" });
    // The disabled model's card is wrapped in <div>, not <a>.
    expect(disabledHeading.closest("a")).toBeNull();
    expect(disabledHeading.closest("div")).not.toBeNull();
  });

  it("renders the enabled model card inside a <Link> (L144 falsy arm — sanity check)", () => {
    render(<HomePage />, { wrapper });
    const enabledHeading = screen.getByRole("heading", { level: 3, name: "Enabled Model" });
    expect(enabledHeading.closest("a")).not.toBeNull();
    expect(enabledHeading.closest("a")).toHaveAttribute("href", "/enabled-stub");
  });

  it("disabled and enabled card on mobile (covers all 4 truthy/falsy combos at L118/L119/L129/L136)", () => {
    stubMatchMedia(true);
    render(<HomePage />, { wrapper });
    // Both cards render at the heading level; on mobile the description
    // ('A model with disabled=true...') is hidden but the heading shows.
    expect(screen.getByRole("heading", { level: 3, name: "Disabled Model" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Enabled Model" })).toBeInTheDocument();
    // Coming soon still surfaces on mobile.
    expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();
  });
});
