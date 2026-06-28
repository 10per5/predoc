import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join, extname, dirname } from "path";

export interface ServerContext {
  contentDir: string;
  disableApi: boolean;
  noIgnore: boolean;
  treeDepth: number;
}

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

// ── Content API ──────────────────────────────────────────────────────────

async function handleContent(req: Request, relPath: string, ctx: ServerContext): Promise<Response | null> {
  const filePath = join(ctx.contentDir, relPath);
  const hasExt = !!extname(filePath);
  const target = hasExt ? filePath : filePath + ".md";

  if (!target.endsWith(".md")) {
    return new Response(null, { status: 404 });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    if (!existsSync(target)) return new Response(null, { status: 404 });
    if (req.method === "HEAD") return new Response(null, { status: 200 });
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
    while (dir.startsWith(ctx.contentDir)) {
      const entries = readdirSync(dir);
      if (entries.length > 0) break;
      rmSync(dir, { force: true });
      dir = dirname(dir);
    }
    return new Response("ok");
  }

  return new Response(null, { status: 405 });
}

function handleTree(ctx: ServerContext): Response | null {
  const giPatterns = ctx.noIgnore ? [] : loadGitignore(ctx.contentDir);
  return new Response(JSON.stringify(buildTree(ctx.contentDir, giPatterns, ctx.treeDepth, 0, ctx.noIgnore)), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleUpload(req: Request, ctx: ServerContext): Promise<Response | null> {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const docDir = form.get("dir") as string | null;

  if (!file) return new Response("No file", { status: 400 });

  const ext = extname(file.name) || ".png";
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const targetDir = docDir ? join(ctx.contentDir, docDir, "image") : join(ctx.contentDir, "image");
  const targetPath = join(targetDir, name);

  mkdirSync(targetDir, { recursive: true });
  const buf = await file.arrayBuffer();
  writeFileSync(targetPath, new Uint8Array(buf));

  const url = docDir ? `image/${name}` : `/uploads/${name}`;
  return new Response(JSON.stringify({ url }), {
    headers: { "Content-Type": "application/json" },
  });
}

function handleUploads(relPath: string, ctx: ServerContext): Response | null {
  const filePath = join(ctx.contentDir, relPath);
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath);
  return new Response(raw, {
    headers: { "Content-Type": contentType(filePath) },
  });
}

async function handleMove(req: Request, ctx: ServerContext): Promise<Response | null> {
  const { from, to } = await req.json();
  const src = join(ctx.contentDir, from.replace(/^\//, ""));
  const dst = join(ctx.contentDir, to.replace(/^\//, ""));

  if (!existsSync(src)) return new Response("Source not found", { status: 404 });
  if (existsSync(dst)) return new Response("Destination exists", { status: 409 });

  mkdirSync(dirname(dst), { recursive: true });
  const text = readFileSync(src, "utf-8");
  writeFileSync(dst, text, "utf-8");
  rmSync(src, { force: true });

  let dir = dirname(src);
  while (dir.startsWith(ctx.contentDir)) {
    const entries = readdirSync(dir);
    if (entries.length > 0) break;
    rmSync(dir, { force: true });
    dir = dirname(dir);
  }

  return new Response("ok");
}

// ── Public API ───────────────────────────────────────────────────────────

export async function handleApiRoutes(
  req: Request,
  path: string,
  ctx: ServerContext
): Promise<Response | null> {
  if (ctx.disableApi) return null;

  if (path === "/content" || path.startsWith("/content/")) {
    const relPath = path.slice("/content/".length);
    return handleContent(req, relPath, ctx);
  }

  if (path === "/api/tree") {
    return handleTree(ctx);
  }

  if (path === "/api/upload" && req.method === "POST") {
    return handleUpload(req, ctx);
  }

  if (path.startsWith("/uploads/") && req.method === "GET") {
    const relPath = path.slice("/uploads/".length);
    return handleUploads(relPath, ctx);
  }

  if (path === "/api/move" && req.method === "POST") {
    return handleMove(req, ctx);
  }

  return null;
}
