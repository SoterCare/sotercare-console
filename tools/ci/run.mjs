import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const quick = args.includes("--quick");
const dry = args.includes("--dry-run");
const steps = quick ? ["lint", "typecheck"] : ["lint", "typecheck", "test", "build"];

if (process.env.CI === "true" && !process.env.NPM_TOKEN) {
  console.error("NPM_TOKEN is not set");
  process.exit(1);
}

for (const name of steps) {
  console.log(`::serenedge-step name=${name} status=start::`);
  const r = dry
    ? { status: 0 }
    : spawnSync("npm", ["run", name], { stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.log(`::serenedge-step name=${name} status=fail::`);
    process.exit(r.status ?? 1);
  }
  console.log(`::serenedge-step name=${name} status=pass::`);
}
