/* Measurement, not a feature.

   Answers the three numbers the architecture depends on and that I refuse to
   guess: how long a representative Claude Opus 5 call actually takes, how that
   compares with this plan's function duration cap, and whether server-side
   refusal fallbacks are accepted on this account.

   Authenticated and behind a kill switch, because it spends money.
   Delete it once the numbers are recorded in platform-architecture.md. */

import Anthropic from '@anthropic-ai/sdk';
import { requireSession, unauthorised } from './_lib/auth.js';
import { sendJson, methodOf } from './_lib/http.js';

const MODEL = 'claude-opus-5';
const FALLBACK_MODEL = 'claude-opus-4-8';
const INPUT_USD_PER_MTOK = 5;
const OUTPUT_USD_PER_MTOK = 25;

/* Shaped like the real stage 1: read an advisory into structure. Fictional. */
const ADVISORY = [
  'Advisory NETWIK-DEMO-0001. Severity critical, CVSS 9.8.',
  'A flaw in the web management interface of the affected network operating',
  'system allows an unauthenticated remote attacker to create a local account.',
  'Exploitation has been observed in the wild.',
  'Affected: releases 17.6.1 through 17.9.4 inclusive, and 17.12.1.',
  'Fixed in 17.9.5 and 17.12.2. No fix is planned for hardware that has',
  'passed its end-of-support date.'
].join(' ');

const PROMPT = 'Read this network vendor advisory and return only JSON with keys '
  + 'advisoryId, severity, cvss, exploited (boolean), affectedVersions (array of '
  + 'ranges as strings), fixedVersions (array of strings), and '
  + 'noFixForEndOfSupport (boolean).\n\n' + ADVISORY;

function estimateUsd(usage) {
  if (!usage) return null;
  const input = (usage.input_tokens || 0) / 1e6 * INPUT_USD_PER_MTOK;
  const output = (usage.output_tokens || 0) / 1e6 * OUTPUT_USD_PER_MTOK;
  return Number((input + output).toFixed(5));
}

export default async function handler(req, res) {
  /* POST only, so nothing can trigger spend by merely fetching a URL. */
  if (methodOf(req) !== 'POST') {
    sendJson(res, 405, { error: 'Use POST.' });
    return;
  }

  const session = requireSession(req);
  if (!session) { unauthorised(res); return; }

  if (process.env.LIVE_CALLS_ENABLED !== 'true') {
    sendJson(res, 403, {
      error: 'Live model calls are switched off. Set LIVE_CALLS_ENABLED to true '
        + 'in the Vercel environment to allow spend.'
    });
    return;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    sendJson(res, 500, { error: 'ANTHROPIC_API_KEY is not set.' });
    return;
  }

  const client = new Anthropic();
  const common = {
    model: MODEL,
    max_tokens: 1500,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    messages: [{ role: 'user', content: PROMPT }]
  };

  const started = Date.now();
  let response;
  let fallbacksAccepted = true;

  try {
    /* Opus 5 can decline a request and return a refusal rather than an error.
       Vulnerability content is exactly where that can happen, so the real
       stages will carry fallbacks. Validate here that the account accepts them. */
    response = await client.beta.messages.create(Object.assign({}, common, {
      betas: ['server-side-fallback-2026-06-01'],
      fallbacks: [{ model: FALLBACK_MODEL }]
    }));
  } catch (error) {
    if (error instanceof Anthropic.BadRequestError) {
      fallbacksAccepted = false;
      try {
        response = await client.messages.create(common);
      } catch (retryError) {
        describeError(res, retryError, Date.now() - started); return;
      }
    } else {
      describeError(res, error, Date.now() - started); return;
    }
  }

  const elapsedMs = Date.now() - started;
  const text = response.content
    .filter(function (block) { return block.type === 'text'; })
    .map(function (block) { return block.text; })
    .join('');

  sendJson(res, 200, {
    ok: true,
    requestedBy: session.u,
    elapsedMs: elapsedMs,
    elapsedSeconds: Number((elapsedMs / 1000).toFixed(1)),
    modelRequested: MODEL,
    modelServed: response.model,
    fallbacksAccepted: fallbacksAccepted,
    stopReason: response.stop_reason,
    stopDetails: response.stop_reason === 'refusal' ? response.stop_details : null,
    usage: response.usage,
    estimatedUsd: estimateUsd(response.usage),
    outputPreview: text.slice(0, 600)
  });
}

function describeError(res, error, elapsedMs) {
  if (error instanceof Anthropic.AuthenticationError) {
    sendJson(res, 502, { error: 'The Anthropic API key was rejected.', elapsedMs: elapsedMs });
    return;
  }
  if (error instanceof Anthropic.RateLimitError) {
    sendJson(res, 429, { error: 'Rate limited by the Anthropic API.', elapsedMs: elapsedMs });
    return;
  }
  if (error instanceof Anthropic.APIError) {
    sendJson(res, 502, {
      error: 'Anthropic API error ' + error.status + ': ' + error.message,
      elapsedMs: elapsedMs
    });
    return;
  }
  sendJson(res, 504, {
    error: 'Call failed: ' + (error && error.message ? error.message : 'unknown'),
    elapsedMs: elapsedMs,
    note: 'If this reads like a timeout, the function duration cap is shorter '
      + 'than the call. That is the number this spike exists to find.'
  });
}
