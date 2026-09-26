import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * docs/SPEC.md §2.2 is the MusicSpec IR v1 type definition (ADR 0004). These checks keep
 * the spec's claims true as it changes: the type block is complete and self-contained,
 * every type listed under "Defined, not inherited" exists, the worked example is a valid
 * Section, and the example's Suno compile is text from the Jinn v1.2 ground-truth file.
 */
const repoFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const spec = readFileSync(repoFile("docs/SPEC.md"), "utf8");
const jinn = readFileSync(repoFile("docs/evawave/reference/jinn-v1.2-condensed.md"), "utf8");

/** Fenced code blocks by info string, parsed line by line so closing fences never open a block. */
function fenced(language: string): string[] {
  const blocks: string[] = [];
  let open: { language: string; lines: string[] } | null = null;
  for (const line of spec.split("\n")) {
    if (open === null && line.startsWith("```")) {
      open = { language: line.slice(3).trim(), lines: [] };
    } else if (open !== null && line === "```") {
      if (open.language === language) blocks.push(open.lines.join("\n"));
      open = null;
    } else if (open !== null) {
      open.lines.push(line);
    }
  }
  return blocks;
}

const typeBlock = fenced("ts").join("\n");

/** Type-checks `source` as one standalone module with the repo's strictness settings. */
function diagnosticsFor(source: string): string[] {
  const fileName = "spec-types.ts";
  const options: ts.CompilerOptions = {
    strict: true,
    noUncheckedIndexedAccess: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const defaultGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError) =>
    name === fileName
      ? ts.createSourceFile(name, source, languageVersion, true)
      : defaultGetSourceFile(name, languageVersion, onError);
  const defaultFileExists = host.fileExists.bind(host);
  host.fileExists = (name) => name === fileName || defaultFileExists(name);
  const program = ts.createProgram([fileName], options, host);
  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
}

function declaredNames(source: string): Set<string> {
  const file = ts.createSourceFile("names.ts", source, ts.ScriptTarget.ES2022, true);
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      names.add(statement.name.text);
    }
  }
  return names;
}

describe("docs/SPEC.md MusicSpec IR v1", () => {
  it("has one TypeScript type block with no imports", () => {
    expect(fenced("ts")).toHaveLength(1);
    expect(typeBlock).not.toMatch(/^\s*import\s/m);
    expect(typeBlock).not.toMatch(/\bfrom\s+['"]/);
  });

  it("type-checks standalone under strict settings", () => {
    expect(diagnosticsFor(typeBlock)).toEqual([]);
  });

  it("declares every type named under 'Defined, not inherited'", () => {
    const section = spec.split("### 2.9 Defined, not inherited")[1]?.split("\n---\n")[0] ?? "";
    expect(section).not.toBe("");
    const listed = new Set<string>();
    for (const line of section.split("\n")) {
      // First cell only, minus "(was `OldName`)" notes, which name the v0.3 original.
      const firstCell = line.startsWith("| `") ? (line.split("|")[1] ?? "").replace(/\([^)]*\)/g, "") : "";
      for (const match of firstCell.matchAll(/`([A-Za-z]+)`/g)) {
        if (match[1]) listed.add(match[1]);
      }
    }
    expect(listed.size).toBeGreaterThan(30);
    const declared = declaredNames(typeBlock);
    expect([...listed].filter((name) => !declared.has(name))).toEqual([]);
  });

  it("gives a worked example that is a valid Section", () => {
    const [example] = fenced("json");
    expect(example).toBeDefined();
    expect(diagnosticsFor(`${typeBlock}\nexport const example: Section = ${example};\n`)).toEqual([]);
  });

  it("shows a Suno compile that is verbatim Jinn v1.2 Lyrics text", () => {
    const compile = fenced("").find((block) => block.includes("[Hook – harder"));
    expect(compile).toBeDefined();
    expect(jinn).toContain(compile);
  });
});
