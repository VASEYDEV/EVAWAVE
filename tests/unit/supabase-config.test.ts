import { afterEach, describe, expect, it, vi } from "vitest";

import { getSupabasePublicConfig, requireSupabasePublicConfig } from "@/lib/supabase/config";

const URL = "https://project.supabase.test";
const KEY = "anon-key-for-tests";

describe("Supabase public config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is null only when both variables are unset (before a project is provisioned)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(getSupabasePublicConfig()).toBeNull();
  });

  it("returns both values when both are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", KEY);
    expect(getSupabasePublicConfig()).toEqual({ url: URL, anonKey: KEY });
    expect(requireSupabasePublicConfig()).toEqual({ url: URL, anonKey: KEY });
  });

  it.each([
    ["only the URL", URL, "", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    ["only the anon key", "", KEY, "NEXT_PUBLIC_SUPABASE_URL"],
  ])("throws when %s is set, naming the missing variable", (_case, url, key, missing) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", key);
    expect(() => getSupabasePublicConfig()).toThrow(missing);
    expect(() => requireSupabasePublicConfig()).toThrow(missing);
  });

  it("requireSupabasePublicConfig throws when neither is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(() => requireSupabasePublicConfig()).toThrow("Supabase is not configured");
  });
});
