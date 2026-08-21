// Lab module — widget init, Patent Office, and DM widget logic

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STATE ACCESS
// All variables shared with sidepanel.js are accessed via window.Lab namespace.
// sidepanel.js populates window.Lab before lab.js runs any functions.
// ─────────────────────────────────────────────────────────────────────────────

const L = () => window.Lab; // accessor — always read fresh, never cache

// ─────────────────────────────────────────────────────────────────────────────
// DOM REFERENCES  (lab panel elements, safe to declare at module load time
// because this script loads at the bottom of <body>)
// ─────────────────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const labInventBtn     = $("labInventBtn");
const labDiscussBtn    = $("labDiscussBtn");
const labInvText       = $("labInvText");
const labInvPlaceholder= $("labInvPlaceholder");
const labDoomBar       = $("labDoomBar");
const labDoomFill      = $("labDoomFill");
const labDoomPct       = $("labDoomPct");

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DM_INVENT_COST = 25;    // Dark Matter cost per invention
const DM_MEGA_COST   = 150;   // Dark Matter cost for Mega-Invention
const MAX_ACTIVE     = 10;    // max active (non-scrap) inventions before oldest auto-scraps
const MAX_SCRAP      = 10;    // max scrap heap items before oldest is permanently deleted
const SCRAP_YIELD    = 10;    // DM earned when scrapping a normal invention
const RECYCLED_YIELD = 5;     // DM earned when scrapping a recycled invention
const RECYCLE_COST   = 5;     // scrap items needed to create a recycled invention

// ─────────────────────────────────────────────────────────────────────────────
// INVENTION GENERATION
// ─────────────────────────────────────────────────────────────────────────────

async function _refreshInventBtnState() {
  if (!labInventBtn) return;
  const dm = await window.getDarkMatter();
  const canAfford = dm >= DM_INVENT_COST;
  labInventBtn.disabled = !L().crew || !canAfford;
  labInventBtn.textContent = `⚗️ GENERATE INVENTION (${DM_INVENT_COST} ⚛️)`;
  labInventBtn.title = canAfford
    ? `Costs ${DM_INVENT_COST} Dark Matter`
    : `Need ${DM_INVENT_COST} ⚛️ Dark Matter — earn more passively`;
}

async function genInvention() {
  if (!L().crew) {
    L().setStatus("⚠️ Go to Settings and enter an API key first.");
    document.querySelector('.tab[data-tab="settings"]')?.click();
    return;
  }
  const spent = await window.spendDarkMatter(DM_INVENT_COST, "Invention");
  if (!spent) {
    L().setStatus(`⚛️ Need ${DM_INVENT_COST} Dark Matter to generate an invention. Keep exploring!`, 3000);
    return;
  }
  if (labInventBtn) labInventBtn.disabled = true;
  if (labInvPlaceholder) labInvPlaceholder.style.display = "none";
  if (labInvText) {
    labInvText.style.display = "block";
    labInvText.textContent = "Good news, everyone! The Professor is in his lab…";
  }
  try {
    await L().crew.genInvention((evt) => {
      if (evt.type === "invention") _showInvention(evt.text);
    });
  } catch(e) {
    if (labInvText) labInvText.textContent = "⚠️ Invention generation failed: " + e.message;
    L().setStatus("⚠️ " + e.message);
  } finally {
    await _refreshInventBtnState();
  }
}

async function discussInvention() {
  if (!L().crew || !L().crew.todayInvention) {
    L().setStatus("⚠️ Generate an invention first!");
    return;
  }
  document.querySelector('.tab[data-tab="chat"]')?.click();
  await new Promise(r => setTimeout(r, 60));
  const chatInput = $("chatInput");
  if (chatInput) {
    chatInput.value = `Tell me more about this invention: ${L().crew.todayInvention}`;
    chatInput.dispatchEvent(new Event("input"));
    L().sendMessage();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTION RATING & NAME EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────

const _RATING_POS = /wonderful|brilliant|perfect|useful|safe|harmless|benefit|excel|magnific|splendid|delight/i;
const _RATING_NEG = /catastroph|doom|destroy|deadly|lethal|fatal|kill|annihilat|extinct|explos|melt|obliterat|impossible to control|certain death|terrible/i;

function _rateInvention(text) {
  if (_RATING_NEG.test(text)) return "failure";
  if (_RATING_POS.test(text)) return "success";
  return "unknown";
}

function _inventionName(text) {
  // Strip recycled preamble so downstream patterns find the invention verb/name
  const stripped = text
    .replace(/from the ashes of failure[^,!.]*[,!.]\s*/i, "")
    .replace(/salvaging[^,!.]*[,!.]\s*/i, "");
  const patterns = [
    /(?:invented?|created?|built|developed|designed|constructed|assembled|salvaged?|forged?|fashioned?)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s*[.!,]|$)/i,
    /(?:behold[,.]?\s+(?:the\s+)?|introducing\s+(?:the\s+)?|presenting\s+(?:the\s+)?)(.+?)(?:\s*[.!,]|$)/i,
  ];
  for (const pat of patterns) {
    const m = stripped.match(pat);
    if (m && m[1] && m[1].trim().length > 3) {
      let name = m[1].trim().replace(/^(a|an|the)\s+/i, "");
      name = name.replace(/\s+(?:—|–|that|which|capable|designed|intended|allowing|enabling|causing).*/i, "");
      return name.slice(0, 80);
    }
  }
  return stripped.replace(/^good news,?\s+everyone[!.]?\s*/i, "").slice(0, 60);
}

// ─────────────────────────────────────────────────────────────────────────────
// _showInvention — renders invention in the lab card, triggers critique + save
// ─────────────────────────────────────────────────────────────────────────────

function _showInvention(text, isMega = false, isRecycled = false) {
  if (labInvText) { labInvText.style.display = "block"; labInvText.textContent = text; }
  if (labInvPlaceholder) labInvPlaceholder.style.display = "none";
  if (labDiscussBtn) labDiscussBtn.disabled = false;
  const doom = Math.floor(60 + Math.random() * 39);
  if (labDoomBar) labDoomBar.style.display = "flex";
  if (labDoomFill) labDoomFill.style.width = `${doom}%`;
  if (labDoomPct)  labDoomPct.textContent  = `${doom}%`;
  if (L().crew) L().crew.todayInvention = text;

  if (L().crew && L().llmClient) {
    setTimeout(() => {
      const critiqueEl = $("labInvCritique");
      if (critiqueEl) {
        critiqueEl.style.display = "block";
        critiqueEl.innerHTML = `<span class="lab-critique-loading">…</span>`;
      }
      let critiqueText = "", critiqueAgent = "";
      L().crew.genInventionCritique(text, (evt) => {
        if (!critiqueEl) return;
        if (evt.type === "speaker") {
          critiqueAgent = evt.agent;
          const char = L().CHARS?.[evt.agent] || [evt.agent, "🤖", "#ABB2BF"];
          critiqueEl.innerHTML =
            `<span class="lab-critique-agent" style="color:${char[2]}">${char[1]} ${char[0]}:</span> ` +
            `<span class="lab-critique-text" id="labCritiqueText"></span>`;
        }
        if (evt.type === "token") {
          const t = document.getElementById("labCritiqueText");
          if (t) t.textContent += evt.text;
          critiqueText += evt.text;
          L().tts.push(evt.text, evt.agent);
        }
        if (evt.type === "turn_end") {
          L().tts.flush(evt.agent);
          const rating = _rateInvention(text);
          const name   = _inventionName(text);
          L().db.saveInvention(name, text, critiqueText, critiqueAgent, rating, isMega, isRecycled)
            .then(() => _enforceInventionCaps())
            .then(() => _renderPatentOffice())
            .catch(() => {});
        }
      }).catch(() => {
        if (critiqueEl) critiqueEl.style.display = "none";
        L().db.saveInvention(_inventionName(text), text, "", "", _rateInvention(text), isMega, isRecycled)
          .then(() => _enforceInventionCaps())
          .then(() => _renderPatentOffice())
          .catch(() => {});
      });
    }, 800);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PATENT OFFICE
// ─────────────────────────────────────────────────────────────────────────────

let _patentFilter = "all"; // "all" | "success" | "scrap"

async function _renderPatentOffice() {
  const gallery    = $("patentGallery");
  const empty      = $("patentEmpty");
  const countEl    = $("patentCount");
  const megaWrap   = $("megaInventBtn");
  const recycleBtn = $("patentRecycleBtn");
  if (!gallery) return;

  let all = [];
  try { all = await L().db.getInventions(); } catch { return; }

  const active  = all.filter(i => !i.isScrap);
  const success = all.filter(i => !i.isScrap && (i.rating === "success" || i.isRecycled));
  const scrap   = all.filter(i =>  i.isScrap);

  if (countEl) countEl.textContent =
    `${active.length} patent${active.length !== 1 ? "s" : ""}`;

  if (megaWrap) megaWrap.style.display = active.length >= 2 ? "block" : "none";

  if (recycleBtn) {
    const show = _patentFilter === "scrap" && scrap.length >= RECYCLE_COST;
    recycleBtn.style.display = show ? "block" : "none";
  }

  const list = _patentFilter === "all"     ? active
             : _patentFilter === "success" ? success
             : scrap;

  if (empty) {
    empty.style.display = list.length ? "none" : "block";
    if (!list.length) empty.textContent =
      _patentFilter === "all"     ? "No patents filed yet — generate your first invention above."
      : _patentFilter === "success" ? "No successful inventions yet. The Professor remains optimistic."
      : "The Scrap Heap is empty. Not even Zoidberg could mess this up.";
  }

  gallery.querySelectorAll(".patent-card").forEach(el => el.remove());

  for (const inv of list) {
    const icon = inv.isRecycled ? "♻️"
               : inv.isMega    ? "💥"
               : inv.isScrap   ? "🗑️"
               : inv.rating === "success" ? "🧪"
               : inv.rating === "failure" ? "💀" : "❓";

    const date = new Date(inv.ts).toLocaleDateString(undefined, { month:"short", day:"numeric" });
    const scrapYield  = inv.isRecycled ? RECYCLED_YIELD : SCRAP_YIELD;
    let badge = "";
    if (inv.isRecycled) badge = '<span class="patent-recycled-badge">RECYCLED</span>';
    else if (inv.isMega) badge = '<span class="patent-mega-badge">MEGA</span>';

    const scrapBtnHtml = !inv.isScrap
      ? `<button class="patent-card-scrap" data-id="${inv.id}" data-yield="${scrapYield}">🗑 SCRAP (+${scrapYield} ⚛️)</button>`
      : `<button class="patent-card-del"   data-id="${inv.id}">🗑 DELETE</button>`;

    const card = document.createElement("div");
    card.className = "patent-card";
    card.dataset.id = inv.id;
    card.innerHTML = `
      <div class="patent-card-header">
        <span class="patent-card-icon">${icon}</span>
        <span class="patent-card-name">${_esc(inv.name)}${badge}</span>
        <span class="patent-card-meta">${date}</span>
      </div>
      <div class="patent-card-body">
        <div class="patent-card-text">${_esc(inv.text)}</div>
        ${inv.critique ? `<div class="patent-card-critique"><strong>${_esc(inv.critiqueAgent)}</strong>: ${_esc(inv.critique)}</div>` : ""}
        <div class="patent-card-actions">${scrapBtnHtml}</div>
      </div>`;

    card.querySelector(".patent-card-header").addEventListener("click", () =>
      card.classList.toggle("expanded"));

    const scrapBtn = card.querySelector(".patent-card-scrap");
    if (scrapBtn) scrapBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await L().db.scrapInvention(inv.id);
      await window.earnDarkMatter(scrapYield, `Scrap: ${inv.name.slice(0,20)}`);
      _renderPatentOffice();
    });

    const delBtn = card.querySelector(".patent-card-del");
    if (delBtn) delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await L().db.deleteInvention(inv.id);
      _renderPatentOffice();
    });

    gallery.appendChild(card);
  }
}

function _esc(str) {
  return (str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function _enforceInventionCaps() {
  try {
    const all    = await L().db.getInventions();
    const active = all.filter(i => !i.isScrap).sort((a,b) => a.ts.localeCompare(b.ts));

    if (active.length > MAX_ACTIVE) {
      const toScrap = active.slice(0, active.length - MAX_ACTIVE);
      for (const inv of toScrap) await L().db.scrapInvention(inv.id);
    }

    const refreshedScrap = (await L().db.getInventions())
      .filter(i => i.isScrap).sort((a,b) => a.ts.localeCompare(b.ts));
    if (refreshedScrap.length > MAX_SCRAP) {
      const toDel = refreshedScrap.slice(0, refreshedScrap.length - MAX_SCRAP);
      for (const inv of toDel) await L().db.deleteInvention(inv.id);
    }
  } catch {}
}

// Filter tab wiring
["patentTabAll","patentTabGood","patentTabScrap"].forEach(id => {
  const btn = $(id);
  if (!btn) return;
  btn.addEventListener("click", () => {
    document.querySelectorAll(".patent-tab").forEach(t => t.classList.remove("patent-tab-active"));
    btn.classList.add("patent-tab-active");
    _patentFilter = btn.dataset.filter;
    _renderPatentOffice();
  });
});

// Mega-Invention
const labMegaBtn = $("labMegaBtn");
if (labMegaBtn) labMegaBtn.addEventListener("click", genMegaInvention);

async function genMegaInvention() {
  if (!L().crew) { L().setStatus("⚠️ Connect an API key first."); return; }
  const spent = await window.spendDarkMatter(DM_MEGA_COST, "Mega-Invention");
  if (!spent) {
    L().setStatus(`⚛️ Need ${DM_MEGA_COST} Dark Matter for a Mega-Invention. Keep exploring!`, 3500);
    return;
  }
  let allInvs = [];
  try { allInvs = (await L().db.getInventions()).filter(i => !i.isScrap); } catch {}
  if (allInvs.length < 2) {
    L().setStatus("⚠️ Need at least 2 active inventions in the Patent Office.");
    return;
  }
  const shuffled = [...allInvs].sort(() => Math.random() - .5);
  const a = shuffled[0], b = shuffled[1];

  if (labMegaBtn) labMegaBtn.disabled = true;
  if (labInvPlaceholder) labInvPlaceholder.style.display = "none";
  if (labInvText) { labInvText.style.display = "block"; labInvText.textContent = "Good news, everyone! I'm combining two of my greatest works into one!"; }
  if (labDoomBar) labDoomBar.style.display = "flex";
  if (labDoomFill) labDoomFill.style.width = "99%";
  if (labDoomPct) labDoomPct.textContent = "99%";

  try {
    await L().crew.genMegaInvention(a.name, b.name, (evt) => {
      if (evt.type === "invention") _showInvention(evt.text, true, false);
    });
  } catch(e) {
    if (labInvText) labInvText.textContent = "⚠️ Mega-Invention failed: " + e.message;
  } finally {
    if (labMegaBtn) labMegaBtn.disabled = false;
  }
}

// Scrap Heap recycling
const patentRecycleBtn = $("patentRecycleBtn");
if (patentRecycleBtn) patentRecycleBtn.addEventListener("click", genRecycledInvention);

async function genRecycledInvention() {
  if (!L().crew) { L().setStatus("⚠️ Connect an API key first."); return; }
  let scrapItems = [];
  try { scrapItems = (await L().db.getInventions()).filter(i => i.isScrap); } catch {}
  if (scrapItems.length < RECYCLE_COST) {
    L().setStatus(`⚠️ Need ${RECYCLE_COST} items in the Scrap Heap to recycle.`);
    return;
  }
  const toConsume = scrapItems.sort((a,b) => a.ts.localeCompare(b.ts)).slice(0, RECYCLE_COST);
  for (const inv of toConsume) await L().db.deleteInvention(inv.id);

  if (patentRecycleBtn) patentRecycleBtn.disabled = true;
  if (labInvText) { labInvText.style.display = "block"; labInvText.textContent = "Good news, everyone! I'm salvaging the best parts from the scrap heap!"; }

  try {
    const names = toConsume.map(i => i.name).join(", ");
    await L().crew.genRecycledInvention(names, (evt) => {
      if (evt.type === "invention") _showInvention(evt.text, false, true);
    });
  } catch(e) {
    if (labInvText) labInvText.textContent = "⚠️ Recycling failed: " + e.message;
  } finally {
    if (patentRecycleBtn) patentRecycleBtn.disabled = false;
    _renderPatentOffice();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK MATTER WIDGET
// ─────────────────────────────────────────────────────────────────────────────

const DM_DIGIT_IDS = ["dm0","dm1","dm2","dm3","dm4","dm5","dm6"];

function _dmRender(value) {
  const clamped = Math.min(Math.max(Math.floor(value) || 0, 0), 9_999_999);
  const str     = String(clamped).padStart(7, "0");
  DM_DIGIT_IDS.forEach((id, i) => {
    const el = $(id);
    if (el) el.textContent = str[i];
  });
}

function _dmFlash(value) {
  _dmRender(value);
  DM_DIGIT_IDS.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.classList.add("dm-flash");
    setTimeout(() => el.classList.remove("dm-flash"), 300);
  });
  const spark = $("dmSpark");
  if (spark) {
    spark.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const p = document.createElement("div");
      p.className = "dm-spark-particle";
      const angle = (i / 5) * 2 * Math.PI;
      p.style.setProperty("--dx", `${Math.cos(angle) * 16}px`);
      p.style.setProperty("--dy", `${Math.sin(angle) * 16}px`);
      p.style.left = "14px"; p.style.top = "14px";
      spark.appendChild(p);
    }
  }
}

// DM Usage History — 5-item ring buffer
const _dmHistory  = [];
const DM_HIST_MAX = 5;

function _dmHistoryPush(entry) {
  _dmHistory.unshift(entry);
  if (_dmHistory.length > DM_HIST_MAX) _dmHistory.pop();
  _dmHistoryRender();
}

function _dmHistoryRender() {
  const el = $("dmHistory");
  if (!el) return;
  if (!_dmHistory.length) {
    el.innerHTML = '<span class="dm-hist-empty">No activity yet</span>';
    return;
  }
  el.innerHTML = _dmHistory.map(h => {
    const sign  = h.type === "earn" ? "+" : "−";
    const color = h.type === "earn" ? "#00d4ff" : "#e87010";
    const time  = new Date(h.ts).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    return `<span class="dm-hist-row">` +
      `<span class="dm-hist-label">${_esc(h.label)}</span>` +
      `<span class="dm-hist-delta" style="color:${color}">${sign}${h.amount} ⚛️</span>` +
      `<span class="dm-hist-time">${time}</span>` +
    `</span>`;
  }).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// DARK MATTER API (window-level so background.js messages can trigger them)
// ─────────────────────────────────────────────────────────────────────────────

window.getDarkMatter = () => new Promise(resolve => {
  chrome.runtime.sendMessage({ type: "dm_get" }, (res) => {
    resolve((res && !chrome.runtime.lastError) ? res.darkMatter : 0);
  });
});

window.spendDarkMatter = (amount, label = "") => new Promise(resolve => {
  chrome.runtime.sendMessage({ type: "dm_spend", amount, label }, (res) => {
    resolve((res && !chrome.runtime.lastError) ? res.ok : false);
  });
});

window.earnDarkMatter = (amount, label = "") => new Promise(resolve => {
  chrome.runtime.sendMessage({ type: "dm_earn", amount, label }, (res) => {
    resolve((res && !chrome.runtime.lastError) ? res.ok : false);
  });
});

// DM message listener (dm_update broadcast from background)
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  if (msg.type === "dm_update") {
    _dmFlash(msg.darkMatter);
    _refreshInventBtnState();
    if (msg.spent)  _dmHistoryPush({ ts: Date.now(), amount: msg.spent,  label: msg.label || "Spent",  type: "spend" });
    if (msg.amount) _dmHistoryPush({ ts: Date.now(), amount: msg.amount, label: msg.label || "Earned", type: "earn"  });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AFFIRMATION WIDGET (_initWidget)
// ─────────────────────────────────────────────────────────────────────────────

function _initWidget() {
  const WIDGET_AFFIRMATIONS = L().WIDGET_AFFIRMATIONS;

  let _widgetIdx    = Math.floor(Math.random() * WIDGET_AFFIRMATIONS.length);
  let _widgetPaused = false;
  let _widgetTimer  = null;

  const nextBtn  = $("widgetNextBtn");
  const pauseBtn = $("widgetPauseBtn");
  const avatar   = $("widgetAvatar");

  function _widgetNext() {
    _widgetIdx = (_widgetIdx + 1) % WIDGET_AFFIRMATIONS.length;
    _widgetDisplay(WIDGET_AFFIRMATIONS[_widgetIdx]);
  }

  function _widgetDisplay(q) {
    const quoteEl   = $("widgetQuote");
    const charName  = $("widgetCharName");
    const charSub   = $("widgetCharSub");
    const idxEl     = $("widgetQuoteId");
    const chars     = L().CHARS || {};
    // WIDGET_AFFIRMATIONS schema: {char, color, quote}
    const charData  = chars[q.char] || [q.char, "🍕", q.color || "#ABB2BF"];
    if (quoteEl)  quoteEl.textContent  = q.quote;
    if (charName) charName.textContent = q.char;
    if (charSub)  charSub.textContent  = charData[0] ? "" : "";  // sub not used
    if (avatar)   avatar.textContent   = charData[1] || "🍕";
    if (idxEl)    idxEl.textContent    = `${_widgetIdx + 1} / ${WIDGET_AFFIRMATIONS.length}`;
  }

  if (nextBtn)  nextBtn.addEventListener("click",  () => { _widgetNext(); });
  if (pauseBtn) pauseBtn.addEventListener("click", () => {
    _widgetPaused = !_widgetPaused;
    pauseBtn.textContent = _widgetPaused ? "▶ RESUME" : "⏸ PAUSE";
  });
  if (avatar) avatar.addEventListener("click", () => _widgetNext());

  _widgetDisplay(WIDGET_AFFIRMATIONS[_widgetIdx]);

  _widgetTimer = setInterval(() => {
    if (!_widgetPaused && $("panel-lab")?.classList.contains("active")) _widgetNext();
  }, 30000);
}

// ─────────────────────────────────────────────────────────────────────────────
// LAB WIDGET ORCHESTRATION
// ─────────────────────────────────────────────────────────────────────────────

let _labWidgetsStarted = false;

function _startLabWidgets() {
  if (_labWidgetsStarted) {
    requestAnimationFrame(() => {
      if (typeof window.wbg_startAuto    === "function") window.wbg_startAuto();
      if (typeof window.wml_startAuto    === "function") window.wml_startAuto();
      if (typeof window.wnn_scheduleAuto === "function") window.wnn_scheduleAuto();
    });
    return;
  }
  _labWidgetsStarted = true;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    _wireWidgetButtons();
  }));
}

function _wireWidgetButtons() {
  // No flavor widgets active — lab contains only affirmation widget (wired at init)
  // and Patent Office / DM widget (wired above at module load time)
}

// ─────────────────────────────────────────────────────────────────────────────
// DM INIT — read current balance on load
// ─────────────────────────────────────────────────────────────────────────────

chrome.runtime.sendMessage({ type: "dm_get" }, (res) => {
  if (chrome.runtime.lastError || !res) return;
  _dmRender(res.darkMatter);
});

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS — called by sidepanel.js init()
// ─────────────────────────────────────────────────────────────────────────────

window.LabModule = {
  initWidget:          _initWidget,
  renderPatentOffice:  _renderPatentOffice,
  refreshInventBtn:    _refreshInventBtnState,
  startLabWidgets:     _startLabWidgets,
};
