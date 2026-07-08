# DMICOckpit

Personal content pipeline PWA for the three DMICO personas (XHS + Instagram). P1 = persona layer + pipeline board + PWA shell. P2 = Platform Splitter: per-card XHS note + IG caption editors, XHS link/contact lint, preflight checklists that gate the posted toggles, copy buttons. P3 = Carousel Forge (pending). Themed with the real dmico-hub palette. PRD lives in the PRD_Claude folder: `dmico-content-cockpit/PRD-dmicockpit.md`.

## Deploy (GitHub Pages)

1. Copy this whole folder into a repo (e.g. `dmicockpit`), push via GitHub Desktop.
2. Repo Settings → Pages → deploy from `main` branch, root.
3. Open `https://<user>.github.io/dmicockpit/`. All paths are relative (`./`), so the subpath just works.

## Install on phone (Android, primary target)

Chrome → open the URL → ⋮ menu → **Add to Home screen** (or the install banner). Desktop Chrome/Edge: install icon in the address bar. iOS (untested, best-effort): Share → Add to Home Screen.

## Palette

Real dmico-hub tokens (cornsilk paper / ink / olive / lantern), recorded in `MUSTREAD-NEWCHAT/dmico-brand-design-context.md`. Change colors in the `:root` block of `style.css` only.

## Data + backup

Everything lives in this browser's localStorage under `dmicockpit_v1`. Settings → Export JSON regularly; the app nags after 14 days. Import replaces ALL data (it warns first).

## Reminders

- Favicons/icons cache hard: hard-refresh (or reinstall the PWA) after changing them.
- Service worker is network-first; you'll never be stuck on a stale shell while online.
- Tier logic: A = streak + 80/20 ratio, B = quiet-week nudge, C = zero metrics. Editable per persona in Settings.
