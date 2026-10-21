/* quill.js: Quill, Nuer's Legal & Compliance agent, drawn on a <canvas>.
   No dependencies. Plain JavaScript.

   Usage:
     const quill = createQuill(document.getElementById("quill"));
     quill.setState("researching");   // idle | researching | flagging | approved
     quill.getState();
     quill.destroy();                 // stops the animation loop

   Event mapping (from the Legal handoff, B.4):
     legal.received -> "researching"
     legal.search   -> stay "researching"
     legal.blocker  -> "flagging"
     legal.done     -> "approved" (or stay "flagging" if a blocker was raised)
*/
(function (root) {
  "use strict";

  // Character palette. Fixed on purpose: Quill looks the same on light and dark pages.
  var C = {
    line: "#3A2A1F",
    feather: "#8A5A3B",
    featherDark: "#6A432C",
    face: "#F3E3C7",
    belly: "#EAD3AC",
    vest: "#4F6D8C",
    vestDark: "#3C5671",
    brass: "#C9A04A",
    beak: "#D89A3A",
    iris: "#E8B23A",
    pupil: "#1E1612",
    glass: "#2F2A26",
    seal: "#B8322A",
    check: "#2F8A4E",
    pole: "#5B4636",
    paper: "#FBF6EC",
    shadow: "rgba(20, 14, 10, 0.16)"
  };
  var W = 270, H = 260;            // design units; scaled to fit any canvas (owl drawn in a 220-wide box, offset 25)
  var STATES = ["idle", "researching", "flagging", "approved"];
  // Universal Neur states (integration handoff, Part 5) map onto Quill's own poses.
  var ALIAS = { waiting: "idle", working: "researching", done: "approved" };
  function canon(name) { return ALIAS[name] || name; }

  function createQuill(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var state = STATES.indexOf(canon(opts.state)) >= 0 ? canon(opts.state) : "idle";
    var stateStart = performance.now();
    var raf = 0;
    var reduce = !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);

    function resize() {
      var dpr = root.devicePixelRatio || 1;
      var r = canvas.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }

    // ---------- drawing helpers ----------
    function ell(x, y, rx, ry, fill, rot, noStroke) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (!noStroke) ctx.stroke();
    }
    function poly(pts, fill) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.stroke();
    }
    function line(x1, y1, x2, y2, color, width) {
      ctx.save();
      ctx.strokeStyle = color || C.line;
      ctx.lineWidth = width || 3;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    }
    // Wing from a shoulder pivot. a = how far it swings outward (0 = hanging down).
    // side = +1 for Quill's left (viewer's right), -1 for the other wing.
    function wingTip(px, py, a, side, len) {
      return [px + side * Math.sin(a) * len, py + Math.cos(a) * len];
    }
    function wing(px, py, a, side) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-side * a);
      ell(0, 30, 15, 36, C.feather);
      // three feather lines
      ctx.save();
      ctx.strokeStyle = C.featherDark; ctx.lineWidth = 2;
      for (var i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * 6, 44); ctx.lineTo(i * 5, 60); ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }

    // ---------- props ----------
    function magnifier(tx, ty, sweep) {
      var lx = tx - 6, ly = ty - 18;
      line(tx, ty + 4, lx, ly + 12, C.pole, 5);
      ctx.save();
      ctx.lineWidth = 4; ctx.strokeStyle = C.glass;
      ctx.beginPath(); ctx.arc(lx, ly, 14, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(190, 220, 240, 0.45)"; ctx.fill(); ctx.stroke();
      // glint
      ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(lx, ly, 8, Math.PI * 1.1 + sweep * 0.3, Math.PI * 1.45 + sweep * 0.3); ctx.stroke();
      ctx.restore();
    }
    function flag(tx, ty, time) {
      var topY = ty - 74;
      line(tx, ty + 6, tx, topY, C.pole, 4);
      ctx.save();
      ctx.lineWidth = 2.5; ctx.strokeStyle = C.line; ctx.fillStyle = C.seal;
      ctx.beginPath();
      var fw = 46, fh = 28, n = 10;
      ctx.moveTo(tx, topY);
      for (var i = 0; i <= n; i++) {
        var x = tx - (fw * i) / n;
        ctx.lineTo(x, topY + Math.sin(time * 6 + i * 0.7) * 3 * (i / n));
      }
      for (var j = n; j >= 0; j--) {
        var x2 = tx - (fw * j) / n;
        ctx.lineTo(x2, topY + fh + Math.sin(time * 6 + j * 0.7) * 3 * (j / n));
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // "!" mark
      ctx.fillStyle = C.paper;
      ctx.fillRect(tx - 25, topY + 6, 5, 11);
      ctx.beginPath(); ctx.arc(tx - 22.5, topY + 22, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      line(tx, topY - 2, tx, topY - 2, C.brass, 6);
    }
    function paperSheet(showMarks, sealPop) {
      ctx.save();
      ctx.translate(178, 222);
      ctx.rotate(-0.06);
      ctx.lineWidth = 2.5; ctx.strokeStyle = C.line;
      ctx.fillStyle = C.paper;
      ctx.beginPath(); ctx.rect(-26, -18, 52, 34); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "rgba(58,42,31,0.35)"; ctx.lineWidth = 1.5;
      for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-20, -10 + i * 7); ctx.lineTo(4, -10 + i * 7); ctx.stroke(); }
      if (showMarks) {
        // green check
        ctx.strokeStyle = C.check; ctx.lineWidth = 3.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.beginPath(); ctx.moveTo(-19, 8); ctx.lineTo(-13, 13); ctx.lineTo(-3, 1); ctx.stroke();
        // red wax seal
        var r = 9 * sealPop;
        ctx.fillStyle = C.seal; ctx.strokeStyle = C.line; ctx.lineWidth = 2;
        ctx.beginPath();
        for (var k = 0; k < 14; k++) {
          var ang = (k / 14) * Math.PI * 2, rr = r * (k % 2 ? 0.86 : 1);
          ctx.lineTo(13 + Math.cos(ang) * rr, 5 + Math.sin(ang) * rr);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath(); ctx.arc(13, 5, r * 0.45, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    function stamp(tx, ty) {
      line(tx, ty - 2, tx, ty + 20, C.pole, 5);
      ctx.save();
      ctx.lineWidth = 2.5; ctx.strokeStyle = C.line;
      ell(tx, ty - 4, 6, 6, C.seal);
      ctx.fillStyle = C.brass;
      ctx.beginPath(); ctx.rect(tx - 11, ty + 20, 22, 8); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // ---------- the owl ----------
    function draw(now) {
      resize();
      var cw = canvas.width, ch = canvas.height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      var s = Math.min(cw / W, ch / H);
      ctx.setTransform(s, 0, 0, s, (cw - W * s) / 2 + 25 * s, (ch - H * s) / 2);
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.strokeStyle = C.line; ctx.lineWidth = 3;

      var time = reduce ? 0 : now / 1000;
      var st = reduce ? 10 : (now - stateStart) / 1000;
      var bob = reduce ? 0 : Math.sin(time * 2) * 2.5;

      // ground shadow and feet (don't bob)
      ell(110, 240, 58, 8, C.shadow, 0, true);
      ctx.save(); ctx.lineWidth = 2;
      [[92, 232], [128, 232]].forEach(function (f) {
        for (var i = -1; i <= 1; i++) ell(f[0] + i * 6, f[1], 4.5, 6, C.beak);
      });
      ctx.restore();

      if (state === "approved") paperSheet(st > 0.75, Math.min(1, Math.max(0, (st - 0.75) * 5)));

      ctx.save();
      ctx.translate(0, bob);

      // ear tufts (behind head)
      var lift = state === "flagging" ? 9 + Math.sin(time * 9) * 1.5 : state === "researching" ? 3 : 0;
      poly([[68, 50], [58, 16 - lift], [86, 38]], C.featherDark);
      poly([[152, 50], [162, 16 - lift], [134, 38]], C.featherDark);

      // body + vest + belly
      ell(110, 152, 64, 72, C.feather);
      ctx.save();
      ctx.beginPath(); ctx.ellipse(110, 152, 64, 72, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = C.vest; ctx.fillRect(40, 116, 140, 120);
      ctx.restore();
      ell(110, 166, 34, 50, C.belly);
      // belly feather marks
      ctx.save(); ctx.strokeStyle = "rgba(106,67,44,0.5)"; ctx.lineWidth = 2;
      [[100, 150], [118, 156], [104, 172], [120, 180], [108, 194]].forEach(function (p) {
        ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0.2, Math.PI - 0.2); ctx.stroke();
      });
      ctx.restore();
      ell(110, 152, 64, 72, null);           // re-stroke body outline over vest
      ell(62, 150, 4, 4, C.brass);           // buttons
      ell(64, 172, 4, 4, C.brass);
      // vest pocket with a quill pen
      line(154, 162, 164, 128, C.pole, 2.5);
      ell(164, 134, 4, 11, C.paper, 0.3);
      ctx.save(); ctx.fillStyle = C.vestDark;
      ctx.beginPath(); ctx.rect(146, 156, 20, 14); ctx.fill(); ctx.stroke(); ctx.restore();

      // wings and props
      var pivL = [62, 124], pivR = [158, 124];   // viewer's left / right shoulders
      var aL = 0.2, aR = 0.2;
      if (state === "idle") { aL = 0.18 + Math.sin(time * 2) * 0.03; aR = aL; }
      if (state === "researching") aR = 2.15 + Math.sin(st * 2.2) * 0.28;
      if (state === "flagging") aL = 2.45 + Math.sin(time * 6) * 0.05;
      if (state === "approved") {
        var p = (st % 1.6) / 1.6;                       // stamp cycle
        var press = p < 0.45 ? p / 0.45 : p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
        aR = 1.25 - press * 0.75;
      }
      wing(pivL[0], pivL[1], aL, -1);
      wing(pivR[0], pivR[1], aR, 1);

      // head (drawn after wings so raised wings tuck behind it)
      ell(110, 82, 60, 52, C.feather);
      ell(88, 86, 25, 24, C.face);
      ell(132, 86, 25, 24, C.face);

      // eyes
      var lookX = 0, lookY = 0, lid = 0;
      if (state === "researching") { lookX = Math.sin(st * 2.2) * 4.5; lookY = -1; }
      if (state === "flagging") { lookY = -3; lookX = -2; }
      if (state === "approved") lid = 0.38;
      if (state === "idle" && !reduce) {
        var b = time % 3.6;
        if (b < 0.16) lid = 1 - Math.abs(b - 0.08) / 0.08;
      }
      [88, 132].forEach(function (ex) {
        var ey = 86;
        ell(ex, ey, 13, 13, C.iris);
        ctx.save();
        ctx.beginPath(); ctx.arc(ex, ey, 13, 0, Math.PI * 2); ctx.clip();
        ell(ex + lookX, ey + lookY, 6.5, 6.5, C.pupil, 0, true);
        ell(ex + lookX - 2.5, ey + lookY - 3, 2.2, 2.2, "#FFFFFF", 0, true);
        if (lid > 0) { ctx.fillStyle = C.feather; ctx.fillRect(ex - 14, ey - 14, 28, 28 * lid); }
        ctx.restore();
        ctx.save(); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ex, ey, 13, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      });

      // glasses
      ctx.save();
      ctx.strokeStyle = C.glass; ctx.lineWidth = 2.6;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      [88, 132].forEach(function (ex) { ctx.beginPath(); ctx.arc(ex, 86, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(105, 84); ctx.quadraticCurveTo(110, 79, 115, 84); ctx.stroke();
      ctx.restore();

      // brows
      var bw = 3.5, bc = C.featherDark;
      if (state === "flagging") {               // worried: inner ends up
        line(74, 66, 98, 58, bc, bw); line(122, 58, 146, 66, bc, bw);
      } else if (state === "researching") {     // one brow raised, focused
        line(74, 58, 98, 60, bc, bw); line(122, 64, 146, 64, bc, bw);
      } else if (state === "approved") {        // relaxed arcs
        ctx.save(); ctx.strokeStyle = bc; ctx.lineWidth = bw;
        ctx.beginPath(); ctx.arc(86, 70, 13, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.beginPath(); ctx.arc(134, 70, 13, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.restore();
      } else {
        line(76, 63, 98, 63, bc, bw); line(122, 63, 144, 63, bc, bw);
      }

      // beak
      poly([[103, 100], [117, 100], [110, 115]], C.beak);

      // props in the raised wing
      if (state === "researching") {
        var tR = wingTip(pivR[0], pivR[1], aR, 1, 56);
        magnifier(tR[0], tR[1], Math.sin(st * 2.2));
      }
      if (state === "flagging") {
        var tL = wingTip(pivL[0], pivL[1], aL, -1, 56);
        flag(tL[0], tL[1], time);
      }
      if (state === "approved") {
        var tS = wingTip(pivR[0], pivR[1], aR, 1, 58);
        ctx.restore();                     // stamp lives in ground space so it lands on the paper
        stamp(tS[0], tS[1] + bob);
        ctx.save();
      }
      ctx.restore();

      if (!reduce) raf = root.requestAnimationFrame(draw);
    }

    function start() {
      root.cancelAnimationFrame(raf);
      raf = root.requestAnimationFrame(draw);
    }

    var api = {
      setState: function (next) {
        var asked = next; next = canon(next);
        if (STATES.indexOf(next) < 0) throw new Error("Unknown Quill state: " + asked + ". Use one of: " + STATES.concat(Object.keys(ALIAS)).join(", "));
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

  root.createQuill = createQuill;
  if (typeof module !== "undefined" && module.exports) module.exports = { createQuill: createQuill };
})(typeof window !== "undefined" ? window : this);
