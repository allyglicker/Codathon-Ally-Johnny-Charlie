/* Neur — Screen 2: the Launch Desk, driven by real events.
 *
 * Reads the founder profile from Screen 1 (sessionStorage), POSTs it to /plan,
 * then plays result["events"] in order. ONE function, applyEvent(), reads each
 * event's `state` and calls setState on the right character. No per-agent branches.
 * Everything on screen (trays, checks, caption, roadmap) comes from the real output.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var money = function (v) { return "$" + Math.round(v).toLocaleString(); };
  var params = new URLSearchParams(location.search);
  var API = params.get("api") || "";
  var FORCE_DEMO = params.get("demo") === "1";

  var CHAR = { market: "market", legal: "legal", finance: "finance", manager: "ward" };
  var SLOT = { market: "n-market", legal: "n-legal", finance: "n-finance", manager: "n-ward" };
  var STATUS = { market: "st-market", legal: "st-legal", finance: "st-finance", manager: "st-ward" };

  var CAPTIONS = {
    "manager.dispatch": ["Ward", "Ward sends the work out", "He hands the profile to the specialists."],
    "manager.forward": ["Ward", "Ward passes along a note", "Something one agent found that another needs."],
    "finance.waiting": ["Penny", "Penny waits her turn", "She needs the price and the legal costs first."],
    "market.received": ["Scout", "Scout studies the market", "Customers, competitors and a fair price."],
    "legal.received": ["Quill", "Quill checks the rules", "Licenses, structure and local requirements."],
    "legal.done": ["Quill", "Quill reports back", "Here's what it takes to be legal, and the cost."],
    "market.note": ["Scout", "Scout reads Quill's note", "He adjusts the sales plan to fit the rules."],
    "market.done": ["Scout", "Scout reports back", "Who buys, how often, and the starting price."],
    "finance.received": ["Penny", "Penny runs the numbers", "The calculator does the math, not a guess."],
    "finance.done": ["Penny", "Penny reports back", "Startup cost, break-even and runway."],
    "manager.review": ["Ward", "Ward checks the answers", "Do the three agree? He looks for conflicts."],
    "manager.conflict": ["Ward", "Ward spots something", "A conflict to resolve before the plan is final."],
    "manager.exchange": ["Ward", "Ward asks a follow-up", "One quick question to firm up a number."],
    "manager.roadmap": ["Ward", "Your plan is ready", "Ward hands back one launch roadmap."],
  };

  var chars = {}, result = null, events = [], idx = 0, playing = true, speed = 1, timer = null;

  // ---------- boot ----------
  function boot() {
    var profile = readProfile();
    fillFounder(profile);
    initCharacters();
    wireControls();

    var url = API + "/plan" + (FORCE_DEMO ? "?demo=1" : "");
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ founder_profile: profile }) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); })
      .then(function (res) { result = res; startRun(); })
      .catch(function (err) { showError(err.message || String(err)); });
  }

  function readProfile() {
    var p = null;
    try { p = JSON.parse(sessionStorage.getItem("neur_profile") || "null"); } catch (e) { /* ignore */ }
    return p || { idea: "Homemade cookies", location: "Milledgeville, GA", startup_budget: 1500, hours_per_week: 10, timeline: "Open within 3 months", experience: "First-time founder" };
  }

  function fillFounder(p) {
    $("f-idea").textContent = p.idea || "Your idea";
    $("f-dl").innerHTML =
      row("Where", p.location) + row("Budget", money(p.startup_budget)) +
      row("Time", p.hours_per_week + " hours a week") + row("Opening", shortTimeline(p.timeline)) +
      (p.experience ? row("Experience", p.experience) : "");
    function row(k, v) { return "<dt>" + k + "</dt><dd>" + esc(v || "—") + "</dd>"; }
  }
  function shortTimeline(t) { return String(t || "").replace(/^Open\s+/i, "").replace(/^(\w)/, function (m) { return m.toUpperCase(); }); }

  function initCharacters() {
    chars.ward = window.createWard($("c-ward"));
    chars.legal = window.createQuill($("c-quill"));
    chars.market = window.createMarket($("c-market"));
    chars.finance = window.createFinance($("c-finance"));
  }

  // ---------- run loop ----------
  function startRun() {
    setEyebrow();
    events = result.events || [];
    idx = 0; playing = true;
    $("play").textContent = "Pause";
    schedule();
  }

  function baseDelay() { return (result && result.mode === "demo" ? 2000 : 1600) / speed; }

  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    if (idx >= events.length) { finish(); return; }
    applyEvent(events[idx]); idx++;
    updateBar();
    timer = setTimeout(schedule, baseDelay());
  }

  function stepOnce() {
    playing = false; $("play").textContent = "Play";
    clearTimeout(timer);
    if (idx >= events.length) { finish(); return; }
    applyEvent(events[idx]); idx++; updateBar();
  }

  function updateBar() { $("bar").style.width = Math.round((idx / Math.max(1, events.length)) * 100) + "%"; }

  function finish() {
    updateBar();
    var cap = CAPTIONS["manager.roadmap"];
    showSeePlan();
  }

  // THE one function that drives every character from an event's state.
  function applyEvent(ev) {
    var agent = ev.agent, state = ev.state;
    var c = chars[CHAR[agent]];
    if (c) c.setState(state);
    setStatus(agent, state);
    flash(SLOT[agent]);

    var cap = CAPTIONS[ev.event];
    if (cap) { $("cap-who").textContent = cap[0]; $("cap-title").textContent = cap[1]; $("cap-body").textContent = cap[2]; }

    if (ev.frm && ev.to && ev.tab) flyFolder(ev);
    if (/\.done$/.test(ev.event) && SLOT[agent] !== "n-ward") dropChip(agent, ev);

    if (ev.event === "legal.done") markWait("w-legal");
    if (ev.event === "market.done") markWait("w-market");
    if (ev.event === "manager.review" || ev.event === "manager.conflict") runChecks();
    if (ev.event === "manager.roadmap") fillRoadmap();
  }

  function setStatus(agent, state) {
    var el = $(STATUS[agent]); if (!el) return;
    var text = { idle: "idle", waiting: "waiting", working: "working…", flagging: "flagged a blocker", done: "done", delegating: "sending work" }[state] || state;
    el.textContent = text;
    el.className = "status" + (state === "working" || state === "waiting" || state === "delegating" ? " busy" : state === "done" ? " good" : "");
  }

  function flash(id) { var el = $(id); if (!el) return; el.classList.add("flash"); setTimeout(function () { el.classList.remove("flash"); }, 650); }
  function markWait(id) { var el = $(id); if (el) el.classList.add("done"); }

  function dropChip(agent, ev) {
    var tray = $("t-" + agent); if (!tray) return;
    var out = (result.outputs || {})[agent] || {};
    var est = ev.est || hasEstimate(out);
    var hot = out.signal === "flag";
    var chip = document.createElement("span");
    chip.className = "chip" + (est ? " e" : "") + (hot ? " hot" : "");
    chip.textContent = ev.tab;
    tray.appendChild(chip);
  }
  function hasEstimate(out) { var n = out.numbers || {}; return Object.keys(n).some(function (k) { return n[k] && n[k].basis === "estimate"; }); }

  // Flying manila folder (sticky note for market.note / forward).
  function flyFolder(ev) {
    var fly = $("fly");
    var fromEl = slotForName(ev.frm), toEl = slotForName(ev.to);
    if (!fromEl || !toEl) return;
    var box = $("stage").getBoundingClientRect();
    var a = center(fromEl, box), b = center(toEl, box);
    var f = document.createElement("div");
    var isNote = /note/i.test(ev.tab || "") || ev.note;
    var isFinal = ev.event === "manager.roadmap";
    f.className = "folder" + (ev.est ? " est" : "") + (isNote ? " note" : "") + (isFinal ? " final" : "");
    f.innerHTML = '<span class="lbl">' + esc(ev.frm || "") + '</span><span class="tab">' + esc(ev.tab) + "</span>";
    f.style.transform = "translate(" + (a.x - 75) + "px," + (a.y - 20) + "px)";
    f.style.transition = "transform 1.4s cubic-bezier(.4,.1,.2,1), opacity .4s";
    fly.appendChild(f);
    requestAnimationFrame(function () { requestAnimationFrame(function () { f.style.transform = "translate(" + (b.x - 75) + "px," + (b.y - 20) + "px)"; }); });
    setTimeout(function () { f.style.opacity = "0"; }, 1700 / speed);
    setTimeout(function () { f.remove(); }, 2150 / speed);
  }
  function slotForName(name) {
    var n = (name || "").toLowerCase();
    if (n.indexOf("ward") >= 0) return $("n-ward");
    if (n.indexOf("scout") >= 0) return $("n-market");
    if (n.indexOf("quill") >= 0) return $("n-legal");
    if (n.indexOf("penny") >= 0) return $("n-finance");
    if (n.indexOf("founder") >= 0) return $("n-roadmap");
    return null;
  }
  function center(el, box) { var r = el.getBoundingClientRect(); return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 }; }

  // Ward's five checks, from the real numbers.
  function runChecks() {
    var o = result.outputs || {}, m = o.market || {}, l = o.legal || {}, f = o.finance || {};
    var n = f.numbers || {}, mn = m.numbers || {};
    var p = result.founder_profile || readProfile();
    var startup = val(n.startup_cost_total), be = val(n.break_even_units_per_month), runway = val(n.runway_months);
    var cpu = val(n.cost_per_unit), price = val(mn.price_per_unit), budget = Number(p.startup_budget || 0);
    var cust = val(mn.est_monthly_customers), upc = val(mn.units_per_customer_per_month);
    var capacity = (cust != null && upc != null) ? cust * upc : null;
    setCheck("budget", startup != null && budget ? (startup <= budget ? "pass" : "fail") : "warn");
    setCheck("price", (price != null && cpu != null) ? (price > cpu * 1.2 ? "pass" : price > cpu ? "warn" : "fail") : "warn");
    setCheck("legal", l.signal === "flag" ? "fail" : "pass");
    setCheck("capacity", (be != null && capacity != null) ? (be <= capacity ? "pass" : "warn") : "warn");
    setCheck("runway", runway != null ? (runway >= 6 ? "pass" : "warn") : "warn");
  }
  function setCheck(k, s) { var li = document.querySelector('#checks li[data-k="' + k + '"]'); if (li) li.setAttribute("data-s", s); }

  // Fill the roadmap list from Ward's roadmap + the agents' numbers.
  function fillRoadmap() {
    var o = result.outputs || {}, m = o.market || {}, l = o.legal || {}, f = o.finance || {}, mgr = o.manager || {};
    var rm = mgr.roadmap || {}, n = f.numbers || {}, mn = m.numbers || {};
    var price = val(mn.price_per_unit), cust = val(mn.est_monthly_customers);
    var startup = val(n.startup_cost_total), be = val(n.break_even_units_per_month);
    var unit = f.unit_definition || m.unit_definition || "unit";
    setLi("one_sentence", esc(rm.one_sentence || ""));
    setLi("sell", (price != null ? "Start at " + fmtMoney(price) + " per " + esc(shortUnit(unit)) + ". " : "") + (cust != null ? "About " + Math.round(cust) + " customers a month " + estTag(mn.est_monthly_customers) : ""));
    setLi("money", (startup != null ? money(startup) + " to start. " : "") + (be != null ? "Break-even " + be + " " + esc(plural(unit)) + " a month " + estTag(n.break_even_units_per_month) : ""));
    setLi("legal", esc((l.next_steps || l.key_findings || []).slice(0, 2).join("; ")));
    setLi("watch", esc((rm.watch_out || []).map(function (w) { return typeof w === "string" ? w : (w.title || w.text || ""); }).slice(0, 2).join(" · ")));
    setLi("steps", esc((rm.first_steps || []).slice(0, 5).join(" → ")));
    setLi("verdict", '<span class="verdict">' + esc(rm.verdict_title || "Launch plan") + "</span>");
  }
  function setLi(k, html) {
    var li = document.querySelector('#roadmap li[data-k="' + k + '"]');
    if (!li) return;
    li.classList.add("on");
    var txt = li.querySelector(".txt"); if (txt) txt.innerHTML = html;
  }
  function estTag(numObj) { return (numObj && numObj.basis === "estimate") ? '<span class="est">estimate</span>' : ""; }

  // ---------- controls ----------
  function wireControls() {
    $("play").addEventListener("click", function () {
      playing = !playing; this.textContent = playing ? "Pause" : "Play";
      if (playing) schedule();
    });
    $("step").addEventListener("click", stepOnce);
    $("reset").addEventListener("click", function () { if (result) { resetStage(); startRun(); } });
    $("speed").addEventListener("change", function () { speed = Number(this.value) || 1; });
  }

  function resetStage() {
    clearTimeout(timer);
    ["t-market", "t-legal", "t-finance"].forEach(function (id) { $(id).innerHTML = ""; });
    $("w-market").classList.remove("done"); $("w-legal").classList.remove("done");
    ["budget", "price", "legal", "capacity", "runway"].forEach(function (k) { setCheck(k, "pending"); });
    [].forEach.call(document.querySelectorAll("#roadmap li"), function (li) { li.classList.remove("on"); var t = li.querySelector(".txt"); if (t) t.innerHTML = ""; });
    $("fly").innerHTML = "";
    $("seeplan-wrap").innerHTML = "";
    ["market", "legal", "finance", "manager"].forEach(function (a) { setStatus(a, "idle"); });
    Object.keys(chars).forEach(function (k) { try { chars[k].setState("idle"); } catch (e) {} });
  }

  function showSeePlan() {
    var wrap = $("seeplan-wrap"); if (!wrap || wrap.children.length) return;
    try { sessionStorage.setItem("neur_result", JSON.stringify(result)); } catch (e) { /* ignore */ }
    var b = document.createElement("button");
    b.className = "primary"; b.type = "button"; b.textContent = "See my plan";
    b.addEventListener("click", function () { location.href = "plan.html" + (location.search || ""); });
    wrap.appendChild(b);
  }

  function setEyebrow() {
    if (result && result.used_saved_answers) $("eyebrow").textContent = "Neur · launch planner · sample data";
    if (result && result.warnings) result.warnings.forEach(function (w) { console.warn("[neur]", w); });
  }

  function showError(msg) {
    $("cap-who").textContent = "Something went wrong";
    $("cap-title").textContent = "Couldn't reach the team";
    $("cap-body").textContent = msg + "  — is the backend running (python api/server.py), or open with ?demo=1?";
  }

  // ---------- helpers ----------
  function val(o) { return o && o.value != null ? Number(o.value) : null; }
  function fmtMoney(v) { return "$" + (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, ""); }
  function shortUnit(u) { return String(u || "unit").replace(/^one\s+/i, "").split(" ").slice(0, 3).join(" "); }
  function plural(u) { var s = shortUnit(u); return /s$/.test(s) ? s : s + "s"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  boot();
})();
