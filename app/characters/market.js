/*
 * market.js: Scout, the Customer & Market agent for the Neur Launch Desk demo.
 * A friendly platypus: taupe fur, a wide slate-gray bill, webbed feet, a flat paddle tail,
 * a forest-green vest over a cream shirt. Props: clipboard and pencil, a yellow sticky note, a price tag.
 *
 * Usage:
 *   const scout = createMarket(canvas, opts);   // opts: { state: "idle" }
 *   scout.setState("working");                  // idle | waiting | working | flagging | done
 *                                               // also: "researching" (= working), "reading-note"
 *   scout.getState();
 *   scout.destroy();                            // stops the animation loop
 *
 * States and the demo event that triggers each:
 *   idle          reset(), before work arrives: relaxed, blinking, tail swaying
 *   waiting       market.waiting: arms folded, eyes up toward Ward, tail tapping
 *   working       market.received: clipboard up, pencil ticking boxes, eyes on the list (alias: "researching")
 *   flagging      market.done with "signal": "flag" (e.g. no realistic customer base): clipboard up with a red X, worried
 *   reading-note  Quill's note lands ("Direct sales only. No coffee shops."): holds the note up, head tilted, brows raised
 *   done          handoff sent to Ward: holds up a "$3.50" price tag with a green check, hand on hip, happy hop
 *
 * Style matches quill.js / ward.js: 270 x 260 design box, outline #3A2A1F at lineWidth 3,
 * round joins and caps, flat fills only, soft ground shadow at the feet.
 * Motion: breathing bob and blinks (~3.6 s); tail sway; pencil ticks and checks filling in while researching;
 * a gentle head tilt while reading the note; a hop, tag swing and tail wag when done.
 * With prefers-reduced-motion, each state draws once as a still pose and no loop runs.
 * Deferred hooks (not built): "flagging" state, speech bubbles, reacting to passing folders, click-to-inspect.
 */
(function () {
  "use strict";

  var W = 270, H = 260;
  // The five universal states every Neur character supports, plus Scout's own names.
  var STATES = ["idle", "waiting", "working", "flagging", "done", "researching", "reading-note"];
  var ALIAS = { researching: "working" };
  var O = "#3A2A1F";

  // Fixed palette: the same on light and dark pages.
  var C = {
    fur: "#A57B5E",
    furDark: "#7E5A42",
    belly: "#D9BFA4",
    bill: "#5D6169",
    billDark: "#43464D",
    shirt: "#F6EBD6",
    vest: "#3E7B4F",
    vestDark: "#2D5C3A",
    brass: "#C9A04A",
    eye: "#1E1612",
    shine: "#FFFFFF",
    board: "#9A7350",
    paper: "#FBF6EC",
    clip: "#8E8E8E",
    pencil: "#E3A83C",
    pencilTip: "#3A2A1F",
    ink: "#9C9184",
    note: "#F5E27A",
    tag: "#FBF6EC",
    string: "#8A5A3B",
    check: "#2F8A4E",
    shadow: "rgba(20,14,10,0.16)"
  };

  // ---------- helpers ----------
  function line(ctx, w, color) {
    ctx.strokeStyle = color || O; ctx.lineWidth = w || 3;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
  }
  function fillStroke(ctx, fill, w) { ctx.fillStyle = fill; ctx.fill(); line(ctx, w); ctx.stroke(); }
  function ellipse(ctx, x, y, rx, ry, fill, w, rot) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
    if (w === 0) { ctx.fillStyle = fill; ctx.fill(); } else fillStroke(ctx, fill, w);
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function path(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }
  // Ward's sleeve trick: dark line at width + 6, then the fill color on top.
  function sleeve(ctx, pts, width, color) {
    path(ctx, pts); line(ctx, width + 6); ctx.stroke();
    path(ctx, pts); line(ctx, width, color); ctx.stroke();
  }
  function hand(ctx, x, y) {
    // small webbed hand: three rounded toes
    ellipse(ctx, x, y, 8, 7, C.bill, 2.5);
    line(ctx, 1.8, C.billDark);
    ctx.beginPath(); ctx.moveTo(x - 3, y + 2); ctx.lineTo(x - 3, y + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 3, y + 2); ctx.lineTo(x + 3, y + 6); ctx.stroke();
  }
  function arm(ctx, pts) { sleeve(ctx, pts, 13, C.fur); var e = pts[pts.length - 1]; hand(ctx, e[0], e[1]); }
  function check(ctx, x, y, s) {
    ctx.beginPath(); ctx.moveTo(x - 7 * s, y); ctx.lineTo(x - 2 * s, y + 6 * s); ctx.lineTo(x + 9 * s, y - 7 * s);
    line(ctx, 4.5 * s, C.check); ctx.stroke();
  }

  // ---------- body parts ----------
  function shadow(ctx) { ctx.beginPath(); ctx.ellipse(135, 241, 64, 8, 0, 0, Math.PI * 2); ctx.fillStyle = C.shadow; ctx.fill(); }

  function tail(ctx, sway) {
    ctx.save();
    ctx.translate(170, 214); ctx.rotate(-0.35 + sway);
    ellipse(ctx, 34, 0, 36, 15, C.furDark);
    line(ctx, 2, "rgba(58,42,31,0.35)");
    for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(18 + i * 12, -8); ctx.lineTo(24 + i * 12, 8); ctx.stroke(); }
    ctx.restore();
  }

  function foot(ctx, x) {
    rrect(ctx, x - 9, 202, 18, 28, 7); fillStroke(ctx, C.fur);
    ctx.beginPath();
    ctx.moveTo(x - 15, 236); ctx.quadraticCurveTo(x - 14, 224, x, 224); ctx.quadraticCurveTo(x + 14, 224, x + 15, 236);
    ctx.quadraticCurveTo(x + 10, 233, x + 5, 237); ctx.quadraticCurveTo(x, 233, x - 5, 237); ctx.quadraticCurveTo(x - 10, 233, x - 15, 236);
    ctx.closePath(); fillStroke(ctx, C.bill, 2.5);
  }

  function body(ctx) {
    ellipse(ctx, 135, 154, 56, 72, C.fur);
    // shirt + vest, clipped to the body
    ctx.save();
    ctx.beginPath(); ctx.ellipse(135, 154, 56, 72, 0, 0, Math.PI * 2); ctx.clip();
    ctx.beginPath(); ctx.moveTo(110, 176); ctx.lineTo(160, 176); ctx.lineTo(160, 232); ctx.lineTo(110, 232); ctx.closePath();
    fillStroke(ctx, C.shirt);
    ctx.beginPath(); ctx.moveTo(70, 174); ctx.lineTo(116, 174); ctx.lineTo(132, 218); ctx.lineTo(132, 232); ctx.lineTo(70, 232); ctx.closePath();
    fillStroke(ctx, C.vest);
    ctx.beginPath(); ctx.moveTo(200, 174); ctx.lineTo(154, 174); ctx.lineTo(138, 218); ctx.lineTo(138, 232); ctx.lineTo(200, 232); ctx.closePath();
    fillStroke(ctx, C.vest);
    ctx.restore();
    ctx.beginPath(); ctx.ellipse(135, 154, 56, 72, 0, 0, Math.PI * 2); line(ctx, 3); ctx.stroke();
    // shirt collar points
    ctx.beginPath(); ctx.moveTo(118, 174); ctx.lineTo(127, 186); ctx.lineTo(135, 176); ctx.closePath(); fillStroke(ctx, C.shirt, 2.5);
    ctx.beginPath(); ctx.moveTo(152, 174); ctx.lineTo(143, 186); ctx.lineTo(135, 176); ctx.closePath(); fillStroke(ctx, C.shirt, 2.5);
    // brass buttons and a pocket
    ellipse(ctx, 128, 202, 3.5, 3.5, C.brass, 2);
    ellipse(ctx, 132, 215, 3.5, 3.5, C.brass, 2);
    rrect(ctx, 156, 194, 18, 10, 2); fillStroke(ctx, C.vestDark, 2.5);
  }

  function eyes(ctx, mode, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    [116, 154].forEach(function (x) {
      var y = 110;
      if (mode === "happy") {
        ctx.beginPath(); ctx.arc(x, y + 4, 7, Math.PI * 1.12, Math.PI * 1.88); line(ctx, 3.5); ctx.stroke();
      } else if (mode === "blink") {
        ctx.beginPath(); ctx.moveTo(x - 6, y + 1); ctx.quadraticCurveTo(x, y + 4, x + 6, y + 1); line(ctx, 3.5); ctx.stroke();
      } else {
        ellipse(ctx, x + dx, y + dy, 6, 7.5, C.eye, 0);
        ellipse(ctx, x + dx - 2, y + dy - 3, 2.3, 2.3, C.shine, 0);
      }
    });
  }

  function brows(ctx, mode) {
    line(ctx, 3.5, C.furDark);
    if (mode === "worried") {
      ctx.beginPath(); ctx.moveTo(106, 97); ctx.lineTo(124, 90); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(164, 97); ctx.lineTo(146, 90); ctx.stroke();
    } else if (mode === "focused") {
      ctx.beginPath(); ctx.moveTo(106, 94); ctx.lineTo(124, 98); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(164, 94); ctx.lineTo(146, 98); ctx.stroke();
    } else if (mode === "curious") {
      ctx.beginPath(); ctx.moveTo(106, 96); ctx.lineTo(124, 96); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(146, 92); ctx.quadraticCurveTo(155, 85, 164, 90); ctx.stroke();
    } else if (mode === "up") {
      ctx.beginPath(); ctx.moveTo(106, 93); ctx.quadraticCurveTo(115, 87, 124, 92); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(146, 92); ctx.quadraticCurveTo(155, 87, 164, 93); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(107, 96); ctx.quadraticCurveTo(115, 93, 123, 95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(147, 95); ctx.quadraticCurveTo(155, 93, 163, 96); ctx.stroke();
    }
  }

  function bill(ctx, mood) {
    // wide, flat duck-like bill that flares out past the face
    ctx.beginPath();
    ctx.moveTo(110, 126);
    ctx.quadraticCurveTo(135, 118, 160, 126);
    ctx.quadraticCurveTo(187, 138, 185, 156);
    ctx.quadraticCurveTo(181, 175, 135, 173);
    ctx.quadraticCurveTo(89, 175, 85, 156);
    ctx.quadraticCurveTo(83, 138, 110, 126);
    ctx.closePath(); fillStroke(ctx, C.bill);
    // lighter upper bill
    ctx.beginPath();
    ctx.moveTo(113, 130); ctx.quadraticCurveTo(135, 123, 157, 130);
    ctx.quadraticCurveTo(177, 139, 177, 148); ctx.quadraticCurveTo(135, 155, 93, 148);
    ctx.quadraticCurveTo(93, 139, 113, 130); ctx.closePath();
    ctx.fillStyle = "#777C85"; ctx.fill();
    ellipse(ctx, 127, 132, 2.8, 2.2, C.billDark, 0);
    ellipse(ctx, 143, 132, 2.8, 2.2, C.billDark, 0);
    line(ctx, 2.5, C.billDark);
    if (mood === "happy") {
      ctx.beginPath(); ctx.moveTo(102, 158); ctx.quadraticCurveTo(135, 176, 168, 158);
      ctx.fillStyle = O; ctx.fill(); line(ctx, 2.5); ctx.stroke();
    } else if (mood === "frown") {
      ctx.beginPath(); ctx.moveTo(104, 164); ctx.quadraticCurveTo(135, 152, 166, 164); ctx.stroke();
    } else if (mood === "hm") {
      ctx.beginPath(); ctx.moveTo(104, 162); ctx.quadraticCurveTo(135, 160, 166, 163); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(100, 159); ctx.quadraticCurveTo(135, 169, 170, 159); ctx.stroke();
    }
  }

  // ---------- props ----------
  function clipboard(ctx, ticks, x, y, rot, redX) {
    ctx.save(); ctx.translate(x === undefined ? 106 : x, y === undefined ? 190 : y); ctx.rotate(rot === undefined ? 0.12 : rot);
    rrect(ctx, -24, -32, 48, 62, 5); fillStroke(ctx, C.board);
    rrect(ctx, -19, -24, 38, 50, 3); fillStroke(ctx, C.paper, 2.5);
    rrect(ctx, -10, -37, 20, 10, 3); fillStroke(ctx, C.clip, 2.5);
    for (var i = 0; i < 4; i++) {
      var y = -14 + i * 11;
      rrect(ctx, -14, y - 4, 8, 8, 1.5); fillStroke(ctx, C.paper, 1.8);
      line(ctx, 2, C.ink); ctx.beginPath(); ctx.moveTo(-2, y); ctx.lineTo(12, y); ctx.stroke();
      if (i < ticks) check(ctx, -10, y - 1, 0.45);
    }
    if (redX) {
      line(ctx, 6, "#B8322A");
      ctx.beginPath(); ctx.moveTo(-15, -18); ctx.lineTo(15, 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(15, -18); ctx.lineTo(-15, 20); ctx.stroke();
    }
    ctx.restore();
  }

  function pencil(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.9);
    rrect(ctx, -4, -26, 8, 26, 2); fillStroke(ctx, C.pencil, 2.5);
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(0, 9); ctx.closePath(); fillStroke(ctx, C.paper, 2.5);
    ctx.restore();
  }

  function stickyNote(ctx, x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath(); ctx.rect(-19, -18, 38, 36); fillStroke(ctx, C.note, 2.5);
    line(ctx, 2, "rgba(58,42,31,0.45)");
    [-8, 0, 8].forEach(function (yy, i) { ctx.beginPath(); ctx.moveTo(-12, yy); ctx.lineTo(i === 2 ? 2 : 12, yy); ctx.stroke(); });
    ctx.restore();
  }

  function priceTag(ctx, x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    // string up to the hand
    line(ctx, 2.5, C.string); ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-24, 14); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-26, 0); ctx.lineTo(-14, -15); ctx.lineTo(24, -15); ctx.lineTo(24, 15); ctx.lineTo(-14, 15); ctx.closePath();
    fillStroke(ctx, C.tag);
    ellipse(ctx, -16, 0, 2.6, 2.6, C.string, 2);
    ctx.fillStyle = O; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("$3.50", 5, 1);
    ctx.restore();
  }

  // ---------- poses ----------
  function draw(ctx, state, time, st, reduce) {
    state = ALIAS[state] || state;
    time = time || 0; st = st === undefined ? 10 : st;
    var still = !!reduce;
    var blinking = !still && (time % 3.6) < 0.16;
    var bob = still ? 0 : Math.sin(time * 2) * 2;
    var hop = (state === "done" && !still && st < 0.7) ? -12 * Math.sin((st / 0.7) * Math.PI) : 0;
    var sway = still ? 0 : Math.sin(time * 1.6) * 0.08;
    if (state === "done" && !still) sway = -0.25 + Math.sin(time * 9) * 0.12;   // wag
    if (state === "waiting" && !still) sway = Math.abs(Math.sin(time * 5)) * -0.12;  // tap

    ctx.save();
    ctx.translate(135, 240); ctx.scale(1.18, 1.18); ctx.translate(-135, -240);
    shadow(ctx);
    ctx.save();
    ctx.translate(0, hop);
    tail(ctx, sway);
    foot(ctx, 116); foot(ctx, 154);
    ctx.translate(0, bob);
    body(ctx);

    if (state === "idle") {
      eyes(ctx, blinking ? "blink" : "open"); brows(ctx); bill(ctx);
      var s = still ? 0 : Math.sin(time * 2) * 2;
      arm(ctx, [[88, 158], [78, 176], [82 - s, 198]]);
      arm(ctx, [[182, 158], [192, 176], [188 + s, 198]]);
    } else if (state === "working") {
      var tick = still ? 0 : Math.max(0, Math.sin(time * 12)) * 4;
      var ticks = still ? 3 : Math.min(4, 1 + Math.floor(st / 1.1));
      eyes(ctx, blinking ? "blink" : "open", -3, 3); brows(ctx, "focused"); bill(ctx);
      arm(ctx, [[88, 158], [72, 190], [88, 214]]);
      clipboard(ctx, ticks);
      arm(ctx, [[182, 158], [170, 192], [132 - tick, 188 + tick]]);
      pencil(ctx, 132 - tick, 188 + tick);
    } else if (state === "waiting") {
      // has work coming: arms folded, eyes up toward Ward, tail tapping
      eyes(ctx, blinking ? "blink" : "open", 2, -3); brows(ctx); bill(ctx, "hm");
      arm(ctx, [[88, 166], [118, 196], [160, 190]]);
      arm(ctx, [[182, 166], [152, 198], [110, 190]]);
    } else if (state === "flagging") {
      // something stops the plan: clipboard up with a red X, hand on his cheek, worried
      var jolt = still ? 0 : Math.sin(time * 16) * 1.5;
      eyes(ctx, blinking ? "blink" : "open", 0, -1); brows(ctx, "worried"); bill(ctx, "frown");
      arm(ctx, [[88, 158], [72, 140], [88, 128]]);
      arm(ctx, [[182, 158], [208, 150], [214, 122]]);
      clipboard(ctx, 0, 214 + jolt, 100, -0.12, true);
    } else if (state === "reading-note") {
      var tilt = still ? 0.07 : 0.07 + Math.sin(time * 1.5) * 0.02;
      ctx.save(); ctx.translate(135, 140); ctx.rotate(tilt); ctx.translate(-135, -140);
      eyes(ctx, blinking ? "blink" : "open", 3, -2); brows(ctx, "curious"); bill(ctx, "hm");
      ctx.restore();
      arm(ctx, [[88, 158], [78, 176], [82, 198]]);
      arm(ctx, [[182, 158], [206, 140], [202, 112]]);
      stickyNote(ctx, 206, 92, 0.12 + (still ? 0 : Math.sin(time * 1.5) * 0.04));
    } else if (state === "done") {
      var swing = still ? 0 : Math.sin(time * 4) * 0.08;
      eyes(ctx, "happy"); brows(ctx, "up"); bill(ctx, "happy");
      arm(ctx, [[88, 158], [68, 180], [94, 194]]);              // hand on hip
      arm(ctx, [[182, 158], [204, 132], [196, 106]]);           // raised
      priceTag(ctx, 218, 92, -0.1 + swing);
      ellipse(ctx, 166, 74, 11, 11, C.check, 2.5);
      ctx.save(); ctx.translate(166, 74);
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-2, 5); ctx.lineTo(7, -5); line(ctx, 3.5, "#FFFFFF"); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
  }

  // ---------- public API (matches createQuill / createWard) ----------
  function createMarket(canvas, opts) {
    opts = opts || {};
    var root = typeof window !== "undefined" ? window : {};
    var ctx = canvas.getContext("2d");
    var state = STATES.indexOf(opts.state) >= 0 ? opts.state : "idle";
    var now = function () { return typeof performance !== "undefined" ? performance.now() : Date.now(); };
    var stateStart = now();
    var raf = 0;
    var reduce = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    var raff = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : function (f) { return setTimeout(function () { f(now()); }, 16); };
    var caf = root.cancelAnimationFrame ? root.cancelAnimationFrame.bind(root) : clearTimeout;

    function resize() {
      var dpr = root.devicePixelRatio || 1;
      var r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: canvas.width, height: canvas.height };
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    function frame(ts) {
      resize();
      var cw = canvas.width, ch = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch);
      var s = Math.min(cw / W, ch / H);
      ctx.setTransform(s, 0, 0, s, (cw - W * s) / 2, (ch - H * s) / 2);
      var t = ts === undefined ? now() : ts;
      draw(ctx, state, reduce ? 0 : t / 1000, reduce ? 10 : (t - stateStart) / 1000, reduce);
      if (!reduce) raf = raff(frame);
    }
    function start() { caf(raf); raf = raff(frame); }

    var api = {
      setState: function (next) {
        if (STATES.indexOf(next) < 0) throw new Error("Unknown Scout state: " + next + ". Use one of: " + STATES.join(", "));
        if (next !== state) { state = next; stateStart = now(); }
        start();
      },
      getState: function () { return state; },
      destroy: function () { caf(raf); }
    };
    if (reduce && root.addEventListener) root.addEventListener("resize", start);
    start();
    return api;
  }

  createMarket.STATES = STATES.slice(0, 5); // the five universal states
  createMarket._draw = draw; // used by preview sheets

  if (typeof window !== "undefined") window.createMarket = createMarket;
  if (typeof module !== "undefined" && module.exports) module.exports = { createMarket: createMarket };
})();
