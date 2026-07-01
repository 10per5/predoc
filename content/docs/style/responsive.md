---
title: "Responsive Design"
weight: 10
---

# Responsive Design

The editor adapts to different screen sizes while maintaining a consistent editing experience.

## Breakpoints

| Viewport | Width          | Behavior                           |
| -------- | -------------- | ---------------------------------- |
| Mobile   | < 768px        | Panels hidden, touch-optimized     |
| Tablet   | 768px – 1199px | Sidebar visible, meta-panel hidden |
| Desktop  | ≥ 1200px       | All panels visible                 |

## Panel Behavior

- **Sidebar** — visible on desktop/tablet (260px left), hidden on mobile with hamburger menu (slides in + backdrop)
- **Meta panel** — visible on desktop (240px right), hidden on tablet/mobile with gear icon (slides in)

## Editor Features

### Block Handles

- **Desktop**: shown on hover in left margin
- **Mobile**: tap block to reveal handles; 44×44px minimum touch targets

### Drag & Drop

- **Desktop**: drag blocks using handle with drop indicator
- **Mobile**: tap-to-select block; long-press drag and swipe gestures (planned)

See [Editor Features](/docs/style/features) for Command Menu and @ Mentions.

## Guidelines

- **Mobile-first**: design for mobile viewport first, enhance for larger screens
- **Touch targets**: minimum 44×44px for interactive elements
- **Units**: use `rem` for spacing and sizing; `px` breakpoints in media queries (`768px`, `1200px`)
- **Viewport detection**: use `UIControllerAPI` from `ui_controller.ts` — `ui?.isMobile()` for mobile-specific behavior
- **Panel visibility**: driven by CSS custom properties (`--sidebar-width`, etc.) in `responsive.css`
