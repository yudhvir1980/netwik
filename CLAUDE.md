# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Netwik is a personal project, not a company. The site shows friends, colleagues and potential customers what AI agents can do in network services (incident, change, capacity, release, availability, problem and knowledge management across LAN, WAN, wireless and DDI). Its second message is that agents can only be built on three things: **context, foundation and autonomy**. Every use case walkthrough shows those three, and `built-on.html` explains them.

It is a plain static site made of HTML, CSS and vanilla JavaScript. There is no build step, no package manager, no linter and no tests. Fonts load from Google Fonts. It is deployed on Vercel from the repository root and served at `netwik.co`, so a push to the default branch publishes the site. It was briefly on GitHub Pages; anything that still says so is out of date.

A logged-in agent console lives in the same Vercel project at `console.html`, which adds server-side functions under `api/` and a package manager to that part of the repository. The static pages described below stay as they are. See `docs/platform-architecture.md`.

**Two rules for `api/`, both learned the hard way.** Handlers take Node's `(req, res)`, never a Web Request returning a Web Response: returning a Response does not error, it hangs the request until the gateway times out. Always reply through the helpers in `api/_lib/http.js` so every path ends the response. And clean URLs are off, so pages are linked with their `.html` extension, as the rest of the site already does.

## Running locally

```bash
python -m http.server 8000   # then open http://localhost:8000
```

Opening `index.html` directly also works.

## Checking a change

There is nothing to run, so a change is checked by loading it. Since the walkthrough and catalogue pages are built entirely by JavaScript, a thrown error leaves a blank page rather than a broken one: open the browser console before deciding a page is fine. Worth loading after anything structural:

- `index.html`, and a filtered address such as `?process=Change&domain=WAN`
- a walkthrough, `use-case.html?id=wan-outage-triage`, and an unknown id such as `use-case.html?id=nope`, which must fall back to the "not written up yet" section
- `built-on.html`, clicking through both sets of tabs
- any page at phone width, and again with "reduce motion" turned on

## Voice and content rules

- Written in the first person singular ("I am building"), never "we". Do not add vendor language: no pilots, partners, demos on request, pricing or "how you start".
- Do not claim anything exists that does not. Sample runs and outputs are labelled "illustrative". Product names (ServiceNow, SolarWinds Orion, Cisco DNA Center and so on) always carry a "for example" label.
- Copy uses British spelling ("utilisation", "catalogue", "colour") and short, plain sentences.
- The only call to action is an email to `hi@netwik.co`. There is no About section, by the owner's choice.

## Architecture

**Use cases are data.** `assets/js/data.js` exposes `window.NetwikData = { PROCS, DOMS, ALL }`. An entry in `ALL` with an `id` and a `detail` object has a walkthrough at `use-case.html?id=<id>`; one without shows on the home page as "Coming soon". Adding a walkthrough means adding a `detail` object and nothing else. Of the 17 use cases, three are written up: `wan-outage-triage`, `change-evaluator` and `playbooks`. Copy the shape of one of those; the README lists the fields. `detail.steps` must have exactly five rows, because the run panel treats the fifth as the approval step.

**Three pages, three scripts.** Scripts are plain `<script>` tags at the end of the body, and the order matters: `site.js` first, then `data.js`, then the page script.
- `index.html` + `use-cases.js`: the catalogue (coverage map, filter chips, cards, count), all generated from the data. Filters sync to `?process=` and `?domain=` through `history.replaceState`. Each process has its own animated square pattern on its cards, from the `vizColor` function.
- The home page hero shows the incident flow (signal, plan, eight agents in parallel, approve, resolved). It is inline SVG in `index.html`, animated only by CSS keyframes (`.nk-flow-*` in `site.css`) on one 9 s loop, so every keyframe percentage is a share of 9 s and the packets' `animation-delay`s are set to match. It uses no JS. Its step labels are placed at percentages of the SVG height, so moving a shape means moving its label too.
- `use-case.html` + `use-case.js`: builds the whole walkthrough into `#uc` with `innerHTML` from the data entry, in a fixed order (01 Context, 02 Foundation, 03 Autonomy), each section linking to its anchor in `built-on.html`. The page is an empty shell without JavaScript.
- `built-on.html` + `built-on.js`: the three-layer diagram, the context steps and the "at work" steps. This is the one page script that does not read `data.js`; the tab copy is in `tabData` and `ctxData` in the script, not in the HTML. Tabs change only on click; do not bring back auto-advancing tabs or scrambled body text.
- `use-cases.html` and `incident-agent.html` are redirect stubs for the old addresses, each doing it three ways: a canonical link, a meta refresh and a `location.replace`.

**Generated markup is coupled to element IDs.** Both `use-cases.js` and `built-on.js` reach for IDs in the HTML (`#matrix`, `#proc-chips`, `#dom-chips`, `#cases`, `#count`, `#empty`, `#reset`; and `#how-*`, `#ctx-*`, `#build-layers`) mostly without null checks, so renaming one of those IDs breaks the page's rendering or animation rather than degrading it.

**Follow each file's escaping convention.** `use-case.js` concatenates `innerHTML`, so every value out of the data goes through its `esc()` helper. `use-cases.js` never uses `innerHTML`: it builds nodes with its `el(tag, cls, text)` helper, which sets `textContent`. New generated markup should stay with whichever approach its file already uses.

**Pages are self-contained, with no templating.** The `<head>`, the sticky header and nav, the contact section, the footer and the two `.nk-margin` side columns are copied into `index.html`, `use-case.html` and `built-on.html`. A site-wide change has to be made in all three. The copies differ slightly: `aria-current` marks the current page, and the home page links to `#use-cases` where the others link to `index.html#use-cases`.

**Most styling is inline.** Layout, spacing, type and colours are set in `style="..."` attributes in the HTML, and in style strings in JS for generated markup. `assets/css/site.css` holds the `:root` tokens and the `nk-` classes for things inline styles can't do: hover states (which use `!important` to beat inline styles), keyframe animations, `aria-pressed` states, responsive rules and the reduced-motion overrides. Hex colours are hardcoded across the HTML, the JS and the CSS rather than read from the CSS variables, so to change a colour, grep for the hex value in all three.

**JS is ES5 IIFEs with no modules** (`var`, no arrow functions). `site.js` exposes `window.Netwik = { still, glyph, scramble, runPanel, run }`:
- `Netwik.run({ interval, blocks, onTick })` starts the one `setInterval` tick loop for the page. It also animates the drifting glyphs in the side margins and pauses while the tab is hidden. Each page calls it exactly once.
- Page animations are pure functions of the tick counter `t`, recomputed on each tick.
- `runPanel(root, text)` drives the "Illustrative run" panel on the walkthrough page. It expects `root` to contain five `.nk-step` rows (each with a `.nk-step-dot`), `[data-run-typed]` and `[data-run-bar]`, and types `text` into the last line.

**Reduced motion is a hard requirement.** `Netwik.still` is true when the visitor prefers reduced motion. The tick loop then never starts, and renderers use `still ? 999 : ...` to jump straight to the finished state. CSS animations and transitions are switched off in the `prefers-reduced-motion: reduce` block in `site.css`. Any new animation needs both. A CSS-only animation, like the hero flow, must also have its finished state set in that block, the way the hero sets `stroke-dashoffset: 0` and reveals its last message.
