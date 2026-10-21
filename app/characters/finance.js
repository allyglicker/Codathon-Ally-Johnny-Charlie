/*
 * finance.js: Penny, the Finance agent ("Money Coach") for the Neur Launch Desk demo.
 * A sweet grandma piggy bank: white curly bun, pearls, a lavender cardigan with a flower brooch, a coin slot and a calculator.
 *
 * Usage:
 *   const penny = createFinance(canvas, opts);   // opts: { state: "idle" }
 *   penny.setState("waiting");                   // idle | waiting | working | flagging | done  ("calculating" = working)
 *   penny.getState();
 *   penny.destroy();
 *
 * States and the demo event that triggers each:
 *   idle         reset(), before anything happens: arms relaxed at her sides, smiling
 *   waiting      waiting on Customer & Market and Quill: arms folded, foot tapping, eyes glancing left
 *   working      finance.received, running the numbers (and again for Ward's follow-up): calculator up, tapping keys, tape curling out
 *                (alias: "calculating")
 *   flagging     finance.done with "signal": "flag" (e.g. startup cost over budget): red "OVER" on the calculator, hoof on cheek, worried
 *   done         handoff sent to Ward: holds up the printed tape with a green check, waves, happy eyes
 *
 * Style matches the shared spec: 270 x 260 design box, outline #3A2A1F at lineWidth 3,
 * round joins and caps, flat fills only, soft ground shadow at the feet.
 *
 * Motion: breathing bob and blinks (~3.8 s) in every state; foot taps and drifting eyes while waiting;
 * a tapping hoof and flickering digits while calculating; a hop on arrival, then a slow wave, when done.
 * With prefers-reduced-motion, each state draws once as a still pose and no loop runs.
 * Deferred hooks (not built): "flagging" state, speech bubbles, reacting to passing folders, click-to-inspect.
 */
(function () {
  "use strict";

  var W = 270, H = 260;
  // The five universal states every Neur character supports, plus Penny's own name for working.
  var STATES = ["idle", "waiting", "working", "flagging", "done", "calculating"];
  var ALIAS = { calculating: "working" };
  var O = "#3A2A1F";

  // Fixed palette: the same on light and dark pages.
  var C = {
    body: "#F7B5C3",
    bodyDark: "#EC8FA4",
    snout: "#F29CB0",
    blush: "#F27D9A",
    hoof: "#D9758D",
    hair: "#F3EFE8",
    hairShade: "#CFC7BC",
    brow: "#9A8F86",
    cardigan: "#9C7BB8",
    cardiganDark: "#7B5C99",
    pearl: "#FFFDF7",
    brooch: "#F27D9A",
    broochMid: "#F7D46B",
    eye: "#3A2A1F",
    shine: "#FFFFFF",
    calc: "#4A4954",
    calcScreen: "#D3E8C9",
    calcKey: "#F4EEE2",
    calcKeyHot: "#DE7F72",
    tape: "#FFFBF2",
    ink: "#9C9184",
    check: "#2F8A4E",
    shadow: "rgba(20,14,10,0.16)",
    mouth: "#3A2A1F",
    tongue: "#F27D9A"
  };

  // ---------- small drawing helpers ----------

  function line(ctx, w) {
    ctx.strokeStyle = O;
    ctx.lineWidth = w || 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  }

  function fillStroke(ctx, fill, w) {
    ctx.fillStyle = fill;
    ctx.fill();
    line(ctx, w);
    ctx.stroke();
  }

  function ellipse(ctx, x, y, rx, ry, fill, w) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (w === 0) { ctx.fillStyle = fill; ctx.fill(); } else { fillStroke(ctx, fill, w); }
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function path(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }

  // Ward's sleeve trick: dark line at width + 6, then the fill color on top.
  function sleeve(ctx, pts, width, color) {
    path(ctx, pts);
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = O; ctx.lineWidth = width + 6; ctx.stroke();
    path(ctx, pts);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }

  function arm(ctx, pts) {
    sleeve(ctx, pts, 14, C.body);
    var end = pts[pts.length - 1];
    ellipse(ctx, end[0], end[1], 8, 8, C.hoof, 2.5);
  }

  function check(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x - 7 * s, y);
    ctx.lineTo(x - 2 * s, y + 6 * s);
    ctx.lineTo(x + 9 * s, y - 7 * s);
    ctx.strokeStyle = C.check; ctx.lineWidth = 4.5 * s;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.stroke();
  }

  // ---------- body parts ----------

  function shadow(ctx) {
    ctx.beginPath();
    ctx.ellipse(135, 241, 62, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.shadow; ctx.fill();
  }

  function leg(ctx, x, lift, tilt) {
    ctx.save();
    ctx.translate(x + 12, 205 - lift);
    ctx.rotate(tilt || 0);
    rrect(ctx, -12, -6, 24, 38, 9);
    fillStroke(ctx, C.body);
    rrect(ctx, -12, 22, 24, 10, 5);
    fillStroke(ctx, C.hoof, 2.5);
    ctx.restore();
  }

  function tail(ctx) {
    var pts = [[200, 172], [214, 166], [222, 172], [218, 181], [210, 180], [211, 173]];
    sleeve(ctx, pts, 5, C.body);
  }

  function ears(ctx, perk) {
    var p = perk ? 6 : 0;
    // rounded, slightly floppy pig ears
    ctx.beginPath(); ctx.moveTo(84, 106);
    ctx.quadraticCurveTo(66, 74, 78, 62 - p);
    ctx.quadraticCurveTo(102, 62 - p, 120, 88);
    ctx.closePath();
    fillStroke(ctx, C.body);
    ctx.beginPath(); ctx.moveTo(92, 97);
    ctx.quadraticCurveTo(80, 78, 86, 72 - p);
    ctx.quadraticCurveTo(100, 72 - p, 110, 89);
    ctx.closePath();
    ctx.fillStyle = C.bodyDark; ctx.fill();

    ctx.beginPath(); ctx.moveTo(186, 106);
    ctx.quadraticCurveTo(204, 74, 192, 62 - p);
    ctx.quadraticCurveTo(168, 62 - p, 150, 88);
    ctx.closePath();
    fillStroke(ctx, C.body);
    ctx.beginPath(); ctx.moveTo(178, 97);
    ctx.quadraticCurveTo(190, 78, 184, 72 - p);
    ctx.quadraticCurveTo(170, 72 - p, 160, 89);
    ctx.closePath();
    ctx.fillStyle = C.bodyDark; ctx.fill();
  }

  function body(ctx) {
    ellipse(ctx, 135, 148, 70, 66, C.body);
    // coin slot
    rrect(ctx, 136, 88, 26, 7, 3.5);
    ctx.fillStyle = O; ctx.fill();
  }

  function hair(ctx) {
    // soft white curls along the top of her head, and a bun with a hairpin
    var curls = [[96, 100, 9], [106, 91, 10], [119, 86, 10]];
    for (var i = 0; i < curls.length; i++) ellipse(ctx, curls[i][0], curls[i][1], curls[i][2], curls[i][2], C.hair, 2.5);
    ellipse(ctx, 112, 70, 15, 14, C.hair, 3);
    ctx.strokeStyle = C.hairShade; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(112, 70, 7, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(106, 92, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    // hairpin
    line(ctx, 3); ctx.beginPath(); ctx.moveTo(98, 62); ctx.lineTo(128, 76); ctx.stroke();
    ellipse(ctx, 98, 62, 3.5, 3.5, C.brooch, 2);
  }

  function cardigan(ctx) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(135, 148, 70, 66, 0, 0, Math.PI * 2); ctx.clip();
    // two front panels with a V opening
    ctx.beginPath(); ctx.moveTo(55, 170); ctx.lineTo(118, 172); ctx.lineTo(131, 222); ctx.lineTo(55, 222); ctx.closePath();
    fillStroke(ctx, C.cardigan);
    ctx.beginPath(); ctx.moveTo(215, 170); ctx.lineTo(152, 172); ctx.lineTo(139, 222); ctx.lineTo(215, 222); ctx.closePath();
    fillStroke(ctx, C.cardigan);
    // a little knit texture
    ctx.strokeStyle = C.cardiganDark; ctx.lineWidth = 2;
    [[80, 192], [94, 204], [176, 194], [190, 206]].forEach(function (k) {
      ctx.beginPath(); ctx.moveTo(k[0] - 4, k[1] - 3); ctx.lineTo(k[0], k[1] + 2); ctx.lineTo(k[0] + 4, k[1] - 3); ctx.stroke();
    });
    ctx.restore();
    // re-stroke the body outline over the cardigan
    ctx.beginPath(); ctx.ellipse(135, 148, 70, 66, 0, 0, Math.PI * 2); line(ctx, 3); ctx.stroke();
    // buttons
    ellipse(ctx, 150, 200, 3.5, 3.5, C.cardiganDark, 2);
    ellipse(ctx, 147, 212, 3.5, 3.5, C.cardiganDark, 2);
    // flower brooch
    for (var i = 0; i < 5; i++) {
      var a = (i / 5) * Math.PI * 2;
      ellipse(ctx, 100 + Math.cos(a) * 5, 186 + Math.sin(a) * 5, 4, 4, C.brooch, 1.8);
    }
    ellipse(ctx, 100, 186, 3, 3, C.broochMid, 1.8);
  }

  function pearls(ctx) {
    for (var x = 115; x <= 156; x += 6.8) {
      var t = (x - 135) / 21;
      ellipse(ctx, x, 192 + 6 * (1 - t * t), 3.4, 3.4, C.pearl, 1.8);
    }
  }

  function lashes(ctx, x, y, side) {
    // eyelashes on the upper outer corner
    // side = -1 for the eye on the viewer's left, +1 for the right
    line(ctx, 2.5);
    ctx.beginPath(); ctx.moveTo(x + side * 6, y - 7); ctx.lineTo(x + side * 11, y - 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + side * 8, y - 3); ctx.lineTo(x + side * 14, y - 6); ctx.stroke();
    smileLines(ctx, x, y, side);
  }

  function smileLines(ctx, x, y, side) {
    // gentle smile lines at the lower outer corner of each eye
    // side = -1 for the eye on the viewer's left, +1 for the right
    ctx.strokeStyle = C.brow; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(x + side * 8, y + 2, 7, side < 0 ? Math.PI * 0.75 : Math.PI * 0.05, side < 0 ? Math.PI * 0.95 : Math.PI * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + side * 8, y + 2, 11, side < 0 ? Math.PI * 0.72 : Math.PI * 0.08, side < 0 ? Math.PI * 0.92 : Math.PI * 0.28); ctx.stroke();
  }

  function eyes(ctx, mode, dx, dy) {
    dx = dx || 0; dy = dy || 0;
    var xs = [113, 157];
    for (var i = 0; i < 2; i++) {
      var x = xs[i], y = 132, side = i === 0 ? -1 : 1;
      if (mode === "blink") {
        line(ctx, 3.5);
        ctx.beginPath(); ctx.moveTo(x - 8, y + 1); ctx.quadraticCurveTo(x, y + 5, x + 8, y + 1); ctx.stroke();
        lashes(ctx, x, y, side);
      } else if (mode === "happy") {
        ctx.beginPath();
        ctx.arc(x, y + 5, 9, Math.PI * 1.12, Math.PI * 1.88);
        line(ctx, 3.5); ctx.stroke();
        lashes(ctx, x, y + 2, side);
      } else {
        ctx.beginPath(); ctx.ellipse(x + dx, y + dy, 7.5, 9, 0, 0, Math.PI * 2);
        ctx.fillStyle = C.eye; ctx.fill();
        ctx.beginPath(); ctx.arc(x + dx - 2.5, y + dy - 3.5, 3, 0, Math.PI * 2);
        ctx.fillStyle = C.shine; ctx.fill();
        ctx.beginPath(); ctx.arc(x + dx + 3, y + dy + 4, 1.7, 0, Math.PI * 2);
        ctx.fill();
        lashes(ctx, x, y, side);
      }
    }
  }

  function brows(ctx, mode) {
    line(ctx, 4); ctx.strokeStyle = C.brow;
    if (mode === "worried") {
      ctx.beginPath(); ctx.moveTo(105, 113); ctx.lineTo(121, 106); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(165, 113); ctx.lineTo(149, 106); ctx.stroke();
    } else if (mode === "focused") {
      ctx.beginPath(); ctx.moveTo(105, 112); ctx.quadraticCurveTo(113, 113, 121, 116); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(165, 112); ctx.quadraticCurveTo(157, 113, 149, 116); ctx.stroke();
    } else if (mode === "flat") {
      ctx.beginPath(); ctx.moveTo(105, 114); ctx.lineTo(121, 113); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(149, 110); ctx.quadraticCurveTo(157, 105, 165, 109); ctx.stroke();
    } else if (mode === "up") {
      ctx.beginPath(); ctx.moveTo(105, 109); ctx.quadraticCurveTo(113, 103, 121, 107); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(149, 107); ctx.quadraticCurveTo(157, 103, 165, 109); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(106, 112); ctx.quadraticCurveTo(113, 108, 120, 111); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(150, 111); ctx.quadraticCurveTo(157, 108, 164, 112); ctx.stroke();
    }
  }

  function snout(ctx) {
    ellipse(ctx, 95, 158, 11, 6.5, C.blush, 0);
    ellipse(ctx, 175, 158, 11, 6.5, C.blush, 0);
    ellipse(ctx, 135, 158, 18, 12.5, C.snout);
    ellipse(ctx, 128, 158, 3, 4.5, O, 0);
    ellipse(ctx, 142, 158, 3, 4.5, O, 0);
  }

  function mouth(ctx, mode) {
    line(ctx, 3);
    if (mode === "wobble") {
      ctx.beginPath(); ctx.moveTo(126, 182); ctx.lineTo(130, 178); ctx.lineTo(135, 182); ctx.lineTo(140, 178); ctx.lineTo(144, 182); ctx.stroke();
    } else if (mode === "pout") {
      ctx.beginPath(); ctx.moveTo(129, 182); ctx.quadraticCurveTo(135, 178, 141, 182); ctx.stroke();
    } else if (mode === "tongue") {
      ctx.beginPath(); ctx.moveTo(128, 178); ctx.quadraticCurveTo(135, 184, 142, 178); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(137, 181); ctx.quadraticCurveTo(141, 189, 145, 181);
      fillStroke(ctx, C.tongue, 2.5);
    } else if (mode === "big") {
      ctx.beginPath();
      ctx.moveTo(125, 177);
      ctx.quadraticCurveTo(135, 194, 145, 177);
      ctx.closePath();
      fillStroke(ctx, C.mouth);
      ctx.save(); ctx.clip();
      ellipse(ctx, 135, 189, 7, 5, C.tongue, 0);
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.moveTo(126, 178); ctx.quadraticCurveTo(135, 187, 144, 178); ctx.stroke();
    }
  }

  function calculator(ctx, digits, alert) {
    ctx.save();
    ctx.translate(172, 198);
    ctx.rotate(-0.12);
    // paper tape curling out the top
    sleeve(ctx, [[-6, -36], [-8, -58], [-2, -74], [12, -78], [18, -68], [12, -62]], 14, C.tape);
    line(ctx, 2); ctx.strokeStyle = C.ink;
    ctx.beginPath(); ctx.moveTo(-11, -46); ctx.lineTo(-3, -46); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-11, -53); ctx.lineTo(-5, -53); ctx.stroke();
    // body
    rrect(ctx, -28, -36, 56, 72, 9);
    fillStroke(ctx, C.calc);
    // screen
    rrect(ctx, -20, -28, 40, 16, 4);
    fillStroke(ctx, alert ? "#F6C3BC" : C.calcScreen, 2.5);
    ctx.fillStyle = alert ? "#B8322A" : O;
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(digits || "300", 15, -19.5);
    // keys
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 3; c++) {
        rrect(ctx, -20 + c * 14, -4 + r * 12, 11, 9, 2.5);
        fillStroke(ctx, r === 2 && c === 2 ? C.calcKeyHot : C.calcKey, 2);
      }
    }
    ctx.restore();
  }

  function receipt(ctx) {
    ctx.save();
    ctx.translate(222, 98);
    ctx.rotate(0.08);
    ctx.beginPath();
    ctx.moveTo(-14, 0); ctx.lineTo(14, 0); ctx.lineTo(14, 74);
    for (var i = 0; i < 4; i++) { ctx.lineTo(10.5 - i * 7, 79); ctx.lineTo(7 - i * 7, 74); }
    ctx.closePath();
    fillStroke(ctx, C.tape);
    line(ctx, 2); ctx.strokeStyle = C.ink;
    var ys = [14, 22, 30];
    for (var j = 0; j < ys.length; j++) {
      ctx.beginPath(); ctx.moveTo(-8, ys[j]); ctx.lineTo(j === 1 ? 2 : 8, ys[j]); ctx.stroke();
    }
    check(ctx, 0, 52, 1.1);
    ctx.restore();
  }

  function tapMarks(ctx, x, y) {
    line(ctx, 2.5);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 1, y + 8); ctx.lineTo(x + 10, y + 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 16); ctx.lineTo(x + 8, y + 19); ctx.stroke();
  }

  // ---------- the poses ----------

  var SCALE = 1.15; // grows Penny around her feet so she stands as tall as Quill
  var DIGITS = ["128", "47", "300", "6.5", "1040", "1.75", "525", "300"];

  // time: seconds since start (0 when reduced motion); st: seconds since the last setState
  function draw(ctx, state, time, st, reduce) {
    state = ALIAS[state] || state;
    time = time || 0; st = st === undefined ? 10 : st;
    ctx.save();
    ctx.translate(135, 240); ctx.scale(SCALE, SCALE); ctx.translate(-135, -240);
    drawPose(ctx, state, time, st, reduce);
    ctx.restore();
  }

  function drawPose(ctx, state, time, st, reduce) {
    var still = !!reduce;
    // blink every ~3.8 s (never in reduced motion, never while happy-eyed)
    var b = time % 3.8;
    var blinking = !still && b < 0.16;
    var bob = still ? 0 : Math.sin(time * 2) * 2;               // breathing
    var hop = 0;
    if (state === "done" && !still && st < 0.7) hop = -12 * Math.sin((st / 0.7) * Math.PI);

    shadow(ctx);

    // foot tap while waiting
    var lift = 0;
    if (state === "waiting") lift = still ? 7 : 7 * Math.abs(Math.sin(time * 5));

    ctx.save();
    ctx.translate(0, hop);
    leg(ctx, 100, 0, 0);
    leg(ctx, 146, lift, state === "waiting" ? -0.026 * lift : 0);
    if (state === "waiting" && lift < 2.5) tapMarks(ctx, 186, 214);

    ctx.translate(0, bob);
    tail(ctx);
    ears(ctx, state === "done");
    body(ctx);
    cardigan(ctx);
    pearls(ctx);
    hair(ctx);
    snout(ctx);

    if (state === "idle") {
      eyes(ctx, blinking ? "blink" : "open"); brows(ctx); mouth(ctx);
      var sway = still ? 0 : Math.sin(time * 2) * 2;
      arm(ctx, [[78, 160], [60, 186], [64 - sway, 203]]);
      arm(ctx, [[192, 160], [210, 186], [206 + sway, 203]]);
    } else if (state === "waiting") {
      // eyes drift between Market and Quill (both to her left)
      var look = still ? -4 : -2.5 - 2 * Math.sin(time * 1.3);
      eyes(ctx, blinking ? "blink" : "open", look, 0); brows(ctx, "flat"); mouth(ctx, "pout");
      arm(ctx, [[80, 180], [118, 206], [162, 198]]);
      arm(ctx, [[190, 180], [152, 208], [108, 198]]);
    } else if (state === "working") {
      var tap = still ? 0 : Math.max(0, Math.sin(time * 14)) * 5;
      var digits = still ? "300" : DIGITS[Math.floor(time * 6) % DIGITS.length];
      eyes(ctx, blinking ? "blink" : "open", 3, 3); brows(ctx, "focused"); mouth(ctx, "tongue");
      arm(ctx, [[194, 168], [210, 202], [196, 226]]);
      calculator(ctx, digits);
      arm(ctx, [[80, 176], [116, 204], [156, 200 + tap]]);
    } else if (state === "flagging") {
      // something stops the plan: red "OVER" on the calculator, hoof on her cheek, worried
      var shake = still ? 0 : Math.sin(time * 18) * 1.5;
      eyes(ctx, blinking ? "blink" : "open", 0, -1); brows(ctx, "worried"); mouth(ctx, "wobble");
      arm(ctx, [[194, 168], [210, 202], [196, 226]]);
      ctx.save(); ctx.translate(shake, 0); calculator(ctx, "OVER", true); ctx.restore();
      arm(ctx, [[80, 170], [72, 156], [90, 152]]);
    } else if (state === "done") {
      var wave = still ? 0 : Math.sin(time * 5) * 7;
      eyes(ctx, "happy"); brows(ctx, "up"); mouth(ctx, "big");
      arm(ctx, [[78, 156], [58 + wave * 0.4, 132], [52 + wave, 108]]);
      receipt(ctx);
      arm(ctx, [[192, 156], [212, 128], [220, 102]]);
    }
    ctx.restore();
  }

  // ---------- public API (matches createQuill / createWard) ----------

  function createFinance(canvas, opts) {
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
      var w = Math.max(1, Math.round(r.width * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }

    function frame(ts) {
      resize();
      var cw = canvas.width, ch = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      var s = Math.min(cw / W, ch / H);
      ctx.setTransform(s, 0, 0, s, (cw - W * s) / 2, (ch - H * s) / 2);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      var t = ts === undefined ? now() : ts;
      var time = reduce ? 0 : t / 1000;
      var st = reduce ? 10 : (t - stateStart) / 1000;
      draw(ctx, state, time, st, reduce);
      if (!reduce) raf = raff(frame);
    }

    function start() {
      caf(raf);
      raf = raff(frame);
    }

    var api = {
      setState: function (next) {
        if (STATES.indexOf(next) < 0) throw new Error("Unknown Penny state: " + next + ". Use one of: " + STATES.join(", "));
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

  createFinance.STATES = STATES.slice(0, 5); // the five universal states
  createFinance._draw = draw; // used by the preview sheet

  if (typeof window !== "undefined") window.createFinance = createFinance;
  if (typeof module !== "undefined" && module.exports) module.exports = { createFinance: createFinance };
})();
