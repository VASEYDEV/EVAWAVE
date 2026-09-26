import { createElement, type SVGProps } from "react";

import source from "../../../assets/icons/modules.json";

/** The per-module icons and hues (docs/SPEC.md §1.9). Icons are provisional (see modules.json). */
export type ModuleKey = keyof typeof source.icons;

type Shape = [string, Record<string, string>];

/**
 * A module's monoline icon, drawn inline so its stroke takes the colour the brand system sets
 * (`currentColor`; ADR 0005).
 * Decorative: the module heading carries the name, so the icon is hidden from assistive tech.
 */
export function ModuleIcon({ name, ...props }: { name: ModuleKey } & SVGProps<SVGSVGElement>) {
  const shapes = source.icons[name] as Shape[];
  return (
    <svg
      viewBox={source.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={source.strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-module-icon={name}
      {...props}
    >
      {shapes.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
