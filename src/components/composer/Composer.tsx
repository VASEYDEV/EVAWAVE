"use client";

/**
 * The composer (docs/SPEC.md §1.5, §3 S3): the eleven modules in Style-priority order, with
 * live budgets, lint, coverage, export and history beside them. Compile and lint re-run on
 * every change for the active target; switching target is a view, never a mutation (A5).
 */
import { useEffect, useMemo } from "react";

import { ENGINE_PROFILES } from "@/core/musicspec/engines";
import { lint } from "@/core/musicspec/lint";
import { compile } from "@/core/musicspec/serialize";

import { DrumGrammarModule, EngineFormModule, InstrumentsModule, KeyModeModule, MoodModule, OutputModule, RegionalBundleModule, TechniqueModule, TexturesModule } from "./modules";
import { BudgetMeters, CoveragePanel, ExportPane, HistoryPanel, LintPanel } from "./panels";
import { SectionsModule, TransitionsModule } from "./sections";
import { ComposerProvider, useComposer } from "./state";

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

function Workspace() {
  const { spec, catalog, undo, redo } = useComposer();
  const profile = ENGINE_PROFILES[spec.D10.activeTarget];
  const result = useMemo(() => compile(spec, spec.D10.activeTarget, catalog), [spec, catalog]);
  const results = useMemo(() => lint(spec, profile, catalog, result.ok ? result.payload : undefined), [spec, profile, catalog, result]);

  // Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z outside text entry, where the browser's own undo applies.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" || isEditable(event.target)) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="workspace">
      <div className="modules">
        <EngineFormModule />
        <KeyModeModule />
        <DrumGrammarModule />
        <RegionalBundleModule />
        <InstrumentsModule />
        <TechniqueModule />
        <TexturesModule />
        <TransitionsModule />
        <SectionsModule />
        <MoodModule />
        <OutputModule />
      </div>
      <aside className="panels" aria-label="Compile, lint and history">
        <HistoryPanel />
        {result.ok ? <BudgetMeters payload={result.payload} profile={profile} /> : null}
        <LintPanel results={results} />
        {result.ok ? <CoveragePanel payload={result.payload} /> : null}
        <ExportPane result={result} profile={profile} />
      </aside>
    </div>
  );
}

export function Composer() {
  return (
    <ComposerProvider>
      <Workspace />
    </ComposerProvider>
  );
}
