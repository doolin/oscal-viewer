import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
} from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  isValidJwtFormat,
  authHeaders,
  authFetch,
  AuthProvider,
  useAuth,
} from "./AuthContext";

const VALID_JWS = "hdr.payload.sig";
const VALID_JWS_2 = "other.payload.sig";

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("isValidJwtFormat()", () => {
  it("accepts a standard JWS (3 non-empty base64url segments)", () => {
    expect(isValidJwtFormat("header.payload.signature")).toBe(true);
  });

  it("accepts base64url characters including _ and -", () => {
    expect(isValidJwtFormat("a-b_c.d-e_f.g-h_i")).toBe(true);
  });

  it("accepts a JWE (5 segments, all non-empty)", () => {
    expect(isValidJwtFormat("hdr.ekey.iv.ct.tag")).toBe(true);
  });

  it("accepts a JWE with empty encrypted-key (dir algorithm)", () => {
    expect(isValidJwtFormat("hdr..iv.ct.tag")).toBe(true);
  });

  it("rejects tokens with the wrong number of segments", () => {
    expect(isValidJwtFormat("only-one")).toBe(false);
    expect(isValidJwtFormat("two.parts")).toBe(false);
    expect(isValidJwtFormat("four.parts.here.now")).toBe(false);
    expect(isValidJwtFormat("six.parts.are.too.many.now")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidJwtFormat("")).toBe(false);
  });

  it("rejects non-base64url characters", () => {
    expect(isValidJwtFormat("hdr.pay load.sig")).toBe(false);
    expect(isValidJwtFormat("hdr.pay/load.sig")).toBe(false);
    expect(isValidJwtFormat("hdr.pay+load.sig")).toBe(false);
  });

  it("rejects a JWS with any empty segment", () => {
    expect(isValidJwtFormat(".payload.signature")).toBe(false);
    expect(isValidJwtFormat("header..signature")).toBe(false);
    expect(isValidJwtFormat("header.payload.")).toBe(false);
  });

  it("rejects a JWE with an empty header, iv, ciphertext, or tag", () => {
    expect(isValidJwtFormat(".ekey.iv.ct.tag")).toBe(false);
    expect(isValidJwtFormat("hdr.ekey..ct.tag")).toBe(false);
    expect(isValidJwtFormat("hdr.ekey.iv..tag")).toBe(false);
    expect(isValidJwtFormat("hdr.ekey.iv.ct.")).toBe(false);
  });
});

describe("authHeaders()", () => {
  it("returns an empty object when no token is given", () => {
    expect(authHeaders(null)).toEqual({});
  });

  it("builds a Bearer authorization header from a token", () => {
    expect(authHeaders("abc.def.ghi")).toEqual({
      Authorization: "Bearer abc.def.ghi",
    });
  });
});

describe("<AuthProvider> + useAuth()", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when useAuth() is called outside a provider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      /useAuth must be used within <AuthProvider>/,
    );
  });

  it("starts with no token when sessionStorage is empty", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("restores a valid token from sessionStorage on mount", () => {
    sessionStorage.setItem("oscal_jwt", VALID_JWS);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.token).toBe(VALID_JWS);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("discards a corrupted sessionStorage value on mount", () => {
    sessionStorage.setItem("oscal_jwt", "not-a-jwt");
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.token).toBeNull();
    expect(sessionStorage.getItem("oscal_jwt")).toBeNull();
  });

  it("tolerates sessionStorage.getItem throwing (private-mode etc.)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.token).toBeNull();
  });

  it("setToken stores a valid token and flips isAuthenticated", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.setToken(VALID_JWS));
    expect(result.current.token).toBe(VALID_JWS);
    expect(result.current.isAuthenticated).toBe(true);
    expect(sessionStorage.getItem("oscal_jwt")).toBe(VALID_JWS);
  });

  it("setToken trims whitespace from the input", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.setToken(`  ${VALID_JWS}  `));
    expect(result.current.token).toBe(VALID_JWS);
  });

  it("setToken ignores an empty or whitespace-only input", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.setToken("   "));
    expect(result.current.token).toBeNull();
  });

  it("setToken warns and rejects a malformed token", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.setToken("definitely-not-jwt"));
    expect(result.current.token).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/rejected token/),
    );
  });

  it("setToken keeps the token in memory when sessionStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.setToken(VALID_JWS));
    expect(result.current.token).toBe(VALID_JWS);
  });

  it("clearToken nulls state and removes the sessionStorage key", () => {
    sessionStorage.setItem("oscal_jwt", VALID_JWS);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.token).toBe(VALID_JWS);
    act(() => result.current.clearToken());
    expect(result.current.token).toBeNull();
    expect(sessionStorage.getItem("oscal_jwt")).toBeNull();
  });

  it("clearToken tolerates sessionStorage.removeItem throwing", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.setToken(VALID_JWS));
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("nope");
    });
    act(() => result.current.clearToken());
    expect(result.current.token).toBeNull();
  });

  it("updating to a different token overwrites storage", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.setToken(VALID_JWS));
    act(() => result.current.setToken(VALID_JWS_2));
    expect(result.current.token).toBe(VALID_JWS_2);
    expect(sessionStorage.getItem("oscal_jwt")).toBe(VALID_JWS_2);
  });
});

describe("authFetch()", () => {
  let fetchMock: MockInstance;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does a plain fetch when no token is supplied", async () => {
    await authFetch("https://example.com/x.json", null);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledUrl).toBe("https://example.com/x.json");
    expect(calledOpts).toMatchObject({ signal: undefined });
    expect(calledOpts).not.toHaveProperty("headers");
  });

  it("omits credentials on the no-token branch (avoids breaking unauthenticated CORS reads)", async () => {
    await authFetch("https://example.com/x.json", null);
    const [, calledOpts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledOpts).not.toHaveProperty("credentials");
  });

  it("passes through the AbortSignal when no token is supplied", async () => {
    const ctrl = new AbortController();
    await authFetch("https://example.com/x.json", null, { signal: ctrl.signal });
    const [, calledOpts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(calledOpts.signal).toBe(ctrl.signal);
  });

  /* The token path now gates credentials + proxy on isOscalApiOrigin (api.oscal.io).
     Third-party hosts get a bare fetch — see #55:
     https://github.com/EasyDynamics/oscal-viewer/pull/55 */

  it("in dev, POSTs to /__proxy with token in JSON body (api.oscal.io URL)", async () => {
    vi.stubEnv("DEV", true);
    await authFetch("https://api.oscal.io/x.json", VALID_JWS);
    const [url, opts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/__proxy");
    expect(opts.method).toBe("POST");
    const parsed = JSON.parse(opts.body as string);
    expect(parsed).toEqual({
      url: "https://api.oscal.io/x.json",
      headers: { Authorization: `Bearer ${VALID_JWS}` },
    });
  });

  it("in dev, sends credentials to the proxy when target is api.oscal.io", async () => {
    vi.stubEnv("DEV", true);
    await authFetch("https://api.oscal.io/x.json", VALID_JWS);
    const [, opts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.credentials).toBe("include");
  });

  it("in prod, calls api.oscal.io directly with an Authorization header", async () => {
    vi.stubEnv("DEV", false);
    await authFetch("https://api.oscal.io/x.json", VALID_JWS);
    const [url, opts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.oscal.io/x.json");
    expect(opts.headers).toEqual({ Authorization: `Bearer ${VALID_JWS}` });
    expect(opts.method).toBeUndefined();
  });

  it("in prod, sends credentials to api.oscal.io so it receives session cookies", async () => {
    vi.stubEnv("DEV", false);
    await authFetch("https://api.oscal.io/x.json", VALID_JWS);
    const [, opts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.credentials).toBe("include");
  });

  /* New branches added by #55: third-party hosts skip the proxy / Authorization /
     credentials entirely (their CORS responds with `Access-Control-Allow-Origin: *`
     which is incompatible with credentialed requests). */

  it("with token + third-party URL, falls back to a bare fetch (no proxy, no auth header)", async () => {
    vi.stubEnv("DEV", true);
    await authFetch("https://example.com/x.json", VALID_JWS);
    const [url, opts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://example.com/x.json");
    expect(opts).not.toHaveProperty("headers");
    expect(opts).not.toHaveProperty("credentials");
    expect(opts.method).toBeUndefined();
  });

  it("with token + third-party URL in prod, also falls back to a bare fetch", async () => {
    vi.stubEnv("DEV", false);
    await authFetch("https://example.com/x.json", VALID_JWS);
    const [url, opts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://example.com/x.json");
    expect(opts).not.toHaveProperty("headers");
    expect(opts).not.toHaveProperty("credentials");
  });

  it("without token + api.oscal.io URL, sends credentials for cookie-based auth", async () => {
    await authFetch("https://api.oscal.io/x.json", null);
    const [, opts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(opts.credentials).toBe("include");
  });

  it("treats unparseable URL strings as non-api (bare fetch path)", async () => {
    await authFetch("not a url", VALID_JWS);
    const [url, opts] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("not a url");
    expect(opts).not.toHaveProperty("credentials");
    expect(opts).not.toHaveProperty("headers");
  });
});
