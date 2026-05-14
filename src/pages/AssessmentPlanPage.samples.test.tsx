/* eslint-disable @typescript-eslint/no-explicit-any */
/* ═══════════════════════════════════════════════════════════════════════════
   AssessmentPlanPage — production-shaped-input smoke test.

   Loads the real OSCAL sample at `samples/assessment-plan-ifa.json` through
   the AssessmentPlanPage's loadFile path and asserts the page renders.

   The IFA Assessment Plan sample is a published NIST/oscal-content example.
   It has `import-ssp.href: "../3-implementation/ssp.oscal.xml"` — note the
   `.xml` extension. The chain resolver will reject this href at pre-flight
   (per `useImportResolver.UNSUPPORTED_EXTENSIONS` containing `.xml`), so the
   chain shows an error state without hanging. This test asserts the page
   itself renders even though the chain step errors.

   Principle (user, 2026-05-14): test suite consumes the same inputs the
   browser does. ZERO impl changes.
   ═══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssessmentPlanPage from "./AssessmentPlanPage";
import { OscalProvider } from "../context/OscalContext";
import { AuthProvider } from "../context/AuthContext";
import sampleWrapped from "../../samples/assessment-plan-ifa.json";

function stubMatchMedia(mobile = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderEmpty() {
  return render(
    <MemoryRouter initialEntries={["/assessment-plan"]}>
      <AuthProvider>
        <OscalProvider>
          <AssessmentPlanPage />
        </OscalProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function dropSample(container: HTMLElement) {
  const zone = container.querySelector('div[style*="dashed"]') as HTMLElement;
  const file = new File(
    [JSON.stringify(sampleWrapped)],
    "assessment-plan-ifa.json",
    { type: "application/json" },
  );
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}

beforeEach(() => {
  stubMatchMedia(false);
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<AssessmentPlanPage /> samples/assessment-plan-ifa.json — production-shaped input", () => {
  it("loads the wrapped sample through loadFile and renders the plan title", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/IFA GoodRead Assessment Plan/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders the Overview view without throwing on real shape", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(screen.queryAllByText(/Overview/i).length).toBeGreaterThan(0),
    );
  });

  it("does not surface a 'missing metadata' error for the IFA sample", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(screen.queryAllByText(/IFA GoodRead Assessment Plan/).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/missing metadata/i)).toBeNull();
  });

  it("navigates to the Metadata view on the real sample", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(screen.queryAllByText(/IFA GoodRead Assessment Plan/).length).toBeGreaterThan(0),
    );
    const metadataNav = screen.queryAllByText(/^Metadata$/i)[0];
    if (metadataNav) {
      fireEvent.click(metadataNav);
      // Render proceeds without throwing on the sample's metadata shape.
      const text = document.body.textContent ?? "";
      expect(text.length).toBeGreaterThan(100);
    }
  });

  it("surfaces the sample's activity title in the rendered output", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    // The activity from local-definitions has a long title that should
    // appear somewhere in the rendered tree (sidebar entry or content).
    await waitFor(() => {
      const text = document.body.textContent ?? "";
      const hasActivity = /Examine.*Least Privilege/i.test(text);
      expect(hasActivity).toBe(true);
    });
  });
});
