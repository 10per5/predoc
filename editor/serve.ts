import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, rmSync, writeFileSync, copyFileSync } from "fs";
import { join, extname, dirname } from "path";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const DISABLE_CONTENT_API = process.env.DISABLE_CONTENT_API === "1" || process.env.DISABLE_CONTENT_API === "true";
const NO_IGNORE = process.env.NO_IGNORE === "1" || process.env.NO_IGNORE === "true";
const TREE_DEPTH = parseInt(process.env.TREE_DEPTH || "0", 10) || 0;

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const EDITOR_DIR = join(SCRIPT_DIR, "public");
const CONTENT_DIR = process.env.PREDOC_CONTENT || join(SCRIPT_DIR, "..", "content");

const STATIC_DIR = join(SCRIPT_DIR, "static");

function copyEditorStatic() {
  if (!existsSync(STATIC_DIR)) return;
  mkdirSync(EDITOR_DIR, { recursive: true });
  for (const name of readdirSync(STATIC_DIR)) {
    if (name.startsWith(".")) continue;
    const src = join(STATIC_DIR, name);
    const dst = join(EDITOR_DIR, name);
    if (statSync(src).isDirectory()) continue;
    if (!existsSync(dst)) copyFileSync(src, dst);
  }
}

copyEditorStatic();

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/markdown",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function contentType(path: string): string {
  const ext = extname(path);
  return MIME[ext] || "application/octet-stream";
}

function extractWeight(filePath: string): number | undefined {
  try {
    const content = readFileSync(filePath, "utf-8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (match) {
      const weightMatch = match[1].match(/^weight:\s*(\d+)/m);
      if (weightMatch) return parseInt(weightMatch[1], 10);
    }
  } catch {}
  return undefined;
}

// ── gitignore helpers ────────────────────────────────────────────────────

interface GitIgnorePattern {
  pattern: string
  negate: boolean
  dirOnly: boolean
  anchored: boolean
}

function loadGitignore(dir: string): GitIgnorePattern[] {
  const giPath = join(dir, ".gitignore");
  if (!existsSync(giPath)) return [];
  const content = readFileSync(giPath, "utf-8");
  const patterns: GitIgnorePattern[] = [];
  for (let line of content.split("\n")) {
    line = line.trimEnd();
    if (!line || line.startsWith("#")) continue;
    let negate = false;
    if (line.startsWith("!")) { negate = true; line = line.slice(1); }
    let dirOnly = false;
    if (line.endsWith("/")) { dirOnly = true; line = line.slice(0, -1); }
    if (!line) continue;
    patterns.push({ pattern: line, negate, dirOnly, anchored: line.includes("/") });
  }
  return patterns;
}

function globMatch(pat: string, pi: number, str: string, si: number): boolean {
  for (;;) {
    if (pi === pat.length && si === str.length) return true;
    if (pi + 1 < pat.length && pat[pi] === "*" && pat[pi + 1] === "*") {
      pi += 2;
      if (pi === pat.length) return true;
      for (let i = si; i <= str.length; i++)
        if (globMatch(pat, pi, str, i)) return true;
      return false;
    }
    if (pi < pat.length && pat[pi] === "*") {
      pi++;
      for (let i = si; i <= str.length; i++) {
        if (i > si && str[i - 1] === "/") break;
        if (globMatch(pat, pi, str, i)) return true;
      }
      return false;
    }
    if (pi < pat.length && pat[pi] === "?") {
      if (si >= str.length || str[si] === "/") return false;
      pi++; si++; continue;
    }
    if (pi < pat.length && si < str.length && pat[pi] === str[si]) {
      pi++; si++; continue;
    }
    return false;
  }
}

function isIgnored(
  name: string, isDir: boolean, patterns: GitIgnorePattern[]
): boolean {
  let ignored = false;
  for (const p of patterns) {
    if (p.dirOnly && !isDir) continue;
    let matched = false;
    if (p.anchored) {
      matched = globMatch(p.pattern, 0, name, 0);
    } else {
      const slash = name.lastIndexOf("/");
      const base = slash === -1 ? name : name.slice(slash + 1);
      matched = globMatch(p.pattern, 0, base, 0);
    }
    if (matched) ignored = !p.negate;
  }
  return ignored;
}

// ── tree builder ─────────────────────────────────────────────────────────

function buildTree(
  dir: string,
  giPatterns: GitIgnorePattern[] = [],
  depth: number = 0,
  currentDepth: number = 0,
  noIgnore: boolean = false,
  relPrefix: string = ""
): Record<string, any> {
  const result: Record<string, any> = {};
  if (!existsSync(dir)) return result;
  const recurse = depth === 0 || currentDepth < depth;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue;
    const full = join(dir, name);
    const relPath = relPrefix ? `${relPrefix}/${name}` : name;
    const stat = statSync(full);
    const isDir = stat.isDirectory();

    if (!noIgnore && isIgnored(relPath, isDir, giPatterns)) continue;

    if (isDir) {
      if (!recurse) continue;
      const childGi = loadGitignore(full);
      const merged = [...giPatterns, ...childGi];
      const childRel = relPrefix ? `${relPrefix}/${name}` : name;
      const children = buildTree(full, merged, depth, currentDepth + 1, noIgnore, childRel);
      if (Object.keys(children).length > 0) result[name] = children;
    } else if (name.endsWith(".md")) {
      const weight = extractWeight(full);
      result[name] = weight != null ? { weight } : null;
    }
  }
  return result;
}

Bun.serve({
  port: PORT,
  hostname: HOST,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/content" || path.startsWith("/content/")) {
      if (DISABLE_CONTENT_API) {
        return new Response(null, { status: 404 });
      }
      const relPath = path.slice("/content/".length);
      const filePath = join(CONTENT_DIR, relPath);
      const hasExt = !!extname(filePath);
      const target = hasExt ? filePath : filePath + ".md";

      if (!target.endsWith(".md")) {
        return new Response(null, { status: 404 });
      }

      if (req.method === "GET") {
        if (!existsSync(target)) return new Response(null, { status: 404 });
        const content = readFileSync(target);
        return new Response(content, {
          headers: { "Content-Type": "text/markdown" },
        });
      }

      if (req.method === "PUT") {
        const text = await req.text();
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, text, "utf-8");
        return new Response("ok");
      }

      if (req.method === "DELETE") {
        if (!existsSync(target)) return new Response(null, { status: 404 });
        rmSync(target, { force: true });
        let dir = dirname(target);
        while (dir.startsWith(CONTENT_DIR)) {
          const entries = readdirSync(dir);
          if (entries.length > 0) break;
          rmSync(dir, { force: true });
          dir = dirname(dir);
        }
        return new Response("ok");
      }

      return new Response(null, { status: 405 });
    }

    if (path === "/api/tree") {
      if (DISABLE_CONTENT_API) {
        return new Response(null, { status: 404 });
      }
      const giPatterns = NO_IGNORE ? [] : loadGitignore(CONTENT_DIR);
      return new Response(JSON.stringify(buildTree(CONTENT_DIR, giPatterns, TREE_DEPTH, 0, NO_IGNORE)), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (path === "/api/move" && req.method === "POST") {
      if (DISABLE_CONTENT_API) {
        return new Response(null, { status: 404 });
      }
      const { from, to } = await req.json();
      const src = join(CONTENT_DIR, from.replace(/^\//, ""));
      const dst = join(CONTENT_DIR, to.replace(/^\//, ""));

      if (!existsSync(src)) return new Response("Source not found", { status: 404 });
      if (existsSync(dst)) return new Response("Destination exists", { status: 409 });

      mkdirSync(dirname(dst), { recursive: true });
      const text = readFileSync(src, "utf-8");
      writeFileSync(dst, text, "utf-8");
      rmSync(src, { force: true });

      let dir = dirname(src);
      while (dir.startsWith(CONTENT_DIR)) {
        const entries = readdirSync(dir);
        if (entries.length > 0) break;
        rmSync(dir, { force: true });
        dir = dirname(dir);
      }

      return new Response("ok");
    }

    const editorPath = join(EDITOR_DIR, path === "/" ? "index.html" : path);
    if (existsSync(editorPath)) {
      return new Response(readFileSync(editorPath), {
        headers: { "Content-Type": contentType(editorPath) },
      });
    }

    const fallback = join(EDITOR_DIR, "index.html");
    return new Response(readFileSync(fallback), {
      headers: { "Content-Type": contentType(fallback) },
    });
  },
});

console.log(`Editor server → http://${HOST}:${PORT}`);
