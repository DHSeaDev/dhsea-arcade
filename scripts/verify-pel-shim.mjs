/**
 * shim.spec.mjs — gate suite for the PEL web port's shim layer.
 *
 * Runs in a REAL Chromium, not jsdom: speechSynthesis, localStorage
 * partitioning and the visibility API are the things under test, and an
 * emulator attests none of them.
 *
 * Every assertion group carries a KNOWN-ANSWER CONTROL — a case whose answer
 * is known independently of the code being tested — because a harness that
 * cannot fail proves nothing about the app. Controls are asserted to FAIL.
 */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHIM = readFileSync(join(HERE, "../src-games/planet-express-lounge/pe-web-shim.js"), "utf8");
const BG   = readFileSync(join(HERE, "../src-games/planet-express-lounge/pe-web-background.js"), "utf8");
// The REAL arcade shim, read from the repo — not a hand-written stand-in.
// A fake would have agreed with whatever assumption this file was written under.
const ARCADE = readFileSync(join(HERE, "../shared/chrome-shim.js"), "utf8");

const results = [];
const ok   = (name, cond, detail = "") => results.push({ name, pass: !!cond, detail });
const fail = (name, detail) => results.push({ name, pass: false, detail });

// A real HTTP origin, not about:blank — localStorage is denied on an opaque
// origin, and the whole storage layer under test is origin-scoped.
const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<!doctype html><title>Planet Express Lounge</title><body>");
}).listen(0);
const ORIGIN = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const newPage = async () => {
  const p = await browser.newPage();
  await p.goto(ORIGIN);
  return p;
};

const page = await newPage();
page.on("pageerror", (e) => fail("page threw", e.message));
await page.addScriptTag({ content: SHIM });

// ── 0. Harness control ───────────────────────────────────────────────────────
// Prove the harness can report a failure before trusting any pass it emits.
{
  const control = await page.evaluate(() => 1 + 1 === 3);
  ok("CONTROL harness can fail", control === false,
     control === false ? "control correctly false" : "HARNESS IS BROKEN");
}

// ── 1. Storage ───────────────────────────────────────────────────────────────
{
  const r = await page.evaluate(async () => {
    await chrome.storage.local.set({ darkMatter: 42, nested: { a: [1, 2] } });
    const got     = await chrome.storage.local.get(["darkMatter", "nested"]);
    const missing = await chrome.storage.local.get(["nope"]);
    const deflt   = await chrome.storage.local.get({ nope: "fallback", darkMatter: 0 });
    const rawKey  = localStorage.getItem("pel:darkMatter");
    const unprefixed = localStorage.getItem("darkMatter");
    await chrome.storage.local.remove("darkMatter");
    const after = await chrome.storage.local.get(["darkMatter"]);
    return { got, missing, deflt, rawKey, unprefixed, after };
  });
  ok("storage round-trips a number", r.got.darkMatter === 42);
  ok("storage round-trips a nested object", JSON.stringify(r.got.nested) === '{"a":[1,2]}');
  ok("absent key yields {} not undefined-valued key", Object.keys(r.missing).length === 0);
  ok("object form supplies defaults", r.deflt.nope === "fallback" && r.deflt.darkMatter === 42);
  ok("keys are namespaced under pel:", r.rawKey === "42");
  ok("CONTROL nothing written unprefixed", r.unprefixed === null,
     "an unprefixed write would collide with the seven arcade games");
  ok("remove deletes", !("darkMatter" in r.after));
}

// ── 2. Coexistence with the arcade's own shim (real bytes) ───────────────────
// shared/chrome-shim.js seats a COMPLETE chrome.runtime whose onMessage is a
// no-op event and whose sendMessage resolves undefined. Present-but-dead reads
// identically to absent unless the probe is behavioural, and getting this wrong
// takes the whole Dark Matter economy down silently.
{
  const p2 = await newPage();
  await p2.addScriptTag({ content: ARCADE });          // arcade first — worst case
  const before = await p2.evaluate(() => ({
    hasRuntime: !!chrome.runtime,
    onMessageExists: !!chrome.runtime.onMessage?.addListener,
  }));
  await p2.addScriptTag({ content: SHIM });
  const after = await p2.evaluate(async () => {
    let got = null;
    chrome.runtime.onMessage.addListener((m, s, respond) => {
      if (m.type === "probe") { got = s.id; respond({ ok: true }); }
      return false;
    });
    const res = await chrome.runtime.sendMessage({ type: "probe" });
    return { res, got, senderMatchesRuntimeId: got === chrome.runtime.id, id: chrome.runtime.id };
  });
  ok("arcade shim seats a PRESENT-BUT-DEAD runtime (the hazard is real)",
     before.hasRuntime && before.onMessageExists,
     "confirms the collision exists in the repo's actual bytes, not in theory");
  ok("live bus replaces the no-op even when arcade loads first", after.res?.ok === true);
  ok("sender.id equals runtime.id (lab.js's guard)", after.senderMatchesRuntimeId);
  ok("CONTROL runtime.id stays undefined", after.id === undefined,
     "verify.mjs reads a truthy runtime.id as a real extension context and FAILS the shim check");
  await p2.close();
}

// ── 3. Message bus — both call styles ────────────────────────────────────────
{
  const r = await page.evaluate(async () => {
    const out = {};
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === "sync_ping") { out.senderId = sender.id; sendResponse({ pong: 1 }); return false; }
      if (msg.type === "async_ping") { setTimeout(() => sendResponse({ pong: 2 }), 20); return true; }
      return false;
    });
    out.promiseSync  = await chrome.runtime.sendMessage({ type: "sync_ping" });
    out.promiseAsync = await chrome.runtime.sendMessage({ type: "async_ping" });
    out.cb = await new Promise((res) =>
      chrome.runtime.sendMessage({ type: "async_ping" }, (v) => res({ v, err: chrome.runtime.lastError })));
    out.unhandled = await new Promise((res) =>
      chrome.runtime.sendMessage({ type: "nobody_listens" }, (v) => res({ v, err: chrome.runtime.lastError?.message })));
    out.afterCb = chrome.runtime.lastError;
    out.idMatches = chrome.runtime.id === out.senderId;
    return out;
  });
  ok("promise form, sync responder", r.promiseSync?.pong === 1);
  ok("promise form, async responder (return true)", r.promiseAsync?.pong === 2);
  ok("callback form receives response", r.cb?.v?.pong === 2);
  ok("callback form: no lastError on success", !r.cb?.err);
  ok("sender.id matches runtime.id (lab.js gates on this)", r.idMatches);
  ok("unhandled message sets lastError", !!r.unhandled?.err && r.unhandled.v === undefined);
  ok("CONTROL lastError cleared after the callback window", r.afterCb === undefined,
     "a sticky lastError would make lab.js discard every later valid response");
}

// ── 4. TTS mapping ───────────────────────────────────────────────────────────
{
  const r = await page.evaluate(async () => {
    const voices = await new Promise((res) => {
      chrome.tts.getVoices(res);
      setTimeout(() => res([]), 800);
    });
    const shapeOk = voices.length === 0 ||
      voices.every((v) => typeof v.voiceName === "string" && typeof v.remote === "boolean");
    const hasWebName = voices.some((v) => "name" in v);   // must NOT leak the web shape

    // The wedge case: tts.js sets _isSpeaking=true BEFORE calling speak and
    // only clears it from an event. A speak that fires nothing kills the queue
    // for the rest of the session. Headless Chromium has no voices, so this is
    // exactly the no-voice path — it MUST still emit a terminal event.
    const evt = await new Promise((res) => {
      let seen = null;
      chrome.tts.speak("Good news, everyone.", {
        rate: 1, pitch: 1, volume: 1, enqueue: false,
        onEvent: (e) => { if (["end","interrupted","error","cancelled"].includes(e.type) && !seen) { seen = e.type; res(e.type); } },
      });
      setTimeout(() => res(seen || "NO_EVENT"), 3000);
    });
    return { count: voices.length, shapeOk, hasWebName, evt };
  });
  ok("getVoices returns chrome.tts shape", r.shapeOk, `${r.count} voices`);
  ok("CONTROL web-speech `name` field is not leaked", !r.hasWebName,
     "tts.js reads v.voiceName; a leaked shape silently disables voice selection");
  ok("speak always emits a terminal event (queue cannot wedge)", r.evt !== "NO_EVENT", `got: ${r.evt}`);
}

// ── 5. Dark Matter engine ────────────────────────────────────────────────────
{
  const p3 = await newPage();
  p3.on("pageerror", (e) => fail("DM page threw", e.message));
  await p3.evaluate(() => localStorage.clear());
  await p3.addScriptTag({ content: SHIM });

  // Seed a last-tick 30 minutes in the past BEFORE the engine boots.
  await p3.evaluate(() => {
    localStorage.setItem("pel:darkMatter", "0");
    localStorage.setItem("pel:dmLastTick", JSON.stringify(Date.now() - 30 * 60_000));
  });
  await p3.addScriptTag({ content: BG });
  await p3.waitForFunction(() => !!globalThis.__PE_DM__);
  await p3.waitForTimeout(300);

  const r = await p3.evaluate(async () => {
    const dm = await globalThis.__PE_DM__.getDarkMatter();
    const spendOk   = await chrome.runtime.sendMessage({ type: "dm_spend", amount: 5, label: "test" });
    const afterSpend = (await chrome.runtime.sendMessage({ type: "dm_get" })).darkMatter;
    const overspend = await chrome.runtime.sendMessage({ type: "dm_spend", amount: 9_999_999, label: "too much" });
    const afterOver = (await chrome.runtime.sendMessage({ type: "dm_get" })).darkMatter;
    return { dm, spendOk: spendOk.ok, afterSpend, overspend: overspend.ok, afterOver, title: document.title };
  });
  // 30 ticks × [1..7] ⇒ strictly inside [30, 210]. Known-answer bounds.
  ok("offline accrual pays elapsed ticks", r.dm >= 30 && r.dm <= 210, `30min away ⇒ ${r.dm} DM (bounds 30..210)`);
  ok("dm_spend debits", r.spendOk && r.afterSpend === r.dm - 5);
  ok("CONTROL overspend is refused and changes nothing", r.overspend === false && r.afterOver === r.afterSpend);
  ok("badge ported to document.title", /⚛/.test(r.title), r.title);

  // Cap: a week away must not pay a week.
  const capped = await p3.evaluate(async () => {
    localStorage.setItem("pel:darkMatter", "0");
    localStorage.setItem("pel:dmLastTick", JSON.stringify(Date.now() - 7 * 24 * 60 * 60_000));
    await globalThis.__PE_DM__.settleOfflineAccrual();
    return globalThis.__PE_DM__.getDarkMatter();
  });
  // Ceiling derived from the shipped constant, not hardcoded — a cap change must
  // not silently loosen its own gate.
  const CAP = await p3.evaluate(() => globalThis.__PE_DM__.OFFLINE_CAP_MIN);
  ok("offline accrual is capped", capped <= CAP * 7 && capped >= CAP,
     `7 days away ⇒ ${capped} DM (cap ${CAP} ticks ⇒ ceiling ${CAP * 7})`);

  // Persistence across a reload — the property the whole shim exists for.
  const before = await p3.evaluate(() => globalThis.__PE_DM__.getDarkMatter());
  await p3.reload();
  await p3.addScriptTag({ content: SHIM });
  await p3.evaluate(() => localStorage.setItem("pel:dmLastTick", JSON.stringify(Date.now())));
  await p3.addScriptTag({ content: BG });
  await p3.waitForFunction(() => !!globalThis.__PE_DM__);
  const after = await p3.evaluate(() => globalThis.__PE_DM__.getDarkMatter());
  ok("balance survives a reload", after === before, `${before} → ${after}`);
  await p3.close();
}

// ── 6. Regressions found by adversarial review, not by a gate ────────────────
// Each of these shipped once. A defect a review catches and no gate covers means
// the gate set was incomplete, so each finding becomes an assertion here.
{
  const p4 = await newPage();
  await p4.evaluate(() => localStorage.clear());

  // 6a. DOUBLE EXECUTION. Both shim files were injected by the build AND
  // hand-written into the entry document, so each ran twice: two DM engines
  // double-charging every spend, two tickers, and __PE_SHIM__ rebound to a
  // dispatcher with an empty listener set — so every broadcast reached nobody.
  // The tags are gone, and both files now no-op on a second run. Assert the
  // GUARD, because the tags can come back.
  await p4.addScriptTag({ content: SHIM });
  await p4.addScriptTag({ content: BG });
  await p4.waitForFunction(() => !!globalThis.__PE_DM__);
  const firstDispatch = await p4.evaluate(() => {
    globalThis.__probe = 0;
    chrome.runtime.onMessage.addListener((m) => { if (m.type === "probe") globalThis.__probe++; return false; });
    return true;
  });
  await p4.addScriptTag({ content: SHIM });     // run both a second time
  await p4.addScriptTag({ content: BG });
  const dbl = await p4.evaluate(async () => {
    const before = (await chrome.runtime.sendMessage({ type: "dm_get" })).darkMatter;
    await chrome.runtime.sendMessage({ type: "dm_earn", amount: 100, label: "t" });
    const after = (await chrome.runtime.sendMessage({ type: "dm_get" })).darkMatter;
    globalThis.__PE_SHIM__.dispatch({ type: "probe" });
    return { delta: after - before, probeSeen: globalThis.__probe };
  });
  ok("double-run does not double-credit", firstDispatch && dbl.delta === 100, `+100 earned, balance moved ${dbl.delta}`);
  ok("double-run does not orphan the broadcast bus", dbl.probeSeen === 1,
     `__PE_SHIM__.dispatch reached ${dbl.probeSeen} listener(s) — 0 means lab.js never sees dm_update`);

  // 6b. THE CAP MUST ACTUALLY CAP. The first version advanced the clock only by
  // the ticks it PAID, keeping the remainder — which made the cap a per-settle
  // rate limit. settleOfflineAccrual re-runs on every visibilitychange, so a
  // long absence could be drained by alt-tabbing. Settle repeatedly and assert
  // the total stays inside ONE capped payout.
  const farm = await p4.evaluate(async () => {
    localStorage.setItem("pel:darkMatter", "0");
    localStorage.setItem("pel:dmLastTick", JSON.stringify(Date.now() - 30 * 24 * 60 * 60_000));
    for (let i = 0; i < 25; i++) await globalThis.__PE_DM__.settleOfflineAccrual();
    return globalThis.__PE_DM__.getDarkMatter();
  });
  const CAP2 = await p4.evaluate(() => globalThis.__PE_DM__.OFFLINE_CAP_MIN);
  // Twenty-five settles of a 30-day gap would reach tens of thousands if the
  // remainder carried forward. One capped payout ceilings at CAP x 7.
  ok("CONTROL repeated settles cannot farm a long absence", farm <= CAP2 * 7,
     `30 days away, settled 25x => ${farm} DM (single-payout ceiling ${CAP2 * 7})`);

  // 6c. FIRST-VISIT SEED — the Lab must be usable on arrival, and a visitor who
  // has legitimately spent down to zero must NOT be re-seeded.
  const seed = await p4.evaluate(async () => {
    localStorage.removeItem("pel:dmLastTick");
    localStorage.setItem("pel:darkMatter", "0");
    await globalThis.__PE_DM__.settleOfflineAccrual();
    const fresh = await globalThis.__PE_DM__.getDarkMatter();
    // Now simulate a real visitor who spent everything: clock exists, balance 0.
    localStorage.setItem("pel:darkMatter", "0");
    localStorage.setItem("pel:dmLastTick", JSON.stringify(Date.now()));
    await globalThis.__PE_DM__.settleOfflineAccrual();
    return { fresh, spentDown: await globalThis.__PE_DM__.getDarkMatter() };
  });
  ok("first visit can afford an invention immediately", seed.fresh >= 25, `${seed.fresh} DM on arrival (invention costs 25)`);
  ok("CONTROL a spent-down visitor is not re-seeded", seed.spentDown === 0, `${seed.spentDown} DM`);
  await p4.close();
}

await browser.close();
server.close();

// ── Report ───────────────────────────────────────────────────────────────────
let passed = 0;
for (const r of results) {
  if (r.pass) passed++;
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
}
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
