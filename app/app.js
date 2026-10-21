/* Neur front end.
 *
 * Three screens: intake (5 questions) -> team at work (plays result.events in
 * order) -> roadmap. Every agent call goes through the backend's POST /plan,
 * which runs run_pipeline(); the UI never calls agents directly.
 *
 * The whole team screen is driven by one function, applyEvent(), which reads
 * each event's `state` and calls setState on the right character. No per-agent
 * branches in the animation path (integration handoff 4.1).
 */
(function () {
  "use strict";

  // Where the backend lives. Same origin by default; override with ?api=...
  var API = new URLSearchParams(location.search).get("api") || "";
  // ?demo=1 forces demo mode on stage (also a hidden "d" keypress, below).
  var FORCE_DEMO = new URLSearchParams(location.search).get("demo") === "1";

  var $ = function (id) { return document.getElementById(id); };
  var money = function (v) { return "$" + Math.round(v).toLocaleString(); };

  // ---------- intake ----------

  var QUESTIONS = [
    {
      key: "idea", type: "text",
      ask: "What's your dream?",
      hint: "Describe your business idea in a sentence. Tap an example to start.",
      placeholder: "e.g. Homemade cookies sold from my kitchen",
      chips: [
        "Homemade cookies sold from my kitchen",
        "A dog-walking service in my neighborhood",
        "Handmade candles I sell online",
        "A weekend coffee cart",
      ],
    },
    {
      key: "location", type: "text",
      ask: "Where will you run it?",
      hint: "City and state. Legal rules depend on it.",
      placeholder: "e.g. Milledgeville, GA",
      chips: ["Milledgeville, GA", "Austin, TX", "Portland, OR", "Columbus, OH"],
    },
    {
      key: "startup_budget", type: "slider",
      ask: "How much can you put in to start?",
      hint: "A rough number is fine. You can change the plan later.",
      min: 100, max: 10000, step: 100, value: 1500,
      format: function (v) { return money(v); },
    },
    {
      key: "hours_per_week", type: "chips-one",
      ask: "How many hours a week can you give it?",
      hint: "Be honest. This caps how much you can make and sell.",
      options: [
        { label: "About 5", value: 5 }, { label: "About 10", value: 10 },
        { label: "About 20", value: 20 }, { label: "Full time (40)", value: 40 },
      ],
      value: 10,
    },
    {
      key: "timeline", type: "chips-one",
      ask: "When do you want to open?",
      hint: "",
      options: [
        { label: "Within 1 month", value: "Open within 1 month" },
        { label: "Within 3 months", value: "Open within 3 months" },
        { label: "Within 6 months", value: "Open within 6 months" },
        { label: "Just exploring", value: "Still exploring, no fixed date" },
      ],
      value: "Open within 3 months",
    },
  ];

  var answers = {
    idea: "", location: "", startup_budget: 1500, hours_per_week: 10,
    timeline: "Open within 3 months", experience: "First-time founder",
  };
  var step = 0;

  function renderSteps() {
    var box = $("steps");
    box.innerHTML = "";
    QUESTIONS.forEach(function (_, i) {
      var i2 = document.createElement("i");
      if (i <= step) i2.className = "on";
      box.appendChild(i2);
    });
  }

  function renderQuestion() {
    var q = QUESTIONS[step];
    var el = $("question");
    var h = '<div class="q"><span class="num">Question ' + (step + 1) + " of " + QUESTIONS.length + '</span>' +
      '<div class="ask">' + q.ask + "</div>" +
      (q.hint ? '<p class="hint">' + q.hint + "</p>" : "");

    if (q.type === "text") {
      h += '<input type="text" id="in-text" placeholder="' + q.placeholder + '" value="' +
        String(answers[q.key] || "").replace(/"/g, "&quot;") + '">';
      h += '<div class="chips" id="in-chips">' +
        q.chips.map(function (c) { return '<button class="chip" type="button" data-v="' + c.replace(/"/g, "&quot;") + '">' + c + "</button>"; }).join("") +
        "</div>";
    } else if (q.type === "slider") {
      h += '<div class="slider"><div class="val" id="sl-val">' + q.format(answers[q.key]) + "</div>" +
        '<input type="range" id="in-slider" min="' + q.min + '" max="' + q.max + '" step="' + q.step + '" value="' + answers[q.key] + '"></div>';
    } else if (q.type === "chips-one") {
      h += '<div class="chips" id="in-one">' +
        q.options.map(function (o) {
          var on = String(answers[q.key]) === String(o.value);
          return '<button class="chip" type="button" role="button" aria-pressed="' + on + '" data-v="' + String(o.value).replace(/"/g, "&quot;") + '">' + o.label + "</button>";
        }).join("") + "</div>";
    }
    h += "</div>";
    el.innerHTML = h;

    if (q.type === "text") {
      var input = $("in-text");
      input.focus();
      input.addEventListener("input", function () { answers[q.key] = input.value.trim(); syncNext(); });
      $("in-chips").addEventListener("click", function (e) {
        var b = e.target.closest(".chip"); if (!b) return;
        input.value = b.dataset.v; answers[q.key] = b.dataset.v; syncNext();
      });
    } else if (q.type === "slider") {
      var sl = $("in-slider");
      sl.addEventListener("input", function () { answers[q.key] = Number(sl.value); $("sl-val").textContent = q.format(answers[q.key]); });
    } else if (q.type === "chips-one") {
      $("in-one").addEventListener("click", function (e) {
        var b = e.target.closest(".chip"); if (!b) return;
        var o = q.options.filter(function (x) { return String(x.value) === b.dataset.v; })[0];
        answers[q.key] = o ? o.value : b.dataset.v;
        [].forEach.call(this.children, function (c) { c.setAttribute("aria-pressed", c === b); });
      });
    }

    $("back").style.visibility = step === 0 ? "hidden" : "visible";
    $("next").textContent = step === QUESTIONS.length - 1 ? "Build my plan" : "Next";
    syncNext();
    renderSteps();
  }

  function syncNext() {
    var q = QUESTIONS[step];
    var ok = true;
    if (q.type === "text") ok = String(answers[q.key] || "").length > 1;
    $("next").disabled = !ok;
  }

  $("next").addEventListener("click", function () {
    if (step < QUESTIONS.length - 1) { step++; renderQuestion(); }
    else start();
  });
  $("back").addEventListener("click", function () {
    if (step > 0) { step--; renderQuestion(); }
  });

  // ---------- characters ----------

  var chars = {};
  function initCharacters() {
    if (chars.ward) return;
    chars.ward = window.createWard($("c-ward"));
    chars.legal = window.createQuill($("c-quill"));
    chars.market = window.createMarket($("c-market"));
    chars.finance = window.createFinance($("c-finance"));
  }

  // ---------- the run ----------

  function start() {
    var profile = {
      idea: answers.idea, location: answers.location,
      startup_budget: answers.startup_budget, hours_per_week: answers.hours_per_week,
      timeline: answers.timeline, experience: answers.experience,
    };
    showScreen("team");
    fillFounder(profile);
    initCharacters();

    var url = API + "/plan" + (FORCE_DEMO ? "?demo=1" : "");
    var body = JSON.stringify({ founder_profile: profile });
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); })
      .then(function (result) { playRun(result); })
      .catch(function (err) { showError(err.message || String(err)); });
  }

  function showScreen(which) {
    $("screen-intake").classList.toggle("hidden", which !== "intake");
    $("screen-team").classList.toggle("hidden", which !== "team");
    $("screen-plan").classList.toggle("hidden", which !== "plan");
  }

  function fillFounder(p) {
    $("f-idea").textContent = p.idea || "Your idea";
    $("f-dl").innerHTML =
      row("Where", p.location) + row("Budget", money(p.startup_budget)) +
      row("Time", p.hours_per_week + " hours a week") + row("Opening", p.timeline);
    function row(k, v) { return "<dt>" + k + "</dt><dd>" + (v || "—") + "</dd>"; }
  }

  // Map an agent id used in events to the DOM node id for its slot.
  var SLOT = { market: "n-market", legal: "n-legal", finance: "n-finance", manager: "n-ward" };
  var STATUS = { market: "st-market", legal: "st-legal", finance: "st-finance", manager: "st-ward" };
  var CHAR = { market: "market", legal: "legal", finance: "finance", manager: "ward" };

  // Short captions keyed by event name. Plain language, one line each.
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

  function playRun(result) {
    window.__neur = result; // handy for debugging
    setMode(result);
    resetDesk();
    var events = result.events || [];
    var i = 0;
    var stepDelay = result.mode === "demo" ? 1100 : 850;

    (function tick() {
      if (i >= events.length) {
        // Hold the final frame briefly, then show the roadmap.
        setTimeout(function () { renderPlan(result); showScreen("plan"); }, 900);
        return;
      }
      applyEvent(events[i], result);
      i++;
      setTimeout(tick, stepDelay);
    })();
  }

  // THE one function that drives every character from an event's state.
  function applyEvent(ev, result) {
    var agent = ev.agent;
    var state = ev.state; // idle | waiting | working | flagging | done | delegating

    // 1. Set the character's state (every character accepts the universal names).
    var c = chars[CHAR[agent]];
    if (c) c.setState(state);

    // 2. Status line + slot flash.
    setStatus(agent, state);
    flash(SLOT[agent]);

    // 3. Caption.
    var cap = CAPTIONS[ev.event];
    if (cap) { $("cap-who").textContent = cap[0]; $("cap-title").textContent = cap[1]; $("cap-body").textContent = cap[2]; }

    // 4. Log line for any handoff that carries a folder.
    if (ev.tab) logLine(ev);

    // 5. Fly a folder and drop a chip in Ward's tray when a specialist finishes.
    if (ev.frm && ev.to && ev.tab) flyFolder(ev);
    if (/\.(done)$/.test(ev.event) && SLOT[agent] !== "n-ward") dropChip(agent, ev, result);

    // 6. Penny's "waits" ticks.
    if (ev.event === "legal.done") markWait("w-legal");
    if (ev.event === "market.done") markWait("w-market");
  }

  function setStatus(agent, state) {
    var el = $(STATUS[agent]); if (!el) return;
    var text = {
      idle: "idle", waiting: "waiting", working: "working…",
      flagging: "flagged a blocker", done: "done", delegating: "sending work",
    }[state] || state;
    el.textContent = text;
    el.className = "status" + (state === "working" || state === "waiting" || state === "delegating" ? " busy" : state === "done" ? " good" : state === "flagging" ? " flag" : "");
  }

  function flash(slotId) {
    var el = $(slotId); if (!el) return;
    el.classList.add("flash");
    setTimeout(function () { el.classList.remove("flash"); }, 650);
  }

  function markWait(id) { var el = $(id); if (el) el.classList.add("done"); }

  function resetDesk() {
    ["t-market", "t-legal", "t-finance"].forEach(function (id) { $(id).innerHTML = ""; });
    $("log").innerHTML = "";
    $("w-market").classList.remove("done"); $("w-legal").classList.remove("done");
  }

  function logLine(ev) {
    var box = $("log");
    var who = ev.frm || "", to = ev.to || "";
    var line = document.createElement("div");
    line.innerHTML = "<b>" + who + " \u2192 " + to + ":</b> " + escapeHtml(ev.tab) + (ev.note ? " — " + escapeHtml(ev.note) : "");
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  // Which agent's tray a chip belongs in (manager folders don't get a tray chip).
  function dropChip(agent, ev, result) {
    var tray = $("t-" + agent); if (!tray) return;
    var out = (result.outputs || {})[agent] || {};
    var est = ev.est || hasEstimate(out);
    var hot = (out.signal === "flag");
    var chip = document.createElement("span");
    chip.className = "mchip" + (est ? " e" : "") + (hot ? " hot" : "");
    chip.textContent = ev.tab;
    tray.appendChild(chip);
  }

  function hasEstimate(out) {
    var nums = out.numbers || {};
    return Object.keys(nums).some(function (k) { return nums[k] && nums[k].basis === "estimate"; });
  }

  // Animate a manila folder from one slot to another.
  function flyFolder(ev) {
    var fly = $("fly");
    var fromEl = slotForName(ev.frm), toEl = slotForName(ev.to);
    if (!fromEl || !toEl) return;
    var stageBox = $("stage").getBoundingClientRect();
    var a = center(fromEl, stageBox), b = center(toEl, stageBox);

    var f = document.createElement("div");
    var isNote = /note/i.test(ev.tab) || ev.note;
    var isFinal = ev.event === "manager.roadmap";
    f.className = "folder" + (ev.est ? " est" : "") + (isNote ? " note" : "") + (isFinal ? " final" : "");
    f.innerHTML = '<span class="lbl">' + escapeHtml((ev.frm || "") ) + "</span><span class=\"tab\">" + escapeHtml(ev.tab) + "</span>";
    f.style.transform = "translate(" + (a.x - 75) + "px," + (a.y - 20) + "px)";
    f.style.transition = "transform .8s cubic-bezier(.4,.1,.2,1), opacity .3s";
    fly.appendChild(f);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        f.style.transform = "translate(" + (b.x - 75) + "px," + (b.y - 20) + "px)";
      });
    });
    setTimeout(function () { f.style.opacity = "0"; }, 820);
    setTimeout(function () { f.remove(); }, 1150);
  }

  // Map a folder's frm/to name (Ward, Scout, Quill, Penny, Founder) to a slot node.
  function slotForName(name) {
    var n = (name || "").toLowerCase();
    if (n.indexOf("ward") >= 0) return $("n-ward");
    if (n.indexOf("scout") >= 0) return $("n-market");
    if (n.indexOf("quill") >= 0) return $("n-legal");
    if (n.indexOf("penny") >= 0) return $("n-finance");
    if (n.indexOf("founder") >= 0) return $("n-roadmapmini");
    return null;
  }

  function center(el, stageBox) {
    var r = el.getBoundingClientRect();
    return { x: r.left - stageBox.left + r.width / 2, y: r.top - stageBox.top + r.height / 2 };
  }

  // ---------- mode / sample-data tag ----------

  function setMode(result) {
    var tag = $("mode-tag");
    tag.innerHTML = "";
    if (result.used_saved_answers) {
      var s = document.createElement("span");
      s.className = "sample-tag";
      s.textContent = "Sample data";
      s.title = "Some or all answers came from Neur's saved demo answers.";
      tag.appendChild(s);
    }
    if (result.warnings && result.warnings.length) {
      result.warnings.forEach(function (w) { console.warn("[neur]", w); });
    }
  }

  // ---------- screen 3: roadmap ----------

  function renderPlan(result) {
    var out = result.outputs || {};
    var market = out.market || {}, legal = out.legal || {}, finance = out.finance || {}, manager = out.manager || {};
    var roadmap = manager.roadmap || {};
    var nums = finance.numbers || {};

    var startup = val(nums.startup_cost_total);
    var breakEven = val(nums.break_even_units_per_month);
    var runway = val(nums.runway_months);
    var costPerUnit = val(nums.cost_per_unit);
    var monthlyFixed = val(nums.monthly_fixed_costs);
    var price = val((market.numbers || {}).price_per_unit);
    var unit = finance.unit_definition || market.unit_definition || "unit";

    var verdictTitle = roadmap.verdict_title || "Your launch plan";
    var verdictBody = roadmap.verdict_text || roadmap.go_verdict || "";
    var verdictClass = classifyVerdict(roadmap.verdict || verdictTitle);

    var sample = result.used_saved_answers
      ? '<span class="sample-tag">Sample data</span>' : "";

    var h = "";
    h += '<div class="toprow"><h2>Your launch plan</h2><div style="display:flex;gap:8px;align-items:center">' + sample +
      '<button class="ghost" id="restart" type="button">Start over</button></div></div>';

    // verdict banner
    h += '<div class="verdict-banner ' + verdictClass + '"><span class="dot"></span><div>' +
      '<div class="v-title">' + escapeHtml(verdictTitle) + "</div>" +
      (verdictBody ? '<div class="v-sub">' + escapeHtml(verdictBody) + "</div>" : "") +
      "</div></div>";

    // three big numbers
    h += '<div class="bignums">' +
      bignum("Cost to open", startup == null ? "—" : money(startup), "what it takes to get started", true) +
      bignum("Sales to break even", breakEven == null ? "—" : breakEven + "/mo", "units a month to cover your bills", true) +
      bignum("How long the money lasts", runway == null ? "—" : (runway.toFixed(1) + " mo"), "with no sales at all", true) +
      "</div>";

    // price slider (recalculates break-even instantly with the calculator's formula)
    if (price != null && costPerUnit != null && monthlyFixed != null) {
      var pmin = Math.max(0.5, Math.floor((costPerUnit + 0.5)));
      var pmax = Math.max(pmin + 1, Math.ceil(price * 2));
      h += '<div class="pricebox"><div class="row"><div><div class="card-title">Try a different price</div>' +
        '<div class="price" id="pb-price">' + fmtMoney(price) + ' <span style="font-size:14px;color:var(--muted)">per ' + escapeHtml(unit) + "</span></div></div>" +
        '<div class="be">break-even <b id="pb-be"></b> / month</div></div>' +
        '<input type="range" id="pb-slider" min="' + pmin + '" max="' + pmax + '" step="0.25" value="' + price + '">' +
        '<div class="card-title" id="pb-note"></div></div>';
    }

    // Will it sell? + Getting legal
    h += '<div class="cards">';
    var sellInner = (roadmap.one_sentence ? '<p class="card-title" style="text-transform:none;letter-spacing:0;font-size:13.5px;color:var(--ink)">' + escapeHtml(roadmap.one_sentence) + "</p>" : "") +
      list(market.key_findings, 3) +
      (price != null ? '<p class="card-title">Starting price: ' + fmtMoney(price) + " per " + escapeHtml(unit) + "</p>" : "");
    h += card("Will it sell?", sellInner);
    h += card("Getting legal", list(legal.next_steps && legal.next_steps.length ? legal.next_steps : legal.key_findings, 5));
    h += "</div>";

    // Watch out for
    var watch = collectWatch(market, legal, finance, manager);
    if (watch.length) {
      h += '<div class="card watch"><h3>Watch out for</h3><ul>' +
        watch.map(function (w) {
          return "<li>" + (w.severity ? '<span class="sev ' + w.severity + '">' + w.severity + "</span> " : "") +
            (w.title ? "<b>" + escapeHtml(w.title) + "</b> " : "") + escapeHtml(w.risk) +
            (w.fix ? ' <span class="fix">' + escapeHtml(w.fix) + "</span>" : "") + "</li>";
        }).join("") + "</ul></div>";
    }

    // First 5 steps
    var steps = roadmap.first_steps || roadmap.steps || firstStepsFallback(market, legal, finance);
    if (steps && steps.length) {
      h += '<div class="card"><h3>Your first 5 steps</h3><ol>' +
        steps.slice(0, 5).map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("") + "</ol></div>";
    }

    h += '<p class="foot">Neur gives general guidance, not legal, tax or financial advice. Confirm legal and tax steps with your local Small Business Development Center (SBDC) or a professional.</p>';

    $("screen-plan").innerHTML = h;
    $("restart").addEventListener("click", function () { location.reload(); });

    // wire the price slider
    if (price != null && costPerUnit != null && monthlyFixed != null) {
      var slider = $("pb-slider");
      var update = function () {
        var p = Number(slider.value);
        $("pb-price").innerHTML = fmtMoney(p) + ' <span style="font-size:14px;color:var(--muted)">per ' + escapeHtml(unit) + "</span>";
        var be = breakEvenAt(p, costPerUnit, monthlyFixed);
        $("pb-be").textContent = be == null ? "never (price below cost)" : be + "";
        var note = "";
        if (be == null) note = "At this price every sale loses money.";
        else if (breakEven != null && be < breakEven) note = "Lower than before — you'd need fewer sales to break even.";
        else if (breakEven != null && be > breakEven) note = "Higher than before — you'd need more sales.";
        $("pb-note").textContent = note;
      };
      slider.addEventListener("input", update);
      update();
    }
  }

  // Same formula as finance_calc.run_finance_math: ceil(monthly_fixed / (price - cost_per_unit)).
  function breakEvenAt(price, costPerUnit, monthlyFixed) {
    var profit = price - costPerUnit;
    if (profit <= 0) return null;
    return Math.ceil(monthlyFixed / profit);
  }

  function classifyVerdict(title) {
    var t = (title || "").toLowerCase();
    if (t.indexOf("change") >= 0) return "changes";
    if (t.indexOf("test") >= 0 || t.indexOf("not") >= 0 || t.indexOf("wait") >= 0) return "test";
    return "go";
  }

  function collectWatch(market, legal, finance, manager) {
    // Prefer Ward's curated "watch_out" list from the roadmap (title/text/fix).
    var roadmap = manager.roadmap || {};
    var curated = roadmap.watch_out || roadmap.watch_out_for || roadmap.watch;
    if (curated && curated.length) {
      return curated.slice(0, 5).map(function (w) {
        if (typeof w === "string") return { severity: "", title: "", risk: w, fix: "" };
        var fix = "";
        if (w.fix) fix = typeof w.fix === "string" ? w.fix : (w.fix.label ? "Try: " + w.fix.label : "");
        return { severity: w.severity || "", title: w.title || "", risk: w.text || w.risk || w.issue || "", fix: fix };
      });
    }
    // Otherwise fall back to the specialists' own risks, highest severity first.
    var all = [];
    [market, legal, finance].forEach(function (o) {
      (o.risks || []).forEach(function (r) {
        var risk = r.risk || "", fix = "";
        var m = /\bfix:\s*(.*)$/i.exec(risk);
        if (m) { fix = "Fix: " + m[1]; risk = risk.slice(0, m.index).trim(); }
        all.push({ severity: r.severity || "low", title: "", risk: risk, fix: fix });
      });
    });
    var order = { high: 0, medium: 1, low: 2 };
    all.sort(function (a, b) { return (order[a.severity] || 3) - (order[b.severity] || 3); });
    return all.slice(0, 5);
  }

  function firstStepsFallback(market, legal, finance) {
    var steps = [];
    (legal.next_steps || []).forEach(function (s) { steps.push(s); });
    (market.next_steps || []).forEach(function (s) { steps.push(s); });
    (finance.next_steps || []).forEach(function (s) { steps.push(s); });
    return steps;
  }

  // ---------- little helpers ----------

  function val(numObj) { return numObj && numObj.value != null ? Number(numObj.value) : null; }
  function fmtMoney(v) { return "$" + (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, ""); }
  function bignum(k, n, d) { return '<div class="bignum"><div class="k">' + k + '</div><div class="n">' + n + '</div><div class="d">' + d + "</div></div>"; }
  function card(title, inner) { return '<div class="card"><h3>' + title + "</h3>" + inner + "</div>"; }
  function list(items, max) {
    items = (items || []).slice(0, max || 5);
    if (!items.length) return '<p class="hint">No details available.</p>';
    return "<ul>" + items.map(function (i) { return "<li>" + escapeHtml(typeof i === "string" ? i : (i.text || JSON.stringify(i))) + "</li>"; }).join("") + "</ul>";
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function showError(msg) {
    showScreen("team");
    var cap = $("cap-who"); if (cap) cap.textContent = "Something went wrong";
    $("cap-title").textContent = "Couldn't reach the team";
    $("cap-body").innerHTML = '<div class="err">' + escapeHtml(msg) +
      '<br><br>Is the backend running? Start it with <code>python api/server.py</code>, or open this page with <code>?demo=1</code>.</div>';
  }

  // Hidden stage switch: press "d" to force demo mode and restart the current idea.
  document.addEventListener("keydown", function (e) {
    if (e.key === "d" && !/input|textarea/i.test((document.activeElement || {}).tagName || "")) {
      var u = new URL(location.href); u.searchParams.set("demo", "1"); location.href = u.toString();
    }
  });

  // ---------- boot ----------
  renderQuestion();
})();
