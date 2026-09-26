"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

import { ModuleIcon, type ModuleKey } from "../icons/ModuleIcon";

/**
 * A composer module (docs/SPEC.md §1.5): a numbered, collapsible landmark. `details` keeps
 * the keyboard and screen-reader behaviour native. Its hue token and icon come from §1.9.
 */
export function Module({ number, icon, title, owns, open, children }: { number: number; icon: ModuleKey; title: string; owns: string; open?: boolean; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className="module" aria-labelledby={headingId} data-module={number} data-hue={icon} style={{ "--hue": `var(--mod-${icon})` } as CSSProperties}>
      <details open={open}>
        <summary>
          <ModuleIcon name={icon} className="module-icon" />
          <h2 id={headingId}>
            <span className="module-number">{number}</span> {title}
          </h2>
          <span className="module-owns">{owns}</span>
        </summary>
        <div className="module-body">{children}</div>
      </details>
    </section>
  );
}
