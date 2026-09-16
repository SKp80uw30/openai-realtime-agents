// Regression check for the P1 documented in docs/orb-layout.md: the orb must
// stay inside its grid row at every viewport size, never overflowing off the
// top of the screen or underneath the action dock.
//
// Re-run this after ANY change to the action dock (MicButton /
// CapabilityChecklist) or to the orb's sizing in OrbShowcase.
//
//   1. npm run dev                      # leave it running, do NOT build meanwhile
//   2. open Chrome with a debug port, signed in, on the showcase screen:
//      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
//        --remote-debugging-port=9222 --user-data-dir=/tmp/orb-check
//   3. node scripts/check-orb-viewports.mjs
//
// No dependencies — Node 22's global WebSocket drives CDP directly.

const SIZES = [
  [430, 932], [430, 860], [414, 736], [390, 670], [360, 640],
  [768, 1024], [1280, 900], [1440, 800], [1440, 700], [1512, 600],
  [1280, 540], [756, 469], [1024, 450],
];

// Selects structurally rather than by test ids, so production markup carries
// no scaffolding for this check.
const MEASURE = `(() => {
  const box = (el) => el.getBoundingClientRect();
  const header = document.querySelector('header');
  const main = document.querySelector('main');
  const dock = main && main.nextElementSibling;
  const scene = document.querySelector('[class*="liquidGlass_scene"], [class*="liquidGlass_fallback"]');
  const pill = document.querySelector('button[aria-label="Start conversation"], button[aria-label="End conversation"]');
  if (!main || !scene) return JSON.stringify({ error: 'orb screen not found — is the browser signed in and on the showcase screen?' });
  const m = box(main), s = box(scene);
  const sphere = s.width * 0.715;
  const p = pill ? box(pill).width : null;
  return JSON.stringify({
    vw: innerWidth, vh: innerHeight,
    header: header ? Math.round(box(header).height) : 0,
    main: Math.round(m.height),
    dock: dock ? Math.round(box(dock).height) : 0,
    sceneW: Math.round(s.width), sceneH: Math.round(s.height), sceneTop: Math.round(s.top),
    sphere: Math.round(sphere), pill: p === null ? null : Math.round(p),
    inRow: s.top >= -0.5 && s.bottom <= m.bottom + 0.5,
    onScreen: s.top >= -0.5 && s.bottom <= innerHeight + 0.5,
    aligned: p !== null && Math.abs(p - sphere) <= 1,
    scrollW: document.documentElement.scrollWidth,
  });
})()`;

const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = targets.find((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
if (!page) {
  console.error('No debuggable page found on :9222. Is Chrome running with --remote-debugging-port=9222?');
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
};
const send = (method, params) => new Promise((res) => {
  const myId = ++id;
  pending.set(myId, res);
  ws.send(JSON.stringify({ id: myId, method, params }));
});

const pad = (s, n) => String(s).padStart(n);
console.log(`${pad('viewport', 11)} ${pad('hdr', 4)} ${pad('main', 5)} ${pad('dock', 5)} ${pad('orb w×h', 10)} ${pad('top', 5)} ${pad('sphere', 7)} ${pad('pill', 5)}  verdict`);
console.log('-'.repeat(84));

let failures = 0;
for (const [w, h] of SIZES) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await new Promise((r) => setTimeout(r, 220));
  const res = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
  const d = JSON.parse(res.result.result.value);
  if (d.error) { console.error(d.error); await send('Emulation.clearDeviceMetricsOverride', {}); ws.close(); process.exit(1); }

  const problems = [];
  if (!d.onScreen) problems.push('OFF-SCREEN');
  if (!d.inRow) problems.push('OVERFLOWS-ROW');
  if (d.scrollW > d.vw) problems.push('H-SCROLL');
  if (problems.length) failures++;
  const verdict = problems.length
    ? '✗ ' + problems.join(',')
    : (d.aligned ? '✓ ok (aligned)' : '✓ ok (orb height-capped, dock wider)');
  console.log(`${pad(w + 'x' + h, 11)} ${pad(d.header, 4)} ${pad(d.main, 5)} ${pad(d.dock, 5)} ${pad(d.sceneW + 'x' + d.sceneH, 10)} ${pad(d.sceneTop, 5)} ${pad(d.sphere, 7)} ${pad(d.pill ?? '-', 5)}  ${verdict}`);
}
console.log('-'.repeat(84));
console.log(failures ? `FAILURES: ${failures}/${SIZES.length}` : `ALL ${SIZES.length} VIEWPORTS PASS`);

await send('Emulation.clearDeviceMetricsOverride', {});
ws.close();
process.exit(failures ? 1 : 0);
