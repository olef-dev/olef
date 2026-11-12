# Olef brand kit

New logo from the owner, 2026-11-11 (sources: the owner's Inkscape files).
Internal: these files are the source for every surface's logo, icons and colors.

| File | Use |
| --- | --- |
| `olef-mark.svg` | The bird mark, navy body, for light backgrounds. App icons, small spaces. |
| `olef-mark-ice.svg` | The bird mark, ice body, for navy or dark backgrounds. |
| `olef-wordmark.svg` | The lockup (the bird is the O of "Olef"), body in `currentColor`, beak amber. `-navy` and `-white` (ice) variants for raster tools. |
| `olef-logo-on-light.svg` / `olef-logo-on-dark.svg` | The lockup in navy / ice. Same artwork as the wordmark variants. |
| `olef-favicon.svg` | Simplified small-size bird for 16–32 px: navy, ice-white when the system is dark. |
| `olef-favicon.ico` | 16/32/48 px navy favicon (16 px hand-tuned by the owner). |
| `tokens.css` | Colors and type, dark (the brand's own) and light (derived). |

Rules:

- Logo colors: body navy `#074496` on light, ice `#e8f1ff` on dark; the beak is
  always amber `#ffbf00`. They are for the logo only. Interface accents use
  `--accent` and the primary gradient.
- The lockup is one piece: don't set the bird next to a separate "Olef" word.
  Use the mark alone where the lockup doesn't fit.
- Below 32 px use `olef-favicon.svg` (fewer feather cuts, larger open eye).
- Type is Inter (400–800). Headlines 800 with tight tracking (−0.045em);
  eyebrows 600, uppercase, letter-spaced 0.26em.
- Primary buttons: the `--primary-top` → `--primary-bottom` gradient with a
  1px `--primary-border`; one primary per view.
