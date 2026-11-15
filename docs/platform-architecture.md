# Agent platform architecture

Date: 15 November 2026, revision 3
Status: **agreed and unblocked. Sign-in and the read-only ServiceNow client are built and need credentials to prove themselves**
Relates to: `zero-day-vulnerability-management.md`

---

## 1. Decisions taken

| Ref | Decision |
|---|---|
| A1 | The site is live on **Vercel**, serving `netwik.co`. It is no longer on GitHub Pages. The README and `CLAUDE.md` have been corrected |
| A2 | **One website, two zones.** A public zone anyone can read, and authenticated execution |
| A3 | **Vercel free tier**, the hobby plan, and staying there for now. The commercial-use term is a known, accepted risk, recorded in section 4 |
| A4 | Mostly **workflows**, with **some genuinely open-ended agents** where they earn their place |
| A5 | ServiceNow is the data source. Claude is the model provider. It must be secure |
| A6 | **Two accounts, `yudhvir` and `admin`**, both with full rights. No role model in this phase |
| A7 | **Run state lives in ServiceNow**, as its own table |
| A8 | **Basic authentication to ServiceNow** with the integration user, being the simplest thing that works |
| A9 | **Everything is publicly readable. Only execution is gated.** The governing rule, in section 2a |
| A10 | **Vulnerability Response is not on the instance**, so the six vulnerability tables are custom and ours. Designed in `blueprint-addendum.md` section 5.1 |
| A11 | **The instance is already loaded** with the blueprint's inventory and history, so no data generator is needed first |

## 2. One project, and the marketing site stays untouched

Your choice of one site with two zones is straightforward on Vercel and costs nothing structurally, because Vercel serves static files from the repository root and server functions from an `api` directory in the same project. That means:

- `index.html`, `built-on.html` and `use-case.html` stay exactly as they are. No porting, no framework, no build step for the public pages, and the hand-tuned hero animation is untouched.
- Server-side functions live alongside them and never ship to the browser.
- The console pages sit behind a login and may use whatever is convenient, since they are new and carry none of the public site's conventions.

One consequence to accept: the repository gains a `package.json`, because the Anthropic SDK and the session library are real dependencies. `CLAUDE.md`'s claim of no package manager stops being true of the whole repository, though it stays true of the public pages. I have already noted that in `CLAUDE.md`.

```
netwik.co/                 static, public, unchanged
netwik.co/docs/...         static, public, the documents area
netwik.co/console.html     static, public to read; its actions need a session
netwik.co/api/...          server only, holds every credential
```

## 2a. Public to read, authenticated to execute

This is the governing rule and it is worth stating precisely, because it is unusual and it is what protects the money.

| | Public | Needs a session |
|---|---|---|
| The marketing pages, the documents area, the console page itself | Yes | |
| A recorded run, replayed from stored stage output | Yes | |
| Starting a run, any call to Claude, any call to ServiceNow, approving a gate | | **Yes** |

Two things follow. First, no anonymous visitor can cause a single token of spend or reach the ServiceNow instance, because every route that costs money checks the session before doing anything else. Second, replay stops being a demo convenience and becomes the public product: a visitor sees a real recorded run with no spend at all, while a live run is something you choose to do when signed in.

That also keeps the site's existing honesty rule intact. A replay must say it is a recording and when it ran. Only a live run may present itself as live.

## 2b. Protecting the API spend

You said you do not want to spend money unnecessarily. Six measures, in the order they bite:

1. **Authentication on every paid route.** Nothing anonymous can spend.
2. **A kill switch.** `LIVE_CALLS_ENABLED` must be exactly `true` or no model call is made at all, whoever is signed in. The console shows the current state.
3. **Replay first.** The console offers a stored run before it offers a live one, so rehearsal is free.
4. **Bounded calls.** Explicit `max_tokens` and an explicit effort level on every call, rather than defaults.
5. **No model where code will do.** Most stages never call Claude. See section 6.
6. **Usage recorded per run.** Every call's token usage and an estimated cost are stored with the run, so spend is visible rather than inferred.

The batch endpoint, at half price, is the right way to pre-generate the recorded runs that the public replay will serve.

## 3. The security boundary

Three rules, which follow directly from "it must be secure".

1. **No credential ever reaches a browser.** The console calls only `api` routes on the same origin. Those routes check the session first, then talk to ServiceNow and Anthropic. ServiceNow is never called from client code.
2. **Secrets exist only as Vercel environment variables**, server-side, never exposed to a client bundle. Different values for preview and production.
3. **The ServiceNow integration user holds the narrowest rights that work.** Web service access only, as your blueprint already specifies, with write access limited to the tables this flow touches.

A fourth rule follows from the free plan. Vercel's built-in password protection is a paid feature, so the login is part of the application instead: two named accounts, a signed session cookie, and no server-side session store. Because the accounts are named, the audit trail can record which of them started a run or approved a gate, which a single shared password could not.

## 4. The free plan is the binding constraint, in two ways

**Commercial use.** Vercel's hobby plan is for personal, non-commercial projects. Your own description of this site is that it shows potential customers what the agents can do, and the console will exist to demonstrate a managed service. That is a commercial purpose by most readings, and the enforcement risk is the site being suspended at the worst possible moment. I am not going to tell you how to read Vercel's terms, but I would not demonstrate to a prospect from a hobby deployment. Moving to a paid plan also happens to solve the next problem.

**Function duration.** This is the real engineering constraint. The hobby plan caps how long a single function may run, and the cap is well short of what a demanding Claude Opus 5 call can take, because adaptive thinking means a hard drafting task can run for minutes. A naive route that calls Claude and waits will time out.

Nothing about this is fatal, but it dictates the design, so it has to be settled before code rather than discovered during it.

## 5. How the run survives a short function cap

The design already assumed stage-per-invocation for audit reasons, which helps. Four mechanisms, in the order I would reach for them:

| # | Mechanism | Use it for |
|---|---|---|
| 1 | **Keep each model call bounded.** Lower effort for routine stages, capped output length, and drafting split into smaller stages that each produce one artefact | The majority of the pipeline. Most stages are short by nature |
| 2 | **No model at all.** Version matching, filtering, scoring, sequencing, collision checks and aggregation are deterministic code | Most of the fourteen stages, as section 6 sets out |
| 3 | **Managed Agents**, where Anthropic hosts the agent loop and the duration stops being Vercel's problem. The function only starts a session and later reads its events, both of which are short calls | Open-ended agents and anything multi-turn. See section 7 |
| 4 | **The Batch API**, asynchronous and half price | Pre-generating a complete run for replay, and any bulk work where minutes of latency do not matter |

**The first thing I would build is a measurement, not a feature.** One throwaway route that times a representative Opus 5 call and confirms the actual duration cap on your plan. Everything above is sound reasoning, but the numbers decide which mechanism each stage uses, and guessing them would be unprofessional.

## 6. Workflow and agent, divided

Agreed in principle last turn, now with the division written down.

**Code, no model.** Version range comparison. Estate filtering. Exposure and criticality lookup. Risk arithmetic and deadline calculation. Dependency and wave sequencing. Collision and freeze checks. Post-change verification. Dashboard aggregation. These are deterministic, testable, free, fast, and identical on every run, which is what makes a live demo safe.

**Single bounded model call.** Reading an advisory into structure. Drafting an implementation, backout and test plan. Writing each audience's briefing. Explaining why a device was excluded. Drafting the executive summary and the service review pack.

**Open-ended agent, with tools.** Section 7.

## 7. Where open-ended agents earn their place

You are right that there is room for them. They belong where the question is not known in advance, which is precisely where a fixed pipeline cannot help.

| Candidate | Why it is genuinely open-ended | Phase |
|---|---|---|
| **Ask the estate** | A free-form question such as "what breaks if the Singapore hub goes down during the freeze" cannot be pre-planned. The agent needs read tools over ServiceNow and several turns to answer | Strong candidate for phase 1. It is the single most impressive thing to put in front of an engineer, and it reuses the same read-only ServiceNow client |
| Advisory investigation when the parse is ambiguous | Deciding what a vague advisory actually covers may need several lookups and a judgement call | Phase 1, as a fallback inside stage 1 |
| Root cause drafting and major incident summary | Assembling a timeline from scattered work notes is exploratory | Later, with the problem and incident use cases |

All three are multi-turn tool loops, which is exactly what a short function cap cannot hold. So these are the first things I would run as Managed Agents sessions rather than as plain API calls, and the division is clean: the pipeline uses the Messages API, the open-ended agents use sessions.

## 8. The public documents area

New scope, and I need to know what you mean by it. What is clear:

- It is static, public and in the same project, so it is simply more files served at a path.
- It should follow the existing voice rules, British spelling, first person singular, and nothing that claims to exist when it does not.
- Anything put there is public permanently in effect, because it will be indexed and cached.

What is not clear is which documents. The demo customer blueprint is entirely fictional, so there is no confidentiality problem in publishing it, but it reads as an internal build plan rather than something a prospect would benefit from. Questions in section 10.

## 9. Model and API choices

| Decision | Proposal |
|---|---|
| Model | `claude-opus-5` |
| Effort | `high` where the output is a plan or a briefing a person will rely on, `low` for short classification work. Effort is the first cost lever |
| Streaming | For any call with long output, which also avoids request timeouts |
| Refusal handling | Enabled with server-side fallbacks. Opus 5 can decline a request and return a refusal rather than an error, and content about actively exploited vulnerabilities is exactly where that can happen. Unhandled, it is a blank panel in front of a customer |
| Prompt caching | On the stable parts of each stage prompt, since the estate context repeats across stages and advisories |

Rough cost, for sanity rather than precision:

| | Estimate |
|---|---|
| One complete pipeline run, about ten bounded calls with caching | One to two US dollars |
| The same run pre-generated through the Batch API | About half that |
| Rehearsals using replay | No model spend |

## 9a. What exists now

Built and syntax-checked, with the session logic unit-tested for tampering, expiry, garbage input, unknown users and unset passwords.

| File | What it does |
|---|---|
| `api/_lib/http.js` | Node request and response helpers. Vercel's Node runtime passes `(req, res)`, **not** a Web Request returning a Web Response. Returning a Response does not fail loudly: nothing writes to `res` and the request hangs until the gateway times out |
| `api/_lib/session.js` | Signed session cookie using `node:crypto` only. No server-side store, no dependency. The cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, with an eight hour life |
| `api/_lib/auth.js` | The two accounts, constant-time password comparison through fixed-length digests, the session guard, and a JSON helper |
| `api/login.js` | Sets the cookie. Fixed delay on failure |
| `api/logout.js` | Clears the cookie |
| `api/me.js` | Publicly readable. Reports who is signed in and whether live calls are enabled, so the console can render itself |
| `api/spike-latency.js` | The measurement. Authenticated, POST only, behind the kill switch |
| `api/_lib/servicenow.js` | **Read-only** ServiceNow client. Basic authentication, credentials in the header and never in a URL, an eight second timeout, and explicit handling of a hibernating instance, rejected credentials, a missing role and a missing table. Nothing in it writes |
| `api/snow-inspect.js` | Probes thirty tables and four custom fields, compares the counts against the blueprint and reports what is missing. Authenticated, costs nothing, writes nothing |
| `console.html`, `assets/js/console.js` | The console page. Public to read, actions gated by the server |
| `.env.example` | Every variable the server needs, with a note on each |
| `package.json`, `.gitignore` | The Anthropic SDK at version 1.8, and keeping `node_modules` out of the repository |

Two deliberate simplifications, both reversible:

- **Passwords are stored as plain environment variables** rather than hashes. For two accounts in a demo console, where the variables are already server-side and encrypted at rest, hashing defends mainly against a leak of the variables themselves. Say the word and it becomes a scrypt hash.
- **There is no real rate limiting on sign-in**, because that needs somewhere to keep a counter and this phase has nowhere yet. A fixed delay on failure is the only brake, so both passwords must be long and random. Once the ServiceNow run table exists, it can hold the counter.

Changing `SESSION_SECRET` invalidates every session immediately, which is the emergency sign-everyone-out.

## 10. What is still open

**Answered, see section 1.** The plan, the sign-in method, who signs in, where run state lives, and how the console reaches ServiceNow.

**Blocking the next step, which is the ServiceNow client.**

1. **Is Vulnerability Response available on your instance?** Asked three times now. It decides whether the advisory, vulnerable item and remediation records are its tables or ours, and that choice runs through every stage. I cannot design the data model without it.
2. **What exists in the instance today?** If it is empty, the next deliverable is the data generator rather than an agent, and that is a different fortnight.
3. **What did you mean by regulation planning?** Asked three times. I have built for validation of changes to GxP systems. If you also meant statutory reporting with legal deadlines, it is far cheaper to add now than later.

**Needed shortly, not blocking.**

4. **Which documents go in the public area, and who they are for.** A prospect, a colleague, or a search engine. The demo blueprint is fictional so publishing it is safe, but it reads as an internal build plan.
5. **Do you want the "ask the estate" agent in phase 1?** Strongest demonstration per day of effort, and additional scope beyond the fourteen stages.
6. **Unattended scheduled runs later?** Cron frequency is limited on the free plan, and the answer firms up the case for Managed Agents.
7. **Hash the passwords, or leave them as environment variables?** See section 9a.

## 11. Build order

1. ~~Sign-in and the session boundary.~~ **Done.**
2. ~~The latency and duration measurement.~~ **Written. Needs deploying and one click to produce its numbers.**
3. ~~A server-side read-only ServiceNow client.~~ **Done, with an inspection endpoint. Needs credentials and one click to report what the instance holds.**
4. Create the six custom tables and the exposure-zone field, against the real field names the inspection returns.
5. The run record and stage persistence in ServiceNow, with one deterministic stage and no model calls.
6. The first model-backed stage, advisory parsing, with its output stored for replay from the start.
7. Outward through the flow in the order agreed in the statement document.

## 12. To bring this online

1. Generate a session secret: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
2. In Vercel, add `SESSION_SECRET`, `PASSWORD_YUDHVIR`, `PASSWORD_ADMIN` and `ANTHROPIC_API_KEY`. Leave `LIVE_CALLS_ENABLED` unset or `false` for now.
3. Add `SERVICENOW_INSTANCE`, `SERVICENOW_USER` and `SERVICENOW_PASSWORD` for the integration user. The host may be given with or without `https://`.
4. Deploy. Visit `/console.html` and sign in. Clean URLs are off on this project, so the extension is required, which matches how every other page on the site links. Press **Inspect instance**: it costs nothing and tells us what is really there.
5. To take the latency measurement, set `LIVE_CALLS_ENABLED` to `true`, redeploy, press the button once, record the elapsed seconds in section 4, then set it back to `false`.
