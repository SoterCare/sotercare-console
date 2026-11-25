import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = (args, env = {}) =>
  spawnSync(process.execPath, ["tools/ci/run.mjs", ...args], {
    encoding: "utf8",
    env: { ...process.env, CI: "", NPM_TOKEN: "", ...env },
  });

test("ci run prints a start and pass marker per step", () => {
  const r = run(["--dry-run"]);
  assert.equal(r.status, 0);
  const steps = ["lint", "typecheck", "test", "build"];
  const found = [...r.stdout.matchAll(/::serenedge-step name=(\w+) status=(start|pass)::/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(found, steps.flatMap((s) => [`${s}:start`, `${s}:pass`]));
});

test("ci run --quick runs lint and typecheck only", () => {
  const r = run(["--dry-run", "--quick"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /name=typecheck status=pass/);
  assert.doesNotMatch(r.stdout, /name=build/);
});

test("ci run fails fast without npm token", () => {
  const r = run(["--dry-run"], { CI: "true" });
  assert.notEqual(r.status, 0);
  assert.match(r.stdout + r.stderr, /NPM_TOKEN is not set/);
});
