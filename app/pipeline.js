/* Neur client-side pipeline (demo mode).
 *
 * A faithful JavaScript port of demo/demo_runner.py (demo path) and
 * agents/finance/finance_calc.py. It lets the static, public build run the
 * whole agent team in the browser with no backend: pick a saved scenario by
 * matching keywords in the founder's idea, play the same events, and run the
 * real finance math (including Ward's price re-check and the price slider).
 *
 * The Finance numbers always come from runFinanceMath(), never typed values,
 * exactly as the Python calculator does it.
 *
 * window.runPipelineLocal(founderProfile, { scenarioName }) -> result
 * where result has the same shape the backend returned:
 *   { mode, scenario, founder_profile, outputs, events, warnings, used_saved_answers }
 */
(function () {
  "use strict";

  var BLOCK = "Blocks the plan as written:";
  var ROLE = { market: "Customer & Market", legal: "Legal & Compliance", finance: "Finance" };
  var DEFAULT_SCENARIO = "cookies";

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- scenarios ----------

  function loadScenario(nameOrIdea) {
    var all = window.NEUR_SCENARIOS || {};
    var text = String(nameOrIdea || "").toLowerCase();
    if (all[text]) return deepCopy(all[text]);
    for (var key in all) {
      if (!Object.prototype.hasOwnProperty.call(all, key)) continue;
      var kws = all[key].keywords || [];
      for (var i = 0; i < kws.length; i++) {
        if (text.indexOf(kws[i]) >= 0) return deepCopy(all[key]);
      }
    }
    return deepCopy(all[DEFAULT_SCENARIO]);
  }

  // ---------- finance math (port of finance_calc.run_finance_math) ----------

  function numOf(agentOutput, key) {
    try {
      var v = agentOutput.numbers[key].value;
      var f = Number(v);
      return isNaN(f) ? null : f;
    } catch (e) { return null; }
  }

  function sumItems(items) {
    return (items || []).reduce(function (acc, i) {
      return acc + (Number(i && i.cost) || 0);
    }, 0);
  }

  function round2(v) { return Math.round(v * 100) / 100; }

  function runFinanceMath(financeRaw, founderProfile, marketOut, legalOut) {
    var price = numOf(marketOut, "price_per_unit");
    var customers = numOf(marketOut, "est_monthly_customers");
    var unitsPerCustomer = numOf(marketOut, "units_per_customer_per_month");
    var legalSetup = numOf(legalOut, "legal_setup_cost") || 0;
    var annualFees = numOf(legalOut, "annual_license_fees") || 0;
    var mktStartup = numOf(marketOut, "est_marketing_cost_startup") || 0;
    var mktMonthly = numOf(marketOut, "est_marketing_cost_monthly") || 0;
    var priceLow = numOf(marketOut, "price_range_low");
    var priceHigh = numOf(marketOut, "price_range_high");
    var budget = Number((founderProfile || {}).startup_budget) || 0;

    var startupTotal = sumItems(financeRaw.startup_cost_items) + legalSetup + mktStartup;
    var costPerUnit = sumItems(financeRaw.unit_cost_items);
    var monthlyFixed = sumItems(financeRaw.monthly_fixed_cost_items) + annualFees / 12 + mktMonthly;

    var profitPerUnit = price != null ? (price - costPerUnit) : null;
    var breakEven;
    if (profitPerUnit != null && profitPerUnit > 0) {
      breakEven = Math.ceil(monthlyFixed / profitPerUnit);
    } else {
      breakEven = null;
    }

    var moneyLeft = budget - startupTotal;
    var fundingGap = Math.max(0, -moneyLeft);
    var runway;
    if (moneyLeft <= 0) runway = 0;
    else if (monthlyFixed > 0) runway = moneyLeft / monthlyFixed;
    else runway = null;

    var expectedUnits = (customers != null && unitsPerCustomer != null)
      ? customers * unitsPerCustomer : null;

    function n(value, unit, basis) {
      return { value: value == null ? null : round2(value), unit: unit, basis: basis };
    }

    var numbers = {
      startup_cost_total: n(startupTotal, "USD", "estimate"),
      monthly_fixed_costs: n(monthlyFixed, "USD/month", "estimate"),
      cost_per_unit: n(costPerUnit, "USD", "estimate"),
      profit_per_unit: n(profitPerUnit, "USD", "calculated"),
      break_even_units_per_month: n(breakEven, "units/month", "calculated"),
      runway_months: n(runway, "months", "calculated"),
      funding_gap: n(fundingGap, "USD", "calculated"),
      expected_monthly_units: n(expectedUnits, "units/month", "calculated")
    };
    if (priceHigh != null && (priceHigh - costPerUnit) > 0) {
      numbers.break_even_at_price_high = n(Math.ceil(monthlyFixed / (priceHigh - costPerUnit)), "units/month", "calculated");
    }

    var risks = [];
    (financeRaw.risks || []).forEach(function (r) {
      r = Object.assign({}, r);
      if (r.severity === "high" && String(r.risk || "").indexOf(BLOCK) !== 0) {
        r.severity = "medium";
      }
      risks.push(r);
    });
    var needs = (financeRaw.needs_from_others || []).slice();
    var blockTab = null;

    if (price == null) {
      risks.push({ risk: "No price from Customer & Market yet, so break-even can't be calculated.", severity: "medium" });
      needs.push({ agent: "customer_market", request: "Please provide price_per_unit." });
    } else if (profitPerUnit <= 0) {
      risks.push({ risk: BLOCK + " the price ($" + price.toFixed(2) + ") doesn't cover the cost to make one unit ($" + costPerUnit.toFixed(2) + "), so every sale loses money. Fix: raise the price or cut the cost per unit.", severity: "high" });
      needs.push({ agent: "customer_market", request: "Price is at or below cost. Suggest a higher price or a premium option." });
      blockTab = "Blocked: price below cost";
    }

    if (fundingGap > 0) {
      risks.push({ risk: BLOCK + " opening costs $" + fmtThousands(startupTotal) + ", which is $" + fmtThousands(fundingGap) + " more than the $" + fmtThousands(budget) + " budget. Fix: start smaller, save the difference first, or look into a small microloan.", severity: "high" });
      blockTab = blockTab || ("Blocked: $" + fmtThousands(fundingGap) + " over budget");
    } else if (runway != null && runway < 6) {
      risks.push({ risk: "Money left after opening covers only about " + runway.toFixed(1) + " months of bills with no sales.", severity: "medium" });
    }

    if (price != null && priceHigh != null && priceLow != null && !(priceLow <= price && price <= priceHigh)) {
      risks.push({ risk: "Price ($" + price.toFixed(2) + ") is outside the competitor range ($" + priceLow.toFixed(2) + "-$" + priceHigh.toFixed(2) + ").", severity: "medium" });
    }

    if (breakEven != null && expectedUnits != null && breakEven > expectedUnits) {
      risks.push({ risk: "Break-even needs " + breakEven + " sales a month, but the market estimate is about " + Math.round(expectedUnits) + ".", severity: "medium" });
    }

    var asked = (marketOut.needs_from_others || []).concat(legalOut.needs_from_others || [])
      .filter(function (r) { return r.agent === "finance"; });
    var responses = (financeRaw.responses_to_others || []).slice();
    var answered = {};
    responses.forEach(function (r) { answered[r.request] = true; });
    var unanswered = asked.filter(function (r) { return !answered[r.request]; }).map(function (r) { return r.request; });

    var flagged = risks.some(function (r) { return String(r.risk || "").indexOf(BLOCK) === 0; });
    var tab;
    if (flagged) {
      tab = blockTab || "Blocked: money doesn't work";
    } else if (breakEven != null) {
      tab = "$" + fmtThousands(startupTotal) + " start \u00b7 break-even " + breakEven + "/mo";
    } else {
      tab = "$" + fmtThousands(startupTotal) + " to start";
    }
    if (tab.length > 40) tab = "$" + fmtThousands(startupTotal) + " to start";

    return {
      agent: "finance",
      signal: flagged ? "flag" : "clear",
      tab: tab,
      unit_definition: marketOut.unit_definition || financeRaw.unit_definition,
      summary: financeRaw.summary || "",
      key_findings: financeRaw.key_findings || [],
      numbers: numbers,
      cost_breakdown: {
        startup: (financeRaw.startup_cost_items || [])
          .concat([{ item: "Legal setup (from Legal)", cost: legalSetup }])
          .concat(mktStartup ? [{ item: "Marketing to launch (from Market)", cost: mktStartup }] : []),
        per_unit: financeRaw.unit_cost_items || [],
        monthly: (financeRaw.monthly_fixed_cost_items || [])
          .concat([{ item: "License fees, monthly share (from Legal)", cost: round2(annualFees / 12) }])
          .concat(mktMonthly ? [{ item: "Marketing (from Market)", cost: mktMonthly }] : [])
      },
      responses_to_others: responses,
      unanswered_requests: unanswered,
      assumptions: financeRaw.assumptions || [],
      risks: risks,
      needs_from_others: needs,
      next_steps: financeRaw.next_steps || []
    };
  }

  // Match Python's f"{x:,.0f}" (thousands separators, no decimals).
  function fmtThousands(v) { return Math.round(v).toLocaleString("en-US"); }

  // ---------- events (port of demo_runner helpers) ----------

  function hasEstimate(out) {
    var nums = out.numbers || {};
    return Object.keys(nums).some(function (k) {
      return nums[k] && typeof nums[k] === "object" && nums[k].basis === "estimate";
    });
  }

  function tabOf(out, agent) {
    var tab = out.tab;
    return (typeof tab === "string" && tab.length > 0 && tab.length <= 40) ? tab : (ROLE[agent] || agent);
  }

  function characterState(agent, event, signal) {
    var kind = event.split(".")[1];
    if (agent === "manager") {
      return ({ dispatch: "delegating", review: "working", conflict: "flagging",
                roadmap: "done", forward: "delegating" })[kind] || "idle";
    }
    if (kind === "done") return signal === "flag" ? "flagging" : "done";
    return ({ waiting: "waiting", received: "working", search: "working", note: "working" })[kind] || "idle";
  }

  function ev(agent, event, signal, folder) {
    var e = { event: agent + "." + event, agent: agent, state: characterState(agent, agent + "." + event, signal) };
    if (folder) { for (var k in folder) if (Object.prototype.hasOwnProperty.call(folder, k)) e[k] = folder[k]; }
    return e;
  }

  // ---------- whole pipeline (demo mode) ----------

  function runPipelineLocal(founderProfile, opts) {
    opts = opts || {};
    var scenarioName = opts.scenarioName;
    var scenario = loadScenario(scenarioName || (founderProfile || {}).idea);
    var profile = founderProfile || scenario.founder_profile;
    var warnings = [];
    var events = [];

    // Demo-mode agent outputs are the saved answers, tagged _source: "demo".
    var market = deepCopy(scenario.market); market._source = "demo";
    var legal = deepCopy(scenario.legal); legal._source = "demo";
    var financeRaw = deepCopy(scenario.finance_raw); financeRaw._source = "demo";

    // 1. Ward dispatches; Penny waits; Scout and Quill receive.
    events.push(ev("manager", "dispatch", null, { frm: "Ward", to: "Scout, Quill", tab: "Profile" }));
    events.push(ev("finance", "waiting"));
    events.push(ev("market", "received"));
    events.push(ev("legal", "received"));

    // 2. Quill returns; any note for Scout is forwarded by Ward.
    events.push(ev("legal", "done", legal.signal, { frm: "Quill", to: "Ward", tab: tabOf(legal, "legal"), est: hasEstimate(legal) }));
    (legal.needs_from_others || []).forEach(function (req) {
      if (req.agent === "customer_market") {
        events.push(ev("manager", "forward", null, { frm: "Ward", to: "Scout", tab: "Note from Quill", note: req.request || "" }));
        events.push(ev("market", "note"));
      }
    });
    events.push(ev("market", "done", market.signal, { frm: "Scout", to: "Ward", tab: tabOf(market, "market"), est: hasEstimate(market) }));

    // 3. Penny gets everything; the calculator does the math.
    events.push(ev("manager", "dispatch", null, { frm: "Ward", to: "Penny", tab: "Profile + 2 handoffs" }));
    events.push(ev("finance", "received"));
    var finance = runFinanceMath(financeRaw, profile, market, legal);
    finance._source = "demo";
    events.push(ev("finance", "done", finance.signal, { frm: "Penny", to: "Ward", tab: finance.tab, est: true }));

    // 4. Ward reviews, flags conflicts, and runs any price re-check.
    events.push(ev("manager", "review"));
    var manager = deepCopy(scenario.manager);
    manager._source = "demo";

    var flaggedAgents = [];
    [["market", market], ["legal", legal], ["finance", finance]].forEach(function (pair) {
      if (pair[1].signal === "flag") flaggedAgents.push(pair[0]);
    });
    if (flaggedAgents.length || (manager.exchanges && manager.exchanges.length)) {
      events.push(ev("manager", "conflict", null, { flagged: flaggedAgents }));
    }

    (manager.exchanges || []).forEach(function (ex) {
      if ("recheck_price" in ex && !(market.numbers && market.numbers.price_per_unit)) {
        warnings.push("Skipped Ward's price re-check: Scout's answer has no price");
        return;
      }
      if ("recheck_price" in ex) {
        events.push(ev("manager", "dispatch", null, { frm: "Ward", to: "Penny", tab: ex.value }));
        events.push(ev("finance", "received"));
        var m2 = deepCopy(market);
        m2.numbers.price_per_unit.value = ex.recheck_price;
        var recheck = runFinanceMath(financeRaw, profile, m2, legal); // real calculator, never faked
        var be2 = recheck.numbers.break_even_units_per_month.value;
        var tab2 = be2 != null
          ? ("Break-even " + Math.round(be2) + "/mo at $" + trimNum(ex.recheck_price))
          : "No break-even";
        events.push(ev("finance", "done", recheck.signal, { frm: "Penny", to: "Ward", tab: tab2, est: true }));
        finance.recheck = { price: ex.recheck_price, numbers: recheck.numbers, signal: recheck.signal };
      } else {
        events.push({ event: "manager.exchange", agent: "manager", state: "delegating",
                      frm: ex.from, to: ex.to, tab: ex.value });
      }
    });

    events.push(ev("manager", "roadmap", null, { frm: "Ward", to: "Founder",
      tab: (manager.roadmap && manager.roadmap.verdict_title) || "Launch roadmap" }));

    var outputs = { market: market, legal: legal, finance: finance, manager: manager };
    return {
      mode: "demo",
      scenario: scenario.scenario,
      founder_profile: profile,
      outputs: outputs,
      events: events,
      warnings: warnings,
      used_saved_answers: true
    };
  }

  // Match Python f"{x:g}": drop a trailing .0 (5.0 -> "5", 3.5 -> "3.5").
  function trimNum(v) {
    var s = String(v);
    return s.indexOf(".") >= 0 ? s.replace(/\.?0+$/, "") : s;
  }

  window.runPipelineLocal = runPipelineLocal;
  window.runFinanceMath = runFinanceMath;
})();
