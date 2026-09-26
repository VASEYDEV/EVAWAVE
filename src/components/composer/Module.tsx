"use client";

import { useId, type ReactNode } from "react";

/**
 * A composer module (docs/SPEC.md §1.5): a numbered, collapsible landmark. `details` keeps
 * the keyboard and screen-reader behaviour native.
 */
export function Module({ number, title, owns, open, children }: { number: number; title: string; owns: string; open?: boolean; children: ReactNode }) {
  const headingId = useId();
  return (
    <section className="module" aria-labelledby={headingId} data-module={number}>
      <details open={open}>
        <summary>
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
