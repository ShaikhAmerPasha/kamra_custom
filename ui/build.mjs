// Build Kamra's own front end with our patches and new files applied.
//
//   node ui/build.mjs            build into kamra_custom/public/kamra-ui
//   node ui/build.mjs --check    apply the patches to a scratch copy and stop
//
// Kamra's source is never edited: it is copied to ui/.build, patched there, and
// built there. A patch that no longer fits a new Kamra release stops the build
// with the file and hunk, and the stock Kamra page keeps serving.

import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(here, "..")
const kamraFrontend = process.env.KAMRA_FRONTEND || path.resolve(appRoot, "../kamra/frontend")
const work = path.join(here, ".build")
const out = path.join(appRoot, "kamra_custom", "public", "kamra-ui")
const checkOnly = process.argv.includes("--check")

const fail = (msg) => {
  console.error(`\nBUILD STOPPED: ${msg}`)
  process.exit(1)
}
const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts })
  if (r.status !== 0) fail(`${cmd} ${args.join(" ")} exited with ${r.status}`)
}

if (!existsSync(path.join(kamraFrontend, "package.json"))) fail(`Kamra's frontend not found at ${kamraFrontend}`)
if (!existsSync(path.join(kamraFrontend, "package-lock.json"))) fail("Kamra's package-lock.json is missing.")

// 1. a clean copy of Kamra's source (no dependencies, no build output)
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
const skip = new Set(["node_modules", "dist", "tsconfig.tsbuildinfo", ".vite"])
cpSync(kamraFrontend, work, { recursive: true, filter: (src) => !skip.has(path.basename(src)) })
console.log(`copied Kamra's frontend from ${kamraFrontend}`)

// Dependencies come from Kamra's own lock file, installed once per lock file
// into ui/.deps. Kamra's working copy of node_modules is not used: it can be
// behind its package.json, and we must not change it.
const lockHash = createHash("sha1").update(readFileSync(path.join(kamraFrontend, "package-lock.json"))).digest("hex").slice(0, 12)
const deps = path.join(here, ".deps", lockHash)
if (!existsSync(path.join(deps, "node_modules", ".bin", "vite"))) {
  console.log(`installing Kamra's dependencies (lock ${lockHash})...`)
  rmSync(path.join(here, ".deps"), { recursive: true, force: true })
  mkdirSync(deps, { recursive: true })
  for (const f of ["package.json", "package-lock.json"]) copyFileSync(path.join(kamraFrontend, f), path.join(deps, f))
  run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: deps })
}
symlinkSync(path.join(deps, "node_modules"), path.join(work, "node_modules"), "dir")

// 2. our patches, in order. Dry run first so a failure leaves nothing half applied.
const patchDir = path.join(here, "patches")
const patches = readdirSync(patchDir).filter((f) => f.endsWith(".patch")).sort()
for (const p of patches) {
  const file = path.join(patchDir, p)
  // --fuzz=0: a hunk must match its context exactly. A loose match could land in the
  // wrong place after a Kamra update and still report success.
  const args = ["--forward", "--fuzz=0", "--no-backup-if-mismatch", "-p1", "-d", work, "-i", file]
  const dry = spawnSync("patch", ["--dry-run", ...args], { encoding: "utf8" })
  if (dry.status !== 0) {
    console.error(dry.stdout + dry.stderr)
    fail(`patch ${p} does not apply to this version of Kamra. Update it, then build again.`)
  }
  run("patch", args)
  console.log(`applied ${p}`)
}
console.log(`${patches.length} patch(es) applied`)

// 3. our own new files, laid over the source
const overlay = path.join(here, "overlay")
if (readdirSync(overlay).some((f) => !f.startsWith("."))) cpSync(overlay, work, { recursive: true })

if (checkOnly) {
  console.log("check passed")
  process.exit(0)
}

// 4. build the way Kamra does (type check, then bundle), into our app
const bin = (name) => path.join(work, "node_modules", ".bin", name)
run(bin("tsc"), ["-b"], { cwd: work })
run(bin("vite"), ["build", "--base", "/assets/kamra_custom/kamra-ui/", "--outDir", out, "--emptyOutDir"], { cwd: work })
if (!statSync(path.join(out, "index.html")).isFile()) fail("no index.html was produced")
console.log(`\nbuilt ${out}`)
