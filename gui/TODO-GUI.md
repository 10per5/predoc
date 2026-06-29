# GUI Backend - Remaining Work

Audit of gaps between `editor/lib/endpoints.ts` (Node.js server) and `gui/src/scheme.cpp` (local in-process handler).

## High Priority

### Content path normalization (auto-append `.md`)

- **TS** `handleContent`: if the request path has no extension, appends `.md` automatically, so `GET /content/docs/quickstart` resolves to `content/docs/quickstart.md`.
- **C++**: rejects any path without `.md` extension with 404.

Send `HEAD /content/docs/quickstart` to get server time; the editor sends bare paths without `.md`.

### Image serving: `GET /uploads/*`

- **TS** `handleUploads`: serves image files from `content/.../image/` directory.
- **C++**: **missing**. The editor renders images via `<img src="/uploads/...">`. Without this, local mode shows broken images.

Needed for: image rendering in the editor. Requires:
- `resolveWithin` equivalent for path traversal safety
- MIME type for images (PNG, JPG, GIF, SVG, WebP, BMP, ICO)
- Check path includes `/image/`

### Image upload: `POST /api/upload`

- **TS** `handleUpload`: accepts `multipart/form-data` with `file` (image) + `dir` (doc subdirectory), saves to `content/<dir>/image/<sanitized-name>`, returns `{ url }`.
- **C++**: **missing**.

Needed for: paste/drag-drop images into the editor; image block upload.

## Medium Priority

### Image list: `GET /api/images?dir=&refs=`

- **TS** `handleListImages`: lists image files in `content/<dir>/image/`, optionally includes `usedIn` (list of `.md` files referencing each image).
- **C++**: **missing**.

Needed for: image manager dialog.

### Image delete: `DELETE /api/images/:name?dir=`

- **TS** `handleDeleteImage`: deletes a single image file from `content/<dir>/image/`.
- **C++**: **missing**.

Needed for: image manager dialog.

### Orphaned image cleanup (on PUT / DELETE)

- **TS** `removeOrphanedImages`: after a document is saved or deleted, scans its `image/` directory and removes image files not referenced in any `.md` file. Also cleans up empty parent directories.
- **C++**: **missing** from both PUT and DELETE handlers.

### Move — copy+delete fallback

- **TS** `handleMove`: `readFileSync` + `writeFileSync` + `rmSync` — works across filesystem boundaries.
- **C++**: `fs::rename` — fails with `EXDEV` when source and destination are on different mount points/volumes.

## Low Priority

### Path traversal — improve validation

- **TS**: `resolveWithin` using `path.resolve()` + `path.relative()` — canonical path resolution.
- **C++**: manual `".."` substring check. Adequate for local-only mode but less robust.

## Done

- **Tree** (`GET /api/tree`) — implemented and consistent.
- **Move** (`POST /api/move`) — implemented (per-file rename; see note above about cross-device).
- **Content CRUD** (`GET/PUT/DELETE /content/*`) — implemented and consistent.
- **Search** (`POST /api/search`) — extracted to `search.h` + `search.cpp`.
- **Gitignore** — extracted to `gitignore.h` + `gitignore.cpp`.
