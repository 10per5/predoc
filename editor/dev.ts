import { spawn } from "child_process";
import { join } from "path";

const serve = spawn("bun", [join(import.meta.dir, "serve.ts")], {
  cwd: import.meta.dir,
  stdio: "inherit",
  shell: true,
});

const watch = spawn("bun", [
  "build", "src/app.ts", "--outdir", "public/assets", "--watch",
], {
  cwd: import.meta.dir,
  stdio: "inherit",
  shell: true,
});

for (const proc of [serve, watch]) {
  proc.on("exit", (code) => {
    serve.kill();
    watch.kill();
    process.exit(code ?? 0);
  });
}

process.on("SIGINT", () => {
  serve.kill();
  watch.kill();
  process.exit(0);
});

process.on("SIGTERM", () => {
  serve.kill();
  watch.kill();
  process.exit(0);
});
