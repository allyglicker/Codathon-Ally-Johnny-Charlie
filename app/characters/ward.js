/* ward.js: Ward, Nuer's Manager (hub) agent, drawn on a <canvas>, seated behind his desk.
   No dependencies. Plain JavaScript. Same flat style and line weight as quill.js.

   Usage:
     const ward = createWard(document.getElementById("ward"));
     ward.setState("reviewing");   // idle | delegating | reviewing | alert | approving
     ward.getState();
     ward.destroy();

   Suggested event mapping:
     founder profile arrives / handoffs return -> "reviewing"
     sending work to a specialist              -> "delegating"
     manager.conflict                          -> "alert"
     manager.roadmap delivered                 -> "approving"
   Give the canvas a 270:260 shape (CSS aspect-ratio: 270 / 260).
*/
(function (root) {
  "use strict";

  var C = {
    line: "#3A2A1F",
    skin: "#EFC9AE",
    skinShade: "#C99A7E",
    hair: "#D3CFC9",
    hairDark: "#9E9890",
    beard: "#C4BEB6",
    glasses: "#26201C",
    blazer: "#6F706B",
    blazerDark: "#575852",
    fleck: "#8C8D86",
    shirt: "#9DB39A",
    tie: "#5E6F82",
    tieStripe: "#AEBBC9",
    desk: "#A27A55",
    deskTop: "#7E5B3E",
    brass: "#C9A04A",
    folder: "#E8C57E",
    pen: "#B8322A",
    paper: "#FBF6EC",
    check: "#2F8A4E"
  };
  var W = 270, H = 260;
  var STATES = ["idle", "delegating", "reviewing", "alert", "approving"];
  // Universal Neur states (integration handoff, Part 5) map onto Ward's own poses.
  var ALIAS = { waiting: "idle", working: "reviewing", flagging: "alert", done: "approving" };
  function canon(name) { return ALIAS[name] || name; }

  // fixed tweed fleck pattern so it doesn't shimmer between frames
  var FLECKS = [];
  (function () {
    var seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    for (var i = 0; i < 70; i++) FLECKS.push([50 + rnd() * 170, 140 + rnd() * 70, rnd() < 0.5]);
  })();

  function createWard(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var state = STATES.indexOf(canon(opts.state)) >= 0 ? canon(opts.state) : "idle";
    var stateStart = performance.now();
    var raf = 0;
    var reduce = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);

    function resize() {
      var dpr = root.devicePixelRatio || 1;
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    function ell(x, y, rx, ry, fill, noStroke) {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (!noStroke) ctx.stroke();
    }
    function seg(x1, y1, x2, y2, color, w) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    }
    // A sleeve: thick polyline with an outline, so it matches the 3px line style.
    function sleeve(pts, w) {
      ctx.save();
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      [[w + 6, C.line], [w, C.blazer]].forEach(function (pass) {
        ctx.strokeStyle = pass[1]; ctx.lineWidth = pass[0];
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.stroke();
      });
      ctx.restore();
    }
    function hand(x, y) { ell(x, y, 9, 8, C.skin); }
    function rrect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function folder(x, y, w, h) {
      ctx.save(); ctx.fillStyle = C.folder; ctx.lineWidth = 2.5;
      rrect(x + 4, y - 6, w * 0.38, 10, 3); ctx.fill(); ctx.stroke();
      rrect(x, y, w, h, 3); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(58,42,31,0.35)"; ctx.lineWidth = 1.5;
      for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 8, y + 10 + i * 8); ctx.lineTo(x + w - 10, y + 10 + i * 8); ctx.stroke(); }
      ctx.restore();
    }

    function draw(now) {
      resize();
      var cw = canvas.width, ch = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch);
      var s = Math.min(cw / W, ch / H);
      ctx.setTransform(s, 0, 0, s, (cw - W * s) / 2, (ch - H * s) / 2);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = C.line; ctx.lineWidth = 3;

      var time = reduce ? 0 : now / 1000;
      var st = reduce ? 10 : (now - stateStart) / 1000;
      var breathe = reduce ? 0 : Math.sin(time * 1.8) * 1.2;

      ctx.save();
      ctx.translate(0, breathe);

      // neck
      ctx.fillStyle = C.skin; ctx.fillRect(121, 108, 28, 34); ctx.strokeRect(121, 108, 28, 34);

      // torso (blazer)
      ctx.beginPath();
      ctx.moveTo(46, 215);
      ctx.bezierCurveTo(48, 165, 70, 142, 106, 135);
      ctx.lineTo(164, 135);
      ctx.bezierCurveTo(200, 142, 222, 165, 224, 215);
      ctx.closePath();
      ctx.fillStyle = C.blazer; ctx.fill(); ctx.stroke();
      ctx.save(); ctx.clip();
      FLECKS.forEach(function (f) {
        ctx.fillStyle = f[2] ? C.fleck : C.blazerDark;
        ctx.fillRect(f[0], f[1], 3, 1.5);
      });
      ctx.restore();

      // shirt V, collar, tie
      ctx.beginPath(); ctx.moveTo(112, 135); ctx.lineTo(158, 135); ctx.lineTo(135, 192); ctx.closePath();
      ctx.fillStyle = C.shirt; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(129, 141); ctx.lineTo(141, 141); ctx.lineTo(139, 151); ctx.lineTo(131, 151); ctx.closePath();
      ctx.fillStyle = C.tie; ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.beginPath(); ctx.moveTo(131, 151); ctx.lineTo(139, 151); ctx.lineTo(143, 186); ctx.lineTo(135, 192); ctx.lineTo(127, 186); ctx.closePath();
      ctx.fillStyle = C.tie; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = C.tieStripe; ctx.lineWidth = 2;
      for (var k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(120, 146 + k * 8); ctx.lineTo(150, 160 + k * 8); ctx.stroke(); }
      ctx.restore();
      ctx.stroke();
      ctx.restore();
      [[112, 135, 125, 135, 118, 149], [158, 135, 145, 135, 152, 149]].forEach(function (c) {
        ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[2], c[3]); ctx.lineTo(c[4], c[5]); ctx.closePath();
        ctx.fillStyle = C.shirt; ctx.fill(); ctx.stroke();
      });
      // lapels
      seg(108, 137, 97, 153, C.blazerDark, 3); seg(97, 153, 127, 190, C.blazerDark, 3);
      seg(162, 137, 173, 153, C.blazerDark, 3); seg(173, 153, 143, 190, C.blazerDark, 3);

      // ears + head
      ell(101, 88, 7, 11, C.skin);
      ell(169, 88, 7, 11, C.skin);
      ell(135, 84, 34, 42, C.skin);

      // hair: grey at the sides, thin on top
      ctx.save(); ctx.fillStyle = C.hair; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(104, 58); ctx.quadraticCurveTo(95, 78, 103, 99); ctx.lineTo(109, 95); ctx.quadraticCurveTo(104, 78, 112, 60); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(166, 58); ctx.quadraticCurveTo(175, 78, 167, 99); ctx.lineTo(161, 95); ctx.quadraticCurveTo(166, 78, 158, 60); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = C.hairDark; ctx.lineWidth = 2.2;
      [[112, 54, 124, 44, 136, 46], [122, 50, 134, 40, 148, 44], [134, 48, 146, 41, 158, 52], [116, 58, 128, 50, 140, 52]].forEach(function (h) {
        ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.quadraticCurveTo(h[2], h[3], h[4], h[5]); ctx.stroke();
      });
      ctx.restore();

      // beard and mustache
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(102, 90);
      ctx.quadraticCurveTo(104, 122, 135, 129);
      ctx.quadraticCurveTo(166, 122, 168, 90);
      ctx.lineTo(162, 92);
      ctx.quadraticCurveTo(156, 104, 147, 105);
      ctx.quadraticCurveTo(135, 101, 123, 105);
      ctx.quadraticCurveTo(114, 104, 108, 92);
      ctx.closePath();
      ctx.fillStyle = C.beard; ctx.fill();
      ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(135, 104, 14, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();

      // mouth
      ctx.save(); ctx.strokeStyle = C.line; ctx.lineWidth = 2.5;
      if (state === "alert") { ell(135, 114, 3.5, 4.5, "#5A3A30"); }
      else if (state === "approving") { ctx.beginPath(); ctx.arc(135, 108, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(135, 107, 8, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
      ctx.restore();

      // nose
      ctx.save(); ctx.strokeStyle = C.skinShade; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(135, 82); ctx.quadraticCurveTo(129, 94, 133, 96); ctx.quadraticCurveTo(137, 97, 140, 95); ctx.stroke();
      ctx.restore();

      // eyes
      var eyeY = state === "reviewing" ? 85 : 81;
      var blink = false;
      if (!reduce && (state === "idle" || state === "delegating")) blink = (time % 4.2) < 0.14;
      [121, 149].forEach(function (ex) {
        if (blink) seg(ex - 4, eyeY, ex + 4, eyeY, C.line, 2.5);
        else ell(ex, eyeY, 3, 3.2, C.line, true);
      });

      // brows
      var by = state === "alert" ? 63 : 69;
      ctx.save(); ctx.strokeStyle = C.hairDark; ctx.lineWidth = 3.5;
      if (state === "alert") {
        ctx.beginPath(); ctx.arc(120, by + 8, 9, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(150, by + 8, 9, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
      } else {
        seg(113, by + 1, 128, by, C.hairDark, 3.5); seg(142, by, 157, by + 1, C.hairDark, 3.5);
      }
      ctx.restore();

      // glasses: round dark frames
      ctx.save(); ctx.strokeStyle = C.glasses; ctx.lineWidth = 3.6;
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      rrect(108, 71, 25, 21, 9); ctx.fill(); ctx.stroke();
      rrect(137, 71, 25, 21, 9); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(133, 79); ctx.quadraticCurveTo(135, 76, 137, 79); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(108, 78); ctx.lineTo(101, 82); ctx.moveTo(162, 78); ctx.lineTo(169, 82); ctx.stroke();
      ctx.restore();

      // arms + props
      var wave = reduce ? 0 : Math.sin(st * 3) * 3;
      var L = { sh: [72, 158], pts: [[72, 158], [64, 206]], hand: [86, 205] };
      var R = { sh: [198, 158], pts: [[198, 158], [206, 206]], hand: [184, 205] };
      var front = [];   // things drawn after the desk

      if (state === "delegating") {
        R.pts = [[198, 158], [226, 178], [250, 166 + wave]];
        R.hand = [256, 164 + wave];
        front.push(function () { folder(236, 138 + wave, 32, 20); hand(R.hand[0], R.hand[1]); });
      }
      if (state === "reviewing") {
        L.pts = [[72, 158], [86, 198], [110, 182]]; L.hand = [112, 180];
        R.pts = [[198, 158], [184, 198], [160, 182]]; R.hand = [158, 180];
      }
      if (state === "alert") {
        R.pts = [[198, 158], [222, 142], [214, 112 + wave * 0.5]];
        R.hand = [212, 108 + wave * 0.5];
      }
      if (state === "approving") {
        L.pts = [[72, 158], [46, 142], [52, 110]];
        L.hand = [54, 106];
      }

      sleeve(L.pts, 18);
      sleeve(R.pts, 18);
      ctx.restore();   // end breathing translate for body; desk does not move

      // desk
      ctx.fillStyle = C.desk; ctx.fillRect(14, 206, 242, 60); ctx.strokeRect(14, 206, 242, 60);
      ctx.fillStyle = C.deskTop; ctx.fillRect(6, 198, 258, 12); ctx.strokeRect(6, 198, 258, 12);
      ctx.save();
      ctx.fillStyle = C.brass; rrect(96, 222, 78, 24, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = C.line; ctx.font = "600 13px 'Public Sans', system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("WARD", 135, 234.5);
      ctx.restore();

      ctx.save(); ctx.translate(0, breathe);
      // hands and props in front of the desk line
      if (state === "reviewing") {
        folder(102, 158, 66, 44);
      }
      if (state === "alert") {
        ctx.save(); ctx.lineWidth = 3;
        seg(R.hand[0] + 2, R.hand[1] - 6, R.hand[0] + 10, R.hand[1] - 28, C.line, 8);
        seg(R.hand[0] + 2, R.hand[1] - 6, R.hand[0] + 10, R.hand[1] - 28, C.pen, 4.5);
        ctx.restore();
      }
      if (state === "approving") {
        ctx.save(); ctx.fillStyle = C.paper; ctx.lineWidth = 2.5;
        rrect(24, 50, 44, 50, 3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "rgba(58,42,31,0.35)"; ctx.lineWidth = 1.5;
        for (var j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(31, 60 + j * 7); ctx.lineTo(60, 60 + j * 7); ctx.stroke(); }
        var pop = Math.min(1, st * 3);
        ctx.strokeStyle = C.check; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(34, 88); ctx.lineTo(34 + 6 * pop, 88 + 5 * pop);
        if (pop > 0.5) ctx.lineTo(34 + 6 + 14 * (pop - 0.5) * 2, 93 - 14 * (pop - 0.5) * 2);
        ctx.stroke();
        ctx.restore();
      }
      hand(L.hand[0], L.hand[1]);
      hand(R.hand[0], R.hand[1]);
      front.forEach(function (f) { f(); });
      ctx.restore();

      if (!reduce) raf = root.requestAnimationFrame(draw);
    }

    function start() { root.cancelAnimationFrame(raf); raf = root.requestAnimationFrame(draw); }
    var api = {
      setState: function (next) {
        var asked = next; next = canon(next);
        if (STATES.indexOf(next) < 0) throw new Error("Unknown Ward state: " + asked + ". Use one of: " + STATES.concat(Object.keys(ALIAS)).join(", "));
        if (next !== state) { state = next; stateStart = performance.now(); }
        start();
      },
      getState: function () { return state; },
      destroy: function () { root.cancelAnimationFrame(raf); }
    };
    if (reduce && root.addEventListener) root.addEventListener("resize", start);
    start();
    return api;
  }

  root.createWard = createWard;
  if (typeof module !== "undefined" && module.exports) module.exports = { createWard: createWard };
})(typeof window !== "undefined" ? window : this);
