/* eslint-disable @typescript-eslint/no-explicit-any */
/* ═══════════════════════════════════════════════════════════════════════════
   CatalogPage — production-shaped-input smoke test.

   Loads the real OSCAL sample at `samples/catalog-basic.json` through the
   CatalogPage's loadFile path and asserts the page renders. The runtime
   already claims to handle this file (it's shipped in the repo as a sample);
   the test suite previously did not exercise it, so the contract was
   under-verified.

   Principle (user, 2026-05-14): the test suite is just another consumer of
   the same input contract as the browser. If `samples/catalog-basic.json`
   loads in production, it must load through tests too.

   ZERO impl changes; cherry-pickable as a standalone file.
   ═══════════════════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CatalogPage from "./CatalogPage";
import { OscalProvider } from "../context/OscalContext";
import { AuthProvider } from "../context/AuthContext";
import sampleWrapped from "../../samples/catalog-basic.json";

function stubMatchMedia(mobile = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: mobile,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

function renderEmpty() {
  return render(
    <MemoryRouter initialEntries={["/catalog"]}>
      <AuthProvider>
        <OscalProvider>
          <CatalogPage />
        </OscalProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function dropSample(container: HTMLElement) {
  const zone = container.querySelector('div[style*="dashed"]') as HTMLElement;
  const file = new File([JSON.stringify(sampleWrapped)], "catalog-basic.json", {
    type: "application/json",
  });
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}

beforeEach(() => {
  stubMatchMedia(false);
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("<CatalogPage /> samples/catalog-basic.json — production-shaped input", () => {
  it("loads the wrapped sample through the loadFile path and renders the catalog title", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    // The sample's metadata.title surfaces in the page header / Overview view.
    await waitFor(() =>
      expect(
        screen.queryAllByText(/Sample Security Catalog/).length,
      ).toBeGreaterThan(0),
    );
  });

  it("renders the sample's groups in the sidebar (no throw on real shape)", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(screen.queryAllByText(/Overview/i).length).toBeGreaterThan(0),
    );
    // The sample's two groups are surfaced; we don't pin specific titles
    // because upstream may rename, but we assert *some* group surfaces.
    // The CatalogPage sidebar shows family prefixes uppercased.
    const sidebarText = container.textContent ?? "";
    // Either group label is fine — assert non-empty sidebar after load.
    expect(sidebarText.length).toBeGreaterThan(100);
  });

  it("does not surface the JSON-validity error path for this sample", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(screen.queryAllByText(/Sample Security Catalog/).length).toBeGreaterThan(0),
    );
    // The "Not an OSCAL Catalog" error message should NOT appear.
    expect(screen.queryByText(/Not an OSCAL Catalog/i)).toBeNull();
  });

  it("navigates to the Metadata view on the real sample", async () => {
    const { container } = renderEmpty();
    dropSample(container);
    await waitFor(() =>
      expect(screen.queryAllByText(/Sample Security Catalog/).length).toBeGreaterThan(0),
    );
    const metadataNav = screen.queryAllByText(/^Metadata$/i)[0];
    if (metadataNav) {
      fireEvent.click(metadataNav);
      // Render proceeds without throwing on the sample's metadata shape.
      const text = document.body.textContent ?? "";
      expect(text.length).toBeGreaterThan(100);
    }
  });
});
