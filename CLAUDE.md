# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Netwik is a personal project, not a company. The site shows friends, colleagues and potential customers what AI agents can do in network services (incident, change, capacity, release, availability, problem and knowledge management across LAN, WAN, wireless and DDI). Its second message is that agents can only be built on three things: **context, foundation and autonomy**. Every use case walkthrough shows those three, and `built-on.html` explains them.

It is a plain static site made of HTML, CSS and vanilla JavaScript. There is no build step, no package manager, no linter and no tests. Fonts load from Google Fonts. It is deployed with GitHub Pages from the repository root.

## Running locally

```bash
python -m http.server 8000   # then open http://localhost:8000
```

Opening `index.html` directly also works. To check changes, load the page in a browser. Also check it at phone width and with "reduce motion" turned on (see below).

## Voice and content rules

- Written in the first person singular ("I am building"), never "we". Do not add vendor language: no pilots, partners, demos on request, pricing or "how you start".
- Do not claim anything exists that does not. Sample runs and outputs are labelled "illustrative". The one exception, by the owner's choice, is the concept diagram in the home page hero (the incident flow), which has no label. Product names (ServiceNow, SolarWinds Orion, Cisco DNA Center and so on) always carry a "for example" label.
- Copy uses British spelling ("utilisation", "catalogue", "colour") and short, plain sentences.
- The only call to action is an email to `hi@netwik.co`. There is no About section, by the owner's choice.

## Architecture

**Use cases are data.** `assets/js/data.js` exposes `window.NetwikData = { PROCS, DOMS, ALL }`. An entry in `ALL` with an `id` and a `detail` object has a walkthrough at `use-case.html?id=<id>`; one without shows on the home page as "Coming soon". Adding a walkthrough means adding a `detail` object and nothing else. `detail.steps` must have exactly five rows, because the run panel treats the fifth as the approval step.

**Three pages, three scripts.** Every page loads `site.js` first.
- `index.html` + `use-cases.js`: the catalogue (coverage map, filter chips, cards, count), all generated from the data. Filters sync to `?process=` and `?domain=`. Each process has its own animated square pattern on its cards, in `vizColor`.
- The home page hero shows the incident flow (signal, plan, eight agents in parallel, approve, resolved). It is inline SVG in `index.html`, animated only by CSS keyframes (`.nk-flow-*` in `site.css`) on one 9 s loop, so every keyframe percentage is a share of 9 s and the packets' `animation-delay`s are set to match. It uses no JS. Its step labels are placed at percentages of the SVG height, so moving a shape means moving its label too.
- `use-case.html` + `use-case.js`: builds the whole walkthrough into `#uc` with `innerHTML` from the data entry. The page is an empty shell without JavaScript.
- `built-on.html` + `built-on.js`: the three-layer diagram, the context steps and the "at work" steps. This script is bound to the page by element ID (`#how-*`, `#ctx-*`, `#build-layers`), mostly without null checks, so renaming one of those IDs stops the page's animation. The tab copy is in `tabData` and `ctxData` in the script, not in the HTML. Tabs change only on click; do not bring back auto-advancing tabs or scrambled body text.
- `use-cases.html` and `incident-agent.html` are redirect stubs for the old addresses.

**Pages are self-contained, with no templating.** The `<head>`, the sticky header and nav, the contact section, the footer and the two `.nk-margin` side columns are copied into `index.html`, `use-case.html` and `built-on.html`. A site-wide change has to be made in all three. The copies differ slightly: `aria-current` marks the current page, and the home page links to `#use-cases` where the others link to `index.html#use-cases`.

**Most styling is inline.** Layout, spacing, type and colours are set in `style="..."` attributes in the HTML, and in style strings in JS for generated markup. `assets/css/site.css` holds the `:root` tokens and the `nk-` classes for things inline styles can't do: hover states (which use `!important` to beat inline styles), keyframe animations, `aria-pressed` states, responsive rules and the reduced-motion overrides. Hex colours are hardcoded across the HTML, the JS and the CSS rather than read from the CSS variables, so to change a colour, grep for the hex value in all three.

**JS is ES5 IIFEs with no modules** (`var`, no arrow functions). `site.js` exposes `window.Netwik = { still, glyph, scramble, runPanel, run }`:
- `Netwik.run({ interval, blocks, onTick })` starts the one `setInterval` tick loop for the page. It also animates the drifting glyphs in the side margins and pauses while the tab is hidden. Each page calls it exactly once.
- Page animations are pure functions of the tick counter `t`, recomputed on each tick.
- `runPanel(root, text)` drives the "Illustrative run" panel on the walkthrough page. It expects `root` to contain five `.nk-step` rows (each with a `.nk-step-dot`), `[data-run-typed]` and `[data-run-bar]`, and types `text` into the last line.

**Reduced motion is a hard requirement.** `Netwik.still` is true when the visitor prefers reduced motion. The tick loop then never starts, and renderers use `still ? 999 : ...` to jump straight to the finished state. CSS animations and transitions are switched off in the `prefers-reduced-motion: reduce` block in `site.css`. Any new animation needs both. A CSS-only animation, like the hero flow, must also have its finished state set in that block.
