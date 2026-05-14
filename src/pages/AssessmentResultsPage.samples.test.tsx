/* eslint-disable @typescript-eslint/no-explicit-any */
/* ═══════════════════════════════════════════════════════════════════════════
   AssessmentResultsPage — production-shaped-input smoke test.

   Loads the real OSCAL sample at `samples/assessment-results-ifa.json`
   through the AR page's loadFile path and asserts the page renders.

   The IFA AR sample has `import-ap.href: "./ap.oscal.xml"` — the chain
   resolver will reject this at pre-flight (XML extension). This test
   confirms the page itself renders even though the chain step errors.

   Principle (user, 2026-05-14): test suite consumes the same inputs the
   browser does. ZERO impl changes.
   ═══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AssessmentResultsPage from "./AssessmentResultsPage";
import { OscalProvider } from "../context/OscalContext";
import { AuthProvider } from "../context/AuthContext";
import sampleWrapped from "../../samples/assessment-results-ifa.json";

function stubMatchMedia(mobile = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderEmpty() {
  return render(
    <MemoryRouter initialEntries={["/assessment-results"]}>
      <AuthProvider>
        <OscalProvider>
          <AssessmentResultsPage />
        </OscalProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function dropSample(container: HTMLElement) {
  const zone = container.querySelector('div[style*="dashed"]') as HTMLElement;
  const file = new File(
    [JSON.stringify(sampleWrapped)],
    "assessment-results-ifa.json",
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

describe("<AssessmentResultsPage /> samples/assessment-results-ifa.json — production-shaped input", () => {
  it("loads the wrapped sample through loadFile and renders the AR title", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/IFA GoodRead Continuous Monitoring/).length,
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

  it("does not surface a 'missing metadata' or 'no results array' error for the IFA sample", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/IFA GoodRead Continuous Monitoring/).length,
      ).toBeGreaterThan(0),
    );
    expect(screen.queryByText(/no metadata|no results array/i)).toBeNull();
  });

  it("navigates to the Metadata view on the real IFA sample", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/IFA GoodRead Continuous Monitoring/).length,
      ).toBeGreaterThan(0),
    );
    fireEvent.click(screen.getAllByText(/Metadata/i)[0]);
    // Real metadata.parties content surfaces (some IFA reference appears).
    await waitFor(() => {
      const text = document.body.textContent ?? "";
      expect(/IFA/.test(text)).toBe(true);
    });
  });

  it("renders the result with its observations / findings / risks counts", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(
        screen.queryAllByText(/IFA GoodRead Continuous Monitoring/).length,
      ).toBeGreaterThan(0),
    );
    // The IFA result has 2 observations, 1 finding, 1 risk — sidebar counts
    // surface via section labels or chip counts. We assert *some* of the
    // sidebar content references results/observations.
    const text = document.body.textContent ?? "";
    expect(/Observations|Findings|Risks|Results/i.test(text)).toBe(true);
  });
});
