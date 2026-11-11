# Netwik website

A personal project that shows what AI agents can do in network services (incident, change, capacity, release, availability, problem and knowledge management across LAN, WAN, wireless and DDI), and what those agents have to be built on: context, foundation and autonomy.

It is a plain static site: HTML, CSS and vanilla JavaScript, with no build step and no dependencies. Fonts load from Google Fonts.

## Pages

| File | Page |
| --- | --- |
| `index.html` | Home: the use case catalogue with coverage map and filters (supports `?process=Change&domain=WAN`) |
| `use-case.html` | Use case walkthrough, built from the data for `?id=...` |
| `built-on.html` | What agents are built on: context, foundation and autonomy |
| `use-cases.html`, `incident-agent.html` | Redirects from the old addresses |

Shared code lives in `assets/`:

- `assets/css/site.css`: colours, animations and component styles
- `assets/js/site.js`: drifting glyph margins, the "illustrative run" panel and the tick loop
- `assets/js/data.js`: every use case, for both the catalogue and the walkthrough page
- `assets/js/use-cases.js`: the catalogue on the home page
- `assets/js/use-case.js`: the walkthrough page
- `assets/js/built-on.js`: the animated panels on the "built on" page

All animation stops when the visitor has "reduce motion" turned on.

## Add a use case walkthrough

Everything is in `assets/js/data.js`. A use case without a `detail` object shows on the home page as "Coming soon". To give it a walkthrough, add an `id` and a `detail` object, copying the shape of an existing one:

- `summary`, and five `steps` for the run panel (the fifth is the step that waits for a person)
- `ticketLabel` and `ticket`: the line typed at the bottom of the run panel
- `today` and `withAgent`: the before and after lists
- `output`: the sample output
- `context`, `tools` (shown as "for example") and `alone` / `approval` / `never`: the three things the agent is built on

No HTML changes are needed.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

## Publish with GitHub Pages

In the repository on GitHub, go to **Settings → Pages**, choose **Deploy from a branch**, pick the branch and the `/ (root)` folder, and save.
