import { describe, expect, it } from "vitest";

import eleven from "@/core/musicspec/engines/profiles/eleven.json";
import flow from "@/core/musicspec/engines/profiles/flow.json";
import suno from "@/core/musicspec/engines/profiles/suno.json";
import udio from "@/core/musicspec/engines/profiles/udio.json";

/**
 * Data checks on the handoff engine profiles until S2 adds the typed loader and schema.
 * `EngineField.order` is the paste order in the engine UI (scope v0.2 §2.2), so an export
 * pane that sorts by it walks the user through the real form.
 */
const profiles: Record<string, { fields: { order: number }[] }> = { suno, eleven, flow, udio };

describe("engine profiles", () => {
  it.each(Object.entries(profiles))("%s gives every field a distinct order", (_id, profile) => {
    const orders = profile.fields.map((field) => field.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it("orders Flow's Compose-sheet fields as its own verification recorded them", () => {
    const prefix = "Compose sheet field set and order:";
    const stated = flow.verification.verified.find((line) => line.startsWith(prefix)) ?? "";
    const sequence = stated.slice(prefix.length).split(",").map((label) => label.trim());
    expect(sequence.length).toBeGreaterThan(1);

    // The verified list also names controls that are not paste fields (Instrumental
    // toggle, Model selector); compare only the entries that are fields.
    const fieldLabels = new Set(flow.fields.map((field) => field.label));
    const expected = sequence.filter((label) => fieldLabels.has(label));
    const actual = [...flow.fields]
      .sort((a, b) => a.order - b.order)
      .map((field) => field.label)
      .filter((label) => sequence.includes(label));

    expect(actual).toEqual(expected);
  });
});
