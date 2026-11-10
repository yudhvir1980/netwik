# Netwik website

Marketing site for Netwik: AI agents for network services (incident, change, capacity, release, availability and problem management across LAN, WAN, wireless and DDI).

It is a plain static site: HTML, CSS and vanilla JavaScript, with no build step and no dependencies. Fonts load from Google Fonts.

## Pages

| File | Page |
| --- | --- |
| `index.html` | Home |
| `use-cases.html` | Use case catalogue with coverage map and filters (supports `?process=Change&domain=WAN`) |
| `incident-agent.html` | Use case detail: the incident agent |

Shared code lives in `assets/`:

- `assets/css/site.css`: colours, animations and component styles
- `assets/js/site.js`: drifting glyph margins, the "illustrative run" panel and the tick loop
- `assets/js/home.js`: the animated step panels on the home page
- `assets/js/use-cases.js`: the catalogue data, coverage map and filters

All animation stops when the visitor has "reduce motion" turned on.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## Publish with GitHub Pages

In the repository on GitHub, go to **Settings → Pages**, choose **Deploy from a branch**, pick the branch and the `/ (root)` folder, and save.

## Placeholders to fill in

Search the HTML for `[` to find them:

- `[YOUR EMAIL]`: contact address in the footers and the Partners and Investors links
- Investors blurb on the home page
- `[YOUR DDI PLATFORM]`, `[CARRIER PORTAL OR API]`, `[YOUR CHAT TOOL]` on the incident agent page
- `[TARGET]` figures in "What a pilot measures"
