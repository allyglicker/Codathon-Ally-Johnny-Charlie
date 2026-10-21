/* Neur — Screen 3: "Your launch plan".
 *
 * Reads the pipeline result Screen 2 saved (or fetches /plan if opened directly),
 * and renders the plan: verdict banner, three big numbers, a live price slider
 * (same math as finance_calc.py), and the two-column plan body. Every number on
 * screen comes from the result; nothing is hard-coded.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var money = function (v) { return "$" + Math.round(v).toLocaleString(); };
  var params = new URLSearchParams(location.search);
  var API = params.get("api") || "";
  var FORCE_DEMO = params.get("demo") === "1";

  var result = null;

  function boot() {
    try { result = JSON.parse(sessionStorage.getItem("neur_result") || "null"); } catch (e) { /* ignore */ }
    if (result) { render(); return; }
    // Opened directly: run the pipeline with whatever profile we have.
    var profile = null;
    try { profile = JSON.parse(sessionStorage.getItem("neur_profile") || "null"); } catch (e) { /* ignore */ }
    profile = profile || { idea: "Homemade cookies", location: "Milledgeville, GA", startup_budget: 1500, hours_per_week: 10, timeline: "Open within 3 months" };
    fetch(API + "/plan" + (FORCE_DEMO ? "?demo=1" : ""), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ founder_profile: profile }) })
      .then(function (r) { return r.json(); })
      .then(function (res) { result = res; render(); })
      .catch(function (err) { $("plan").innerHTML = '<div class="pcard"><h3>Couldn\'t load your plan</h3><p>' + esc(err.message || String(err)) + "</p></div>"; });
  }

  function render() {
    var o = result.outputs || {}, m = o.market || {}, l = o.legal || {}, f = o.finance || {}, mgr = o.manager || {};
    var rm = mgr.roadmap || {}, n = f.numbers || {}, mn = m.numbers || {};
    var p = result.founder_profile || {};

    var startup = val(n.startup_cost_total), be = val(n.break_even_units_per_month), runway = val(n.runway_months);
    var cpu = val(n.cost_per_unit), monthlyFixed = val(n.monthly_fixed_costs), price = val(mn.price_per_unit);
    var cust = val(mn.est_monthly_customers), upc = val(mn.units_per_customer_per_month);
    var expectedUnits = val(n.expected_monthly_units); if (expectedUnits == null && cust != null && upc != null) expectedUnits = cust * upc;
    var budget = Number(p.startup_budget || 0), leftOver = (startup != null && budget) ? budget - startup : null;
    var unit = f.unit_definition || m.unit_definition || "unit";
    var verdictTitle = rm.verdict_title || "Your launch plan", verdictText = rm.verdict_text || rm.go_verdict || "";
    var vClass = classifyVerdict(rm.verdict || verdictTitle);

    var recheckPrice = (f.recheck && f.recheck.price != null) ? Number(f.recheck.price) : null;
    var sample = result.used_saved_answers ? "· sample data" : "";
    var idea = p.idea || "your idea", city = p.location || "";

    var h = "";
    // header
    h += '<div class="topbar"><div>' +
      '<p class="eyebrow">Your launch plan ' + sample + " · " + esc(truncate(idea, 46)) + (city ? " in " + esc(city) : "") + "</p>" +
      "<h1>" + esc(rm.one_sentence || idea) + "</h1>" +
      '</div><div class="actions">' +
      '<button class="ghost" id="change" type="button">Change my answers</button>' +
      '<button class="ghost" id="restart" type="button">Start over</button>' +
      '<button class="primary" id="download" type="button">Download my plan</button>' +
      "</div></div>";

    // verdict banner
    h += '<div class="verdict-banner ' + vClass + '"><canvas id="v-ward" role="img" aria-label="Ward"></canvas>' +
      '<div><p class="v-title">' + esc(verdictTitle) + "</p>" + (verdictText ? '<p class="v-text">' + esc(verdictText) + "</p>" : "") + "</div></div>";

    // three big numbers
    h += '<div class="bignums">';
    h += bignum("Cost to open", startup == null ? "—" : money(startup),
      leftOver != null ? ("You have " + money(budget) + ", so " + money(Math.max(0, leftOver)) + " left over") : "what it takes to get started",
      "This is the one-time money you need before you open, including legal setup.", isEst(n.startup_cost_total));
    h += bignum("Sales to cover your bills", be == null ? "—" : be + "/mo",
      (price != null ? plural(unit) + " a month at " + fmtMoney(price) : "units a month"),
      "Sell this many each month and you cover your costs. Fewer means you lose money; more is profit.", isEst(n.break_even_units_per_month), true);
    h += bignum("If you sold nothing", runway == null ? "—" : runway.toFixed(1) + " mo",
      "your leftover money covers about this many months of bills",
      "With zero sales, this is how long your starting money lasts before it runs out.", isEst(n.runway_months));
    h += "</div>";

    // price bar
    if (price != null && cpu != null && monthlyFixed != null) {
      var pmin = Math.max(0.25, round2(price / 2)), pmax = round2(price * 2);
      h += '<div class="pricebar"><div class="row">' +
        '<div><div class="label">Try a different price</div><div class="price"><span id="pb-price">' + fmtMoney(price) + '</span> <span style="font-size:14px;opacity:.75">per ' + esc(shortUnit(unit)) + "</span></div></div>" +
        '<div class="stat">break-even <b id="pb-be"></b> / mo<br>keep <b id="pb-keep"></b> / mo at ' + (expectedUnits != null ? Math.round(expectedUnits) + " sales" : "expected sales") + "</div>" +
        "</div>" +
        '<input type="range" id="pb-slider" min="' + pmin + '" max="' + pmax + '" step="0.25" value="' + price + '" aria-label="Price per unit">' +
        '<div class="ends"><span>' + fmtMoney(pmin) + "</span><span>" + fmtMoney(pmax) + "</span></div>" +
        (recheckPrice != null ? '<div class="suggested">Ward suggested ' + fmtMoney(recheckPrice) + "</div>" : "") +
        "</div>";
    }

    // two columns
    h += '<div class="plan-body"><div class="plan-col">';
    // Watch out for
    var watch = (rm.watch_out || []);
    if (watch.length) {
      h += watch.slice(0, 5).map(function (w, i) { return watchCard(w, i); }).join("");
    }
    // First 5 steps
    var steps = rm.first_steps || [];
    if (steps.length) {
      h += '<div class="pcard"><h3>Your first 5 steps</h3><ul class="steplist">' +
        steps.slice(0, 5).map(function (s, i) {
          return '<li><input type="checkbox" id="step-' + i + '"><label for="step-' + i + '">' + esc(s) + "</label></li>";
        }).join("") + "</ul></div>";
    }
    h += "</div><div class="+'"plan-col">';
    // Will it sell? (Scout)
    h += '<div class="pcard"><div class="agent-head"><canvas id="p-market" role="img" aria-label="Scout"></canvas><h3>Will it sell?</h3></div>' +
      list(m.key_findings, 3) + (price != null ? '<p class="eyebrow">Starting price: ' + fmtMoney(price) + " per " + esc(shortUnit(unit)) + "</p>" : "") + "</div>";
    // Getting legal (Quill)
    var legalBlock = (l.signal === "flag") ? ('<p class="blocker">' + esc((l.risks || []).map(function (r) { return r.risk; }).filter(function (x) { return /blocks the plan/i.test(x); })[0] || "Quill flagged a blocker.") + "</p>") : "";
    h += '<div class="pcard"><div class="agent-head"><canvas id="p-legal" role="img" aria-label="Quill"></canvas><h3>Getting legal</h3></div>' +
      legalBlock + list(l.next_steps && l.next_steps.length ? l.next_steps : l.key_findings, 5) + "</div>";
    h += "</div></div>";

    h += '<p class="foot">General guidance, not legal or financial advice. Confirm legal and tax steps with your local Small Business Development Center (SBDC).</p>';

    $("plan").innerHTML = h;

    // characters
    if (window.createWard) window.createWard($("v-ward")).setState("done");
    if (window.createMarket) try { window.createMarket($("p-market")).setState("done"); } catch (e) {}
    if (window.createQuill) try { window.createQuill($("p-legal")).setState("done"); } catch (e) {}

    // actions
    $("change").addEventListener("click", function () { location.href = "dream.html" + (location.search || ""); });
    $("restart").addEventListener("click", function () { try { sessionStorage.removeItem("neur_result"); } catch (e) {} location.href = "dream.html" + (location.search || ""); });
    $("download").addEventListener("click", function () { window.print(); });

    // price slider
    if (price != null && cpu != null && monthlyFixed != null) wireSlider(price, cpu, monthlyFixed, be, expectedUnits);
    // watch-out fix buttons move the slider
    [].forEach.call(document.querySelectorAll("[data-fixprice]"), function (b) {
      b.addEventListener("click", function () {
        var sl = $("pb-slider"); if (!sl) return;
        sl.value = b.getAttribute("data-fixprice"); sl.dispatchEvent(new Event("input"));
        sl.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  function wireSlider(price, cpu, monthlyFixed, baseBe, expectedUnits) {
    var sl = $("pb-slider");
    function update() {
      var pr = Number(sl.value);
      $("pb-price").textContent = fmtMoney(pr);
      var be = breakEvenAt(pr, cpu, monthlyFixed);
      $("pb-be").textContent = be == null ? "never" : be;
      // What you'd keep each month at expected sales = profit/unit * expected - monthly bills
      var keep = (expectedUnits != null) ? ((pr - cpu) * expectedUnits - monthlyFixed) : null;
      $("pb-keep").textContent = keep == null ? "—" : (keep < 0 ? "-" + money(-keep) : money(keep));
    }
    sl.addEventListener("input", update);
    update();
  }

  // Same formula as finance_calc.run_finance_math.
  function breakEvenAt(price, cpu, monthlyFixed) { var profit = price - cpu; if (profit <= 0) return null; return Math.ceil(monthlyFixed / profit); }

  function watchCard(w, i) {
    if (typeof w === "string") return '<div class="watchitem"><div class="wb">' + esc(w) + "</div></div>";
    var isBlock = /blocks the plan/i.test(w.text || w.title || "");
    var fix = w.fix || {};
    var fixBtn = (fix && fix.price != null) ? '<button class="btn" type="button" data-fixprice="' + Number(fix.price) + '">Try ' + fmtMoney(Number(fix.price)) + "</button>" :
      (fix && fix.label ? '<div class="how">Fix: ' + esc(fix.label) + "</div>" : "");
    return '<div class="watchitem' + (isBlock ? " block" : "") + '">' +
      (w.title ? '<div class="wt">' + esc(w.title) + "</div>" : "") +
      (w.text ? '<div class="wb">' + esc(w.text) + "</div>" : "") +
      (w.how_found ? '<div class="how">How your team found this: ' + esc(w.how_found) + "</div>" : "") +
      fixBtn + "</div>";
  }

  function classifyVerdict(v) { var t = String(v || "").toLowerCase(); if (t.indexOf("change") >= 0) return "changes"; if (t.indexOf("test") >= 0 || t.indexOf("not") >= 0 || t.indexOf("wait") >= 0) return "test"; return "go"; }

  // ---------- helpers ----------
  function bignum(k, nStr, d, meaning, est, key) {
    return '<div class="bignum' + (key ? " key" : "") + '"><div class="k">' + esc(k) + "</div>" +
      '<div class="n">' + esc(nStr) + (est ? ' <span class="est">estimate</span>' : "") + "</div>" +
      '<div class="d">' + esc(d) + "</div>" +
      (meaning ? "<details><summary>What does this mean?</summary><p>" + esc(meaning) + "</p></details>" : "") + "</div>";
  }
  function list(items, max) {
    items = (items || []).slice(0, max || 5);
    if (!items.length) return '<p class="d">No details available.</p>';
    return "<ul>" + items.map(function (i) { return "<li>" + esc(typeof i === "string" ? i : (i.text || "")) + "</li>"; }).join("") + "</ul>";
  }
  function val(o) { return o && o.value != null ? Number(o.value) : null; }
  function isEst(o) { return !!(o && o.basis === "estimate"); }
  function fmtMoney(v) { return "$" + (Math.round(v * 100) / 100).toFixed(2).replace(/\.00$/, ""); }
  function round2(v) { return Math.round(v * 4) / 4; }
  function shortUnit(u) { return String(u || "unit").replace(/^one\s+/i, "").split(" ").slice(0, 3).join(" "); }
  function plural(u) { var s = shortUnit(u); return /s$/.test(s) ? s : s + "s"; }
  function truncate(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  boot();
})();
