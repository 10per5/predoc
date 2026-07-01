---
title: "Markdown Alerts"
weight: 10
---

# Markdown Alerts

The editor supports GitHub-style markdown alerts (also known as admonitions). These render as colored callout blocks in the WYSIWYG editor matching the Hugo Book theme's `.book-hint` styling.

## Syntax

```markdown
> [!NOTE]
> Useful information that users should know.

> [!TIP]
> Helpful advice for doing things better.

> [!IMPORTANT]
> Key information users need to know.

> [!WARNING]
> Urgent info that needs immediate attention.

> [!CAUTION]
> Advises about risks or negative outcomes.
```

## Supported Types

`note`, `tip`, `important`, `warning`, `caution`, `info`, `success`, `danger`

All types render as colored callout blocks in both the editor and the Hugo site.
