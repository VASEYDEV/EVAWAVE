import { describe, expect, it } from "vitest";

import eleven from "@/core/musicspec/engines/profiles/eleven.json";
import flow from "@/core/musicspec/engines/profiles/flow.json";
import suno from "@/core/musicspec/engines/profiles/suno.json";
import udio from "@/core/musicspec/engines/profiles/udio.json";

/**
 * Data checks on the handoff engine profiles. The typed loader (`validateProfile`) checks
 * their shape at import; these check the cross-field rules.
 * `EngineField.order` is the paste order in the engine UI (scope v0.2 §2.2), so an export
 * pane that sorts by it walks the user through the real form.
 */
interface ProfileField {
  id: string;
  kind: string;
  order: number;
  hardLimit?: number;
  softLimit?: number;
  min?: number;
  max?: number;
}

const profiles: Record<string, { fields: ProfileField[] }> = { suno, eleven, flow, udio };

describe("engine profiles", () => {
  it.each(Object.entries(profiles))("%s gives every field a distinct order", (_id, profile) => {
    const orders = profile.fields.map((field) => field.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it.each(Object.entries(profiles))(
    "%s keeps character caps on text fields and numeric bounds on number fields",
    (_id, profile) => {
      // hardLimit/softLimit are character caps (scope v0.2 §2.2), so a numeric range
      // stored there would be measured as a string length by BG-1.
      for (const field of profile.fields) {
        const hasCharacterCap = field.hardLimit !== undefined || field.softLimit !== undefined;
        const hasNumericBound = field.min !== undefined || field.max !== undefined;
        expect({ field: field.id, kind: hasCharacterCap ? field.kind : "text" }).toEqual({ field: field.id, kind: "text" });
        expect({ field: field.id, kind: hasNumericBound ? field.kind : "number" }).toEqual({ field: field.id, kind: "number" });
        if (field.min !== undefined && field.max !== undefined) {
          expect(field.min).toBeLessThanOrEqual(field.max);
        }
      }
    },
  );

  it("bounds Eleven's music_length_ms to its verified 3,000–600,000 ms", () => {
    const length = eleven.fields.find((field) => field.id === "music_length_ms") as ProfileField | undefined;
    expect(length).toMatchObject({ kind: "number", min: 3000, max: 600000 });
    expect(length?.hardLimit).toBeUndefined();
    expect(eleven.verification.verified).toContain("music_length_ms from 3,000 to 600,000; sections 3 s to 2 min each (API marketing page)");
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
