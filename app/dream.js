/* Neur — Screen 1: "What's your dream?"
 *
 * Five questions, one per screen. Collects the founder profile, then hands off
 * to Screen 2 (the Launch Desk) by storing the answers and navigating there.
 * The four characters stand idle in the "What you'll get" panel.
 */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var money = function (v) { return "$" + Math.round(v).toLocaleString(); };

  // Example idea chips -> a full sentence dropped into the text box.
  var IDEA_EXAMPLES = [
    { label: "Cookie shop", text: "I want to sell homemade cookies from my kitchen" },
    { label: "Dog walking", text: "I want to start a dog-walking service in my neighborhood" },
    { label: "Etsy jewelry", text: "I want to sell handmade jewelry online on Etsy" },
    { label: "Tutoring", text: "I want to tutor local students after school" },
    { label: "Lawn care", text: "I want to run a lawn-care service in my town" },
    { label: "Photography", text: "I want to start a weekend portrait photography business" },
  ];

  var QUESTIONS = [
    {
      key: "idea", type: "idea", ask: "What's your dream?",
      helper: "Describe it the way you'd tell a friend. No business words needed.",
    },
    {
      key: "location", type: "text", ask: "Where will you run it?",
      helper: "City and state. Legal rules depend on it.",
      label: "City and state", placeholder: "e.g. Milledgeville, GA",
    },
    {
      key: "startup_budget", type: "budget", ask: "How much can you put in to start?",
      helper: "A rough number is fine. You can change the plan later.",
      min: 0, max: 10000, step: 100, value: 1500,
    },
    {
      key: "hours_per_week", type: "chips", ask: "How many hours a week can you give it?",
      helper: "Be honest. This caps how much you can make and sell.",
      options: [{ label: "5", value: 5 }, { label: "10", value: 10 }, { label: "20", value: 20 }, { label: "40", value: 40 }],
      value: 10,
    },
    {
      key: "timeline", type: "open", ask: "When do you want to open?",
      helper: "Pick a target, then add any experience you already have.",
      options: [
        { label: "Within 1 month", value: "Open within 1 month" },
        { label: "Within 3 months", value: "Open within 3 months" },
        { label: "Within 6 months", value: "Open within 6 months" },
      ],
      value: "Open within 3 months",
    },
  ];

  var answers = {
    idea: "", location: "", startup_budget: 1500, hours_per_week: 10,
    timeline: "Open within 3 months", experience: "",
  };
  var step = 0;

  // ---------- render ----------

  function render() {
    var q = QUESTIONS[step];
    $("qcount").textContent = "Question " + (step + 1) + " of " + QUESTIONS.length;
    $("bar").style.width = Math.round(((step + 1) / QUESTIONS.length) * 100) + "%";
    $("ask").textContent = q.ask;
    $("helper").textContent = q.helper || "";

    var body = $("qbody");
    body.innerHTML = "";

    if (q.type === "idea") {
      body.appendChild(el('<div class="field"><label for="in-idea">Your idea</label>' +
        '<textarea id="in-idea" placeholder="I want to sell homemade cookies from my kitchen…">' +
        escapeHtml(answers.idea) + "</textarea>" +
        '<div class="chips" id="idea-chips">' +
        IDEA_EXAMPLES.map(function (e) { return '<button class="chip" type="button" data-text="' + escapeAttr(e.text) + '">' + escapeHtml(e.label) + "</button>"; }).join("") +
        "</div></div>"));
      var ta = $("in-idea");
      ta.focus();
      ta.addEventListener("input", function () { answers.idea = ta.value.trim(); syncNext(); });
      $("idea-chips").addEventListener("click", function (e) {
        var b = e.target.closest(".chip"); if (!b) return;
        ta.value = b.dataset.text; answers.idea = b.dataset.text; markPressed(this, b); syncNext();
      });

    } else if (q.type === "text") {
      body.appendChild(el('<div class="field"><label for="in-text">' + escapeHtml(q.label) + "</label>" +
        '<input type="text" id="in-text" placeholder="' + escapeAttr(q.placeholder) + '" value="' + escapeAttr(answers[q.key]) + '"></div>'));
      var input = $("in-text"); input.focus();
      input.addEventListener("input", function () { answers[q.key] = input.value.trim(); syncNext(); });

    } else if (q.type === "budget") {
      body.appendChild(el('<div class="field"><div class="bigval" id="budget-val">' + money(answers.startup_budget) + "</div>" +
        '<input class="range" type="range" id="in-budget" min="' + q.min + '" max="' + q.max + '" step="' + q.step + '" value="' + answers.startup_budget + '" aria-label="Starting budget">' +
        '<div class="range-ends"><span>' + money(q.min) + "</span><span>" + money(q.max) + "</span></div></div>"));
      var sl = $("in-budget");
      sl.addEventListener("input", function () { answers.startup_budget = Number(sl.value); $("budget-val").textContent = money(answers.startup_budget); });

    } else if (q.type === "chips") {
      body.appendChild(el('<div class="field"><div class="chips" id="in-chips">' +
        q.options.map(function (o) { return chipBtn(o, answers[q.key]); }).join("") + "</div></div>"));
      $("in-chips").addEventListener("click", function (e) {
        var b = e.target.closest(".chip"); if (!b) return;
        answers[q.key] = coerce(b.dataset.v); markPressed(this, b);
      });

    } else if (q.type === "open") {
      body.appendChild(el('<div class="field"><div class="chips" id="in-chips">' +
        q.options.map(function (o) { return chipBtn(o, answers[q.key]); }).join("") + "</div></div>" +
        '<div class="field"><label for="in-exp">Any related experience? (optional)</label>' +
        '<input type="text" id="in-exp" placeholder="e.g. Baked for friends for 5 years" value="' + escapeAttr(answers.experience) + '"></div>'));
      $("in-chips").addEventListener("click", function (e) {
        var b = e.target.closest(".chip"); if (!b) return;
        answers[q.key] = coerce(b.dataset.v); markPressed(this, b);
      });
      $("in-exp").addEventListener("input", function () { answers.experience = this.value.trim(); });
    }

    $("back").style.visibility = step === 0 ? "hidden" : "visible";
    $("next").textContent = step === QUESTIONS.length - 1 ? "Build my plan" : "Continue";
    syncNext();
  }

  function chipBtn(o, current) {
    var on = String(current) === String(o.value);
    return '<button class="chip" type="button" aria-pressed="' + on + '" data-v="' + escapeAttr(String(o.value)) + '">' + escapeHtml(o.label) + "</button>";
  }
  function markPressed(container, btn) {
    [].forEach.call(container.children, function (c) { c.setAttribute("aria-pressed", String(c === btn)); });
  }
  function coerce(v) { return /^\d+$/.test(v) ? Number(v) : v; }

  function syncNext() {
    var q = QUESTIONS[step];
    var ok = true;
    if (q.type === "idea") ok = answers.idea.length > 2;
    if (q.type === "text") ok = String(answers[q.key] || "").length > 1;
    $("next").disabled = !ok;
  }

  // ---------- navigation ----------

  $("next").addEventListener("click", function () {
    if (step < QUESTIONS.length - 1) { step++; render(); }
    else buildPlan();
  });
  $("back").addEventListener("click", function () { if (step > 0) { step--; render(); } });

  function buildPlan() {
    var profile = {
      idea: answers.idea, location: answers.location,
      startup_budget: answers.startup_budget, hours_per_week: answers.hours_per_week,
      timeline: answers.timeline, experience: answers.experience || "First-time founder",
    };
    try { sessionStorage.setItem("neur_profile", JSON.stringify(profile)); } catch (e) { /* ignore */ }
    // Carry ?api= and ?demo= through to the next screen.
    var qs = location.search || "";
    location.href = "desk.html" + qs;
  }

  // ---------- characters (idle) ----------
  function initCrew() {
    if (window.createMarket) window.createMarket($("g-market")).setState("idle");
    if (window.createQuill) window.createQuill($("g-quill")).setState("idle");
    if (window.createFinance) window.createFinance($("g-finance")).setState("idle");
    if (window.createWard) window.createWard($("g-ward")).setState("idle");
  }

  // ---------- helpers ----------
  function el(html) { var d = document.createElement("div"); d.innerHTML = html; return d.firstChild; }
  function escapeHtml(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---------- boot ----------
  // restore any in-progress answers (if the user came back)
  try { var saved = JSON.parse(sessionStorage.getItem("neur_profile") || "null"); if (saved) Object.assign(answers, saved); } catch (e) { /* ignore */ }
  render();
  initCrew();
})();
