/**
 * Live resilience scenarios — exercises the new backend contract end-to-end.
 * Not a Jest test; this is the manual-test pass scripted so it can be re-run.
 *
 *   node scripts/resilience-test.mjs
 *
 * Requires backend on :4000.
 */

const BASE = process.env.API_BASE ?? 'http://localhost:4000/api';
let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api(method, path, { token, body } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await r.json();
  } catch {
    /* non-JSON */
  }
  return { status: r.status, json };
}

async function readSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const events = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep = buf.indexOf('\n\n');
    while (sep !== -1) {
      const block = buf.slice(0, sep);
      const event = block.split('\n').find((l) => l.startsWith('event: '))?.slice(7);
      const data = block.split('\n').find((l) => l.startsWith('data: '))?.slice(6);
      if (event && data) events.push({ event, data: JSON.parse(data) });
      buf = buf.slice(sep + 2);
      sep = buf.indexOf('\n\n');
    }
  }
  return events;
}

async function stream(token, conversationId, body, { signal } = {}) {
  const r = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  return { status: r.status, events: await readSSE(r) };
}

async function streamWithHeaders(token, conversationId, body, extraHeaders) {
  const r = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...extraHeaders },
    body: JSON.stringify(body),
  });
  return { status: r.status, events: await readSSE(r) };
}

const uniq = Date.now();
const reg = await api('POST', '/auth/register', { body: { email: `resil-${uniq}@x.com`, password: 'password123' } });
const token = reg.json.accessToken;
const conv = await api('POST', '/conversations', { token, body: {} });
const convId = conv.json.id;

// ----- 1: refresh during stream -----
console.log('\n[1] Refresh during stream');
const cmid1 = `cmid-${uniq}-1`;
const ctl1 = new AbortController();
// The mock provider sleeps 40ms between chunks; abort after several chunks
// have been delivered (~250ms) so the partial-content assertion is
// meaningful regardless of localhost network jitter.
setTimeout(() => ctl1.abort(), 250);
try {
  await stream(token, convId, { content: 'یک پیام بلند برای آزمایش قطع ارتباط', clientMessageId: cmid1 }, { signal: ctl1.signal });
} catch {
  /* expected: aborted fetch */
}
// The server keeps iterating through the remaining chunks after the client
// gives up — the final status is only persisted once the for-await reaches
// its end (and notices the disconnect). Give it a beat to finish.
await new Promise((r) => setTimeout(r, 800));
const after1 = await api('GET', `/conversations/${convId}`, { token });
const assistant1 = after1.json.messages.filter((m) => m.role === 'assistant').at(-1);
check('aborted mid-stream persists status=interrupted', assistant1?.status === 'interrupted', `status=${assistant1?.status}`);
check('partial content preserved on interrupt', typeof assistant1?.content === 'string' && assistant1.content.length > 0, `len=${assistant1?.content?.length}`);
check('user row persisted before the abort', after1.json.messages.some((m) => m.role === 'user' && m.clientMessageId === cmid1));

// ----- 2: retry reuses the user row -----
console.log('\n[2] Retry reuses user row, streams a new assistant');
const retry1 = await stream(token, convId, { content: 'یک پیام بلند برای آزمایش قطع ارتباط', clientMessageId: cmid1 });
check('retry emits replay=true', retry1.events[0]?.data.replay === true);
check('retry reuses same user row id', retry1.events[0]?.data.userMessage.id === after1.json.messages.find((m) => m.role === 'user' && m.clientMessageId === cmid1)?.id);
const after2 = await api('GET', `/conversations/${convId}`, { token });
const assistants2 = after2.json.messages.filter((m) => m.role === 'assistant');
check('exactly 2 assistant rows now (one per turn)', assistants2.length === 2, `found ${assistants2.length}`);
const newAssistant = assistants2.at(-1);
check('new assistant has status=completed', newAssistant?.status === 'completed');

// ----- 3: status state machine (pending → streaming → completed) -----
console.log('\n[3] Pre-persist pending assistant row');
const cmid3 = `cmid-${uniq}-3`;
const s3 = await stream(token, convId, { content: 'سلام', clientMessageId: cmid3 });
const meta = s3.events[0]?.data;
check('meta.assistantMessage.id is a real UUID', /^[0-9a-f-]{36}$/i.test(meta?.assistantMessage?.id ?? ''));
check('meta.assistantMessage.status starts at pending', meta?.assistantMessage?.status === 'pending');
check('final done event has status=completed', s3.events.at(-1)?.data.assistantMessage?.status === 'completed');

// ----- 4: Idempotency-Key header -----
console.log('\n[4] Idempotency-Key header accepted');
const cmid5 = `cmid-${uniq}-5`;
const r5 = await streamWithHeaders(token, convId, { content: 'پیام از طریق هدر' }, { 'Idempotency-Key': cmid5 });
check('header turn has replay=false on first call', r5.events[0]?.data.replay === false);
const r5b = await streamWithHeaders(token, convId, { content: 'پیام از طریق هدر' }, { 'Idempotency-Key': cmid5 });
check('header second call has replay=true', r5b.events[0]?.data.replay === true);

// ----- 5: After an interrupted turn, a fresh GET surfaces it for the UI -----
console.log('\n[5] Refresh shows interrupted rows as retryable');
const after6 = await api('GET', `/conversations/${convId}`, { token });
const retryable = after6.json.messages.filter((m) => m.role === 'assistant' && (m.status === 'interrupted' || m.status === 'failed'));
check('at least one retryable row exists', retryable.length > 0, `${retryable.length} retryable`);
check('retryable row carries an errorMessage', retryable.every((m) => typeof m.errorMessage === 'string'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
