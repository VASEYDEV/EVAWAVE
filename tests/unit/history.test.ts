import { describe, expect, it } from "vitest";

import { branchTips, canRedo, canUndo, commit, emptyHistory, jumpTo, redo, undo, type Step } from "@/core/musicspec/history";
import { defaultMusicSpec, defaultSection } from "@/core/musicspec/ir/defaults";
import type { MusicSpec, PatchOp } from "@/core/musicspec/ir/types";

const set = (path: string, value: unknown): PatchOp => ({ op: "set", path, value, confidence: 1, rationale: "test" });

function edits(start: Step<MusicSpec>, list: [string, unknown][]): Step<MusicSpec> {
  return list.reduce((step, [path, value]) => commit(step.history, step.spec, [set(path, value)], path), start);
}

describe("history", () => {
  const start: Step<MusicSpec> = { history: emptyHistory(), spec: defaultMusicSpec() };

  it("undo walks every edit back to the starting spec, and redo restores it", () => {
    const built = edits(start, [
      ["/D6/tempo/bpm", 140],
      ["/D7/sections/0", defaultSection("hook-b", "hook", "Hook B")],
      ["/D7/sections/0/bars", 16],
      ["/D10/title", "Invented Title"],
    ]);
    let step = built;
    while (canUndo(step.history)) step = undo(step.history, step.spec);
    expect(step.spec).toEqual(defaultMusicSpec());
    while (canRedo(step.history)) step = redo(step.history, step.spec);
    expect(step.spec).toEqual(built.spec);
  });

  it("keeps an undone branch reachable after a new edit", () => {
    const a = edits(start, [["/D6/tempo/bpm", 140], ["/D10/title", "Branch A"]]);
    const undone = undo(a.history, a.spec);
    const b = commit(undone.history, undone.spec, [set("/D10/title", "Branch B")], "title");
    expect(b.spec.D10.title).toBe("Branch B");
    expect(branchTips(b.history)).toHaveLength(2);
    const branchA = branchTips(b.history).find((n) => n.id !== b.history.cursor);
    const back = jumpTo(b.history, b.spec, branchA?.id ?? -1);
    expect(back.spec).toEqual(a.spec);
    expect(jumpTo(back.history, back.spec, b.history.cursor).spec).toEqual(b.spec);
  });

  it("redo takes the newest branch by default, or the one asked for", () => {
    const a = edits(start, [["/D10/title", "First"]]);
    const u1 = undo(a.history, a.spec);
    const b = commit(u1.history, u1.spec, [set("/D10/title", "Second")], "title");
    const u2 = undo(b.history, b.spec);
    expect(redo(u2.history, u2.spec).spec.D10.title).toBe("Second");
    const first = u2.history.nodes[0]?.children[0] ?? -1;
    expect(redo(u2.history, u2.spec, first).spec.D10.title).toBe("First");
  });

  it("folds typing into one undo step with coalesce, and only while it is the latest edit", () => {
    let step = start;
    for (const text of ["I", "In", "Inv"]) step = commit(step.history, step.spec, [set("/D10/title", text)], "title", { coalesce: "/D10/title" });
    expect(step.history.nodes).toHaveLength(2);
    expect(undo(step.history, step.spec).spec).toEqual(defaultMusicSpec());
    // Another field seals the node; typing into the title again is a new step.
    step = commit(step.history, step.spec, [set("/D6/tempo/bpm", 90)], "bpm", { coalesce: "/D6/tempo/bpm" });
    step = commit(step.history, step.spec, [set("/D10/title", "Invented")], "title", { coalesce: "/D10/title" });
    expect(step.history.nodes).toHaveLength(4);
    // After an undo, the node is sealed too.
    const u = undo(step.history, step.spec);
    const r = redo(u.history, u.spec);
    const again = commit(r.history, r.spec, [set("/D10/title", "Invented2")], "title", { coalesce: "/D10/title" });
    expect(again.history.nodes).toHaveLength(5);
  });

  it("is append-only: no operation removes a node", () => {
    let step = edits(start, [["/D10/title", "A"], ["/D6/tempo/bpm", 100]]);
    step = undo(step.history, step.spec);
    step = commit(step.history, step.spec, [set("/D6/tempo/bpm", 101)], "bpm");
    step = undo(step.history, step.spec);
    step = undo(step.history, step.spec);
    expect(step.history.nodes).toHaveLength(4);
  });

  it("walks random edit sequences back to the start exactly (seeded)", () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let run = 0; run < 25; run++) {
      let step = start;
      for (let i = 0; i < 20; i++) {
        const choice = rand();
        if (choice < 0.2 && canUndo(step.history)) step = undo(step.history, step.spec);
        else if (choice < 0.3 && canRedo(step.history)) step = redo(step.history, step.spec);
        else step = commit(step.history, step.spec, [set("/D6/tempo/bpm", 60 + Math.floor(rand() * 100)), set(`/D2/imagery/${step.spec.D2.imagery.length}`, `img${i}`)], `e${i}`);
      }
      while (canUndo(step.history)) step = undo(step.history, step.spec);
      expect(step.spec).toEqual(defaultMusicSpec());
    }
  });
});
