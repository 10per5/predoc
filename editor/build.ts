import { join } from "path";

const watch = process.argv.includes("--watch");
const url = process.env.LIVE_URL_BASE;
const selfBase = process.env.EDITOR_SELF_BASE;
const args = ["build", "src/app.ts", "--outdir", "public/assets", "--minify"];
if (url) args.push(`--define:LIVE_URL_BASE=${JSON.stringify(url)}`);
if (selfBase) args.push(`--define:EDITOR_SELF_BASE=${JSON.stringify(selfBase)}`);
if (watch) args.push("--watch");

const result = Bun.spawnSync(["bun", ...args], {
  cwd: import.meta.dir,
  stdio: ["inherit", "inherit", "inherit"],
});
process.exit(result.exitCode);
