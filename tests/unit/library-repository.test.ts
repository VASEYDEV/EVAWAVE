import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { deleteFile, deleteStyleProfile, deleteTag, LibraryError } from "@/lib/library/repository";
import type { Database } from "@/lib/library/schema";

/**
 * A client whose PostgREST answers every request with `rows`. RLS hides another account's
 * row, so a delete of it returns 200 and no rows rather than an error; the repository must
 * read that as a failure (docs/SPEC.md §1.6), as after an account change in another tab.
 */
const answering = (rows: unknown[]) =>
  createClient<Database>("https://project.supabase.test", "anon-key-for-tests", {
    global: { fetch: (async () => new Response(JSON.stringify(rows), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch },
    auth: { persistSession: false },
  });

describe("library deletes", () => {
  it.each([
    ["style profile", (client: ReturnType<typeof answering>) => deleteStyleProfile(client, "row-1"), "no such profile"],
    ["tag", (client: ReturnType<typeof answering>) => deleteTag(client, "row-1"), "no such tag"],
    ["file", (client: ReturnType<typeof answering>) => deleteFile(client, "row-1"), "no such record"],
  ])("rejects a %s delete that removed no row, and resolves one that removed the row", async (_what, run, message) => {
    await expect(run(answering([]))).rejects.toBeInstanceOf(LibraryError);
    await expect(run(answering([]))).rejects.toThrow(message);
    await expect(run(answering([{ id: "row-1" }]))).resolves.toBeUndefined();
  });
});
