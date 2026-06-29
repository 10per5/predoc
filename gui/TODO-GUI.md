# GUI Backend - Remaining Work

Audit of gaps between `editor/lib/endpoints.ts` (Node.js server) and `gui/src/scheme.cpp` (local in-process handler).

## High Priority

### ~~Content path normalization (auto-append `.md`)~~ DONE

### ~~Image serving: `GET /uploads/*`~~ DONE

### ~~Image upload: `POST /api/upload`~~ DONE

## Medium Priority

### ~~Image list: `GET /api/images?dir=&refs=`~~ DONE

### ~~Image delete: `DELETE /api/images/:name?dir=`~~ DONE

### ~~Orphaned image cleanup (on PUT / DELETE)~~ DONE

### ~~Move — copy+delete fallback~~ DONE

## Done

- **Tree** (`GET /api/tree`) — implemented and consistent.
- **Move** (`POST /api/move`) — implemented (per-file rename; cross-device fallback via copy+delete).
- **Content CRUD** (`GET/PUT/DELETE /content/*`) — implemented and consistent.
- **Search** (`POST /api/search`) — extracted to `search.h` + `search.cpp`.
- **Gitignore** — extracted to `gitignore.h` + `gitignore.cpp`.
- **Image serving** (`GET /uploads/*`) — implemented in `images.h` + `images.cpp` with path traversal protection, extension whitelist, `/image/` directory check.
- **Image upload** (`POST /api/upload`) — multipart/form-data parser, filename sanitization, `{ url }` JSON response.
- **Image list** (`GET /api/images?dir=&refs=`) — lists images, optional `usedIn` reference scanning.
- **Image delete** (`DELETE /api/images/:name?dir=`) — deletes single image with path traversal protection.
- **Content path normalization** — auto-appends `.md` when path has no extension.
- **Orphaned image cleanup** — removes unreferenced images after PUT/DELETE.
- **Cross-device rename** — `fs::rename` fallback to copy+delete on EXDEV.
