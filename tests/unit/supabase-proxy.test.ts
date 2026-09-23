import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient, getClaims } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));

import { updateSession } from "@/lib/supabase/proxy";

type CookieAdapter = {
  cookies: {
    getAll: () => { name: string; value: string }[];
    setAll: (
      cookies: { name: string; value: string; options: Record<string, unknown> }[],
      headers: Record<string, string>,
    ) => void;
  };
};

function request() {
  return new NextRequest("https://evawave.test/compose", {
    headers: { cookie: "sb-probe-auth-token=stale" },
  });
}

describe("updateSession (src/proxy.ts session refresh)", () => {
  beforeEach(() => {
    createServerClient.mockReset();
    getClaims.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes the request through without touching Supabase when it is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await updateSession(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("fails loudly instead of passing through when Supabase is only partially configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(updateSession(request())).rejects.toThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("revalidates the session and writes refreshed cookies plus no-cache headers", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-for-tests");

    createServerClient.mockImplementation((_url: string, _key: string, adapter: CookieAdapter) => {
      getClaims.mockImplementation(async () => {
        expect(adapter.cookies.getAll()).toContainEqual({ name: "sb-probe-auth-token", value: "stale" });
        adapter.cookies.setAll(
          [{ name: "sb-probe-auth-token", value: "fresh", options: { path: "/", httpOnly: true } }],
          { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0" },
        );
        return { data: null, error: null };
      });
      return { auth: { getClaims } };
    });

    const response = await updateSession(request());

    expect(createServerClient).toHaveBeenCalledWith(
      "https://project.supabase.test",
      "anon-key-for-tests",
      expect.any(Object),
    );
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(response.cookies.get("sb-probe-auth-token")?.value).toBe("fresh");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
  });
});
