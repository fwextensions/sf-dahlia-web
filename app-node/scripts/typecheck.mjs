#!/usr/bin/env node
/*
 * Scoped typecheck for app-node.
 *
 * app-node renders the original Rails pages and imports the vendored @uic
 * barrel, both of which live in ../app/javascript. That tree is written against
 * the repo-root tsconfig (non-strict) and gets dragged into app-node's strict
 * program through those imports, producing ~400 errors that don't reflect a
 * real standard in this codebase. We can't simply relax strict here because
 * TanStack Router requires strictNullChecks.
 *
 * So we run the full strict `tsc --noEmit` (which still type-checks how app-node
 * *consumes* the Rails tree — any mismatch surfaces as an error in a src/ file)
 * and gate only on errors in app-node-owned files. Bridged-tree errors are
 * summarized, not failed on.
 *
 * Use `npm run typecheck:full` to see every error including the bridged tree.
 */
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const appNodeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tsc = path.join(appNodeRoot, "node_modules", "typescript", "bin", "tsc")

const result = spawnSync(process.execPath, [tsc, "--noEmit", "--pretty", "false"], {
  cwd: appNodeRoot,
  encoding: "utf8",
})

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
const errorLines = output.split(/\r?\n/).filter((l) => /error TS\d+:/.test(l))

// An app-node-owned error is one whose file path is NOT in the bridged Rails
// tree (../app/javascript) and NOT in node_modules.
const isBridged = (line) =>
  line.startsWith("../app/javascript") || line.includes("node_modules/")

const owned = errorLines.filter((l) => !isBridged(l))
const bridged = errorLines.filter(isBridged)

if (bridged.length > 0) {
  console.log(
    `note: suppressed ${bridged.length} type error(s) in the bridged Rails tree ` +
      `(../app/javascript, node_modules). Run \`npm run typecheck:full\` to see them.`
  )
}

if (owned.length > 0) {
  console.error(`\napp-node type errors (${owned.length}):\n`)
  for (const line of owned) console.error(line)
  process.exit(1)
}

console.log("app-node typecheck passed (0 errors in app-node-owned files).")
