// Vitrine site motion. No libraries: WebGL warp hero, IntersectionObserver
// reveals, one rAF loop for every scroll-linked scene.
(() => {
  "use strict";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const expo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const smooth = t => t * t * (3 - 2 * t);
  const C = { paper: "#E9EAEC", ink: "#17191C", line: "#C7CACF", muted: "#5F646B", accent: "#44566A", field: "#DCDFE3" };

  /* ---------- word split ---------- */
  document.querySelectorAll("[data-split]").forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.textContent = "";
    words.forEach((w, i) => {
      const o = document.createElement("span"); o.className = "w"; o.setAttribute("aria-hidden", "true");
      const s = document.createElement("span"); s.textContent = w; s.style.setProperty("--i", Math.min(i, 60));
      o.appendChild(s); el.appendChild(o); el.appendChild(document.createTextNode(" "));
    });
  });
  document.querySelectorAll(".ledger li").forEach((li, i) => li.style.setProperty("--i", i));

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -12% 0px" });
  document.querySelectorAll("[data-split], [data-wipe], .ledger").forEach(el => io.observe(el));

  /* ---------- 00 hero: warp grid ---------- */
  const stage = document.getElementById("stage");
  const glc = document.getElementById("warpGL");
  const svg = document.getElementById("warpUI");
  const readout = document.getElementById("readout");
  const COLS = 5, ROWS = 3, SU = 56, SV = 28;
  const MX = 0.035, MY = 0.07;
  const flat = (i, j) => [MX + (1 - 2 * MX) * i / (COLS - 1), MY + (1 - 2 * MY) * j / (ROWS - 1)];
  // Keystoned start: a projector pointed up and off axis, before alignment.
  const skewed = (i, j) => {
    const [x, y] = flat(i, j);
    const k = 0.74 + 0.26 * y;
    return [0.5 + (x - 0.5) * k + 0.05 * (1 - y), y * 0.84 + 0.1 - 0.06 * x + 0.025 * Math.sin(x * Math.PI)];
  };
  let pts = [], W = 1, H = 1, sel = -1, dirty = true;
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) pts.push(reduced ? flat(i, j) : skewed(i, j));
  const P = (i, j) => pts[j * COLS + i];

  const cr = (a, b, c, d, t) => {
    const t2 = t * t, t3 = t2 * t;
    return 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
  };
  const crv = (arr, s) => {
    const n = arr.length, x = s * (n - 1), k = Math.min(Math.floor(x), n - 2), t = x - k;
    const g = q => q < 0 ? [2 * arr[0][0] - arr[1][0], 2 * arr[0][1] - arr[1][1]]
      : q >= n ? [2 * arr[n - 1][0] - arr[n - 2][0], 2 * arr[n - 1][1] - arr[n - 2][1]] : arr[q];
    const a = g(k - 1), b = g(k), c = g(k + 1), d = g(k + 2);
    return [cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t)];
  };
  const surf = (u, v) => {
    const col = [];
    for (let j = 0; j < ROWS; j++) { const row = []; for (let i = 0; i < COLS; i++) row.push(P(i, j)); col.push(crv(row, u)); }
    return crv(col, v);
  };

  // Texture: the wordmark as a projected test card.
  const tex = document.createElement("canvas");
  function drawTexture() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const tw = Math.round(W * (1 - 2 * MX) * dpr), th = Math.round(H * (1 - 2 * MY) * dpr);
    tex.width = tw; tex.height = th;
    const g = tex.getContext("2d");
    g.fillStyle = "#F6F7F8"; g.fillRect(0, 0, tw, th);
    g.strokeStyle = C.line; g.lineWidth = dpr;
    const step = tw / 16;
    for (let x = step; x < tw; x += step) { g.beginPath(); g.moveTo(Math.round(x) + 0.5, 0); g.lineTo(Math.round(x) + 0.5, th); g.stroke(); }
    for (let y = step; y < th; y += step) { g.beginPath(); g.moveTo(0, Math.round(y) + 0.5); g.lineTo(tw, Math.round(y) + 0.5); g.stroke(); }
    g.strokeStyle = C.accent; g.lineWidth = 1.5 * dpr; g.strokeRect(dpr, dpr, tw - 2 * dpr, th - 2 * dpr);
    // centre cross
    g.beginPath(); g.moveTo(tw / 2 - 18 * dpr, th / 2); g.lineTo(tw / 2 + 18 * dpr, th / 2); g.moveTo(tw / 2, th / 2 - 18 * dpr); g.lineTo(tw / 2, th / 2 + 18 * dpr); g.stroke();
    // wordmark, cropped by the bottom edge
    let fs = th * 0.92;
    g.font = `700 ${fs}px "Plex Sans"`;
    if ("letterSpacing" in g) g.letterSpacing = `${-0.065 * fs}px`;
    const mw = g.measureText("Vitrine").width;
    if (mw > tw * 0.96) { fs *= tw * 0.96 / mw; g.font = `700 ${fs}px "Plex Sans"`; if ("letterSpacing" in g) g.letterSpacing = `${-0.065 * fs}px`; }
    g.fillStyle = C.ink; g.textBaseline = "alphabetic"; g.textAlign = "left";
    const w2 = g.measureText("Vitrine").width;
    g.fillText("Vitrine", (tw - w2) / 2 - 0.02 * fs, th + fs * 0.1);
    // labels
    g.font = `500 ${12 * dpr}px "Plex Mono"`; if ("letterSpacing" in g) g.letterSpacing = `${0.06 * 12 * dpr}px`;
    g.fillStyle = C.accent;
    const narrow = tw / dpr < 640;
    g.fillText(narrow ? "OUTPUT 1 · 1920 × 1080" : "OUTPUT 1 · SLICE A · 1920 × 1080", 14 * dpr, 24 * dpr);
    if (!narrow) {
      g.textAlign = "right"; g.fillStyle = C.muted;
      g.fillText("BLEND L 240 · R 240 · γ 2.20", tw - 14 * dpr, 24 * dpr);
    }
    upload();
  }

  let gl = null, prog, buf, ibuf, nIdx = 0, verts, glTex;
  try { gl = glc.getContext("webgl", { antialias: true, alpha: false, premultipliedAlpha: false }); } catch (e) { gl = null; }
  const ctx2d = gl ? null : glc.getContext("2d");
  if (gl) {
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;attribute vec2 uv;uniform vec2 r;varying vec2 v;void main(){v=uv;vec2 c=p/r*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);}"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, "precision mediump float;varying vec2 v;uniform sampler2D t;void main(){gl_FragColor=texture2D(t,v);}"));
    gl.linkProgram(prog); gl.useProgram(prog);
    buf = gl.createBuffer(); ibuf = gl.createBuffer();
    verts = new Float32Array((SU + 1) * (SV + 1) * 4);
    const idx = [];
    for (let y = 0; y < SV; y++) for (let x = 0; x < SU; x++) {
      const a = y * (SU + 1) + x, b = a + 1, c = a + SU + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    nIdx = idx.length;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, verts.byteLength, gl.DYNAMIC_DRAW);
    const lp = gl.getAttribLocation(prog, "p"), lu = gl.getAttribLocation(prog, "uv");
    gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(lu); gl.vertexAttribPointer(lu, 2, gl.FLOAT, false, 16, 8);
    glTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, glTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function upload() {
    if (gl) { gl.bindTexture(gl.TEXTURE_2D, glTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex); }
    dirty = true;
  }

  // SVG overlay: grid curves and handles.
  const NS = "http://www.w3.org/2000/svg";
  const mk = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const lines = mk("g", {}, svg);
  const curves = [];
  for (let j = 0; j <= (ROWS - 1) * 2; j++) curves.push({ v: j / ((ROWS - 1) * 2), el: mk("path", { class: j % 2 ? "gl minor" : "gl" }, lines) });
  for (let i = 0; i <= (COLS - 1) * 2; i++) curves.push({ u: i / ((COLS - 1) * 2), el: mk("path", { class: i % 2 ? "gl minor" : "gl" }, lines) });
  const handles = pts.map((_, k) => {
    const i = k % COLS, j = Math.floor(k / COLS);
    const g = mk("g", { class: "h", tabindex: "0", role: "button", "aria-label": `Point column ${i + 1}, row ${j + 1}` }, svg);
    mk("circle", { class: "hit", r: 22 }, g);
    mk("path", { class: "cx", d: "M-16 0H-9M9 0H16M0 -16V-9M0 9V16" }, g);
    mk("circle", { class: "dot", r: 6 }, g);
    return g;
  });

  function render() {
    if (!dirty) return; dirty = false;
    // mesh
    if (gl) {
      let o = 0;
      for (let y = 0; y <= SV; y++) for (let x = 0; x <= SU; x++) {
        const u = x / SU, v = y / SV, q = surf(u, v);
        verts[o++] = q[0] * W; verts[o++] = q[1] * H; verts[o++] = u; verts[o++] = v;
      }
      gl.viewport(0, 0, glc.width, glc.height);
      gl.clearColor(0.914, 0.918, 0.925, 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.uniform2f(gl.getUniformLocation(prog, "r"), W, H);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, verts);
      gl.bindTexture(gl.TEXTURE_2D, glTex);
      gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_SHORT, 0);
    } else if (ctx2d) {
      const dpr = glc.width / W;
      ctx2d.setTransform(1, 0, 0, 1, 0, 0); ctx2d.fillStyle = C.paper; ctx2d.fillRect(0, 0, glc.width, glc.height);
      ctx2d.drawImage(tex, MX * W * dpr, MY * H * dpr, (1 - 2 * MX) * W * dpr, (1 - 2 * MY) * H * dpr);
    }
    // overlay
    for (const c of curves) {
      let d = "";
      for (let s = 0; s <= 48; s++) {
        const t = s / 48, q = c.v !== undefined ? surf(t, c.v) : surf(c.u, t);
        d += (s ? "L" : "M") + (q[0] * W).toFixed(1) + " " + (q[1] * H).toFixed(1);
      }
      c.el.setAttribute("d", d);
    }
    handles.forEach((h, k) => h.setAttribute("transform", `translate(${(pts[k][0] * W).toFixed(1)} ${(pts[k][1] * H).toFixed(1)})`));
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    glc.width = Math.round(W * dpr); glc.height = Math.round(H * dpr);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    drawTexture();
  }

  function say(k) {
    if (k < 0) return;
    const i = k % COLS, j = Math.floor(k / COLS), f = flat(i, j);
    const dx = Math.round((pts[k][0] - f[0]) * W), dy = Math.round((pts[k][1] - f[1]) * H);
    readout.textContent = `P ${i + 1},${j + 1} · Δx ${dx >= 0 ? "+" : ""}${dx} · Δy ${dy >= 0 ? "+" : ""}${dy} px`;
  }
  function select(k) {
    sel = k; handles.forEach((h, n) => h.classList.toggle("sel", n === k)); say(k);
  }

  // tweening the whole grid (intro and reset)
  let tween = null;
  function animateTo(target, dur, stagger, done) {
    const from = pts.map(p => p.slice()), t0 = performance.now();
    tween = now => {
      let all = true;
      pts = from.map((p, k) => {
        const i = k % COLS, j = Math.floor(k / COLS);
        const t = clamp((now - t0 - (i * stagger + j * stagger * 0.6)) / dur);
        if (t < 1) all = false;
        const e = expo(t);
        return [p[0] + (target[k][0] - p[0]) * e, p[1] + (target[k][1] - p[1]) * e];
      });
      dirty = true;
      if (all) { tween = null; if (done) done(); }
    };
  }
  const flatAll = () => pts.map((_, k) => flat(k % COLS, Math.floor(k / COLS)));

  // drag
  let drag = null;
  handles.forEach((h, k) => {
    h.addEventListener("pointerdown", e => {
      e.preventDefault(); tween = null; select(k); h.focus({ preventScroll: true });
      const r = stage.getBoundingClientRect();
      drag = { k, ox: e.clientX - pts[k][0] * W - r.left, oy: e.clientY - pts[k][1] * H - r.top };
      h.classList.add("drag"); h.setPointerCapture(e.pointerId);
    });
    h.addEventListener("pointermove", e => {
      if (!drag || drag.k !== k) return;
      const r = stage.getBoundingClientRect();
      pts[k] = [clamp((e.clientX - r.left - drag.ox) / W, -0.05, 1.05), clamp((e.clientY - r.top - drag.oy) / H, -0.05, 1.05)];
      dirty = true; say(k);
    });
    const end = () => { drag = null; h.classList.remove("drag"); };
    h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end);
    h.addEventListener("focus", () => select(k));
    h.addEventListener("keydown", e => {
      const step = e.shiftKey ? 10 : 1;
      const m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!m) return;
      e.preventDefault(); tween = null;
      pts[k] = [pts[k][0] + m[0] / W, pts[k][1] + m[1] / H]; dirty = true; say(k);
    });
  });
  const reset = () => { select(-1); readout.textContent = "Reset · grid 5 × 3 · Catmull-Rom"; if (reduced) { pts = flatAll(); dirty = true; } else animateTo(flatAll(), 1100, 40); };
  document.getElementById("warpReset").addEventListener("click", reset);
  stage.addEventListener("dblclick", e => { if (!e.target.closest(".h")) reset(); });

  /* ---------- scroll scenes ---------- */
  const vh = () => window.innerHeight;
  const header = document.querySelector(".top");
  const navLinks = [...document.querySelectorAll(".nav a")];
  const sections = navLinks.map(a => document.querySelector(a.getAttribute("href")));

  const blend = document.getElementById("blend");
  const steps = [...blend.querySelectorAll(".steps li")];
  const map = document.getElementById("map");
  const tilt = document.querySelector(".tilt");
  const ticker = document.querySelector(".ticker");
  const tickRow = ticker.querySelector(".ticker-row");
  const gallery = document.getElementById("gallery");
  const strip = document.getElementById("strip");
  const galCount = document.getElementById("galCount");
  const figs = [...strip.children];
  const galTotal = document.getElementById("galTotal");
  if (galTotal) galTotal.textContent = String(figs.length).padStart(2, "0");
  let galPinned = false, galTravel = 0, galOn = -1;
  const dock = document.getElementById("dock"), galCap = document.getElementById("galCap");
  const dockBtns = figs.map((f, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = f.querySelector("figcaption b").textContent;
    b.addEventListener("click", () => {
      if (!galPinned) return;
      const top = gallery.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + (i + 0.5) / figs.length * galTravel, behavior: reduced ? "auto" : "smooth" });
    });
    dock.appendChild(b); return b;
  });
  function setPage(n) {
    if (n === galOn) return;
    galOn = n;
    galCount.textContent = String(n + 1).padStart(2, "0");
    figs.forEach((f, i) => { f.classList.toggle("on", i === n); f.classList.toggle("past", i < n); });
    dockBtns.forEach((b, i) => b.classList.toggle("on", i === n));
    const cap = figs[n].querySelector("figcaption");
    galCap.textContent = cap ? cap.textContent.replace(cap.querySelector("b").textContent, "").trim() : "";
  }
  setPage(0);

  // Projective map from the element's rectangle to a quad: a real corner pin.
  function cornerPin(el, q) {
    const w = el.offsetWidth, h = el.offsetHeight;
    const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
    const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
    const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    const den = dx1 * dy2 - dx2 * dy1 || 1e-9;
    const g = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den;
    const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, c = x0;
    const d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3, f = y0;
    el.style.transform = `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${c},${f},0,1)`;
  }

  function layout() {
    galPinned = !reduced && innerWidth > 760 && matchMedia("(pointer: fine)").matches;
    gallery.classList.toggle("static", !galPinned);
    if (galPinned) {
      galTravel = figs.length * 0.5 * vh();
      gallery.style.height = `${vh() + galTravel}px`;
    } else gallery.style.height = "";
    ticker.style.setProperty("--tw", Math.max(0, tickRow.scrollWidth - ticker.clientWidth));
  }

  function scenes() {
    const h = vh();
    header.classList.toggle("scrolled", scrollY > 8);

    // nav state
    let cur = -1;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < h * 0.4) cur = i; });
    navLinks.forEach((a, i) => a.classList.toggle("on", i === cur));

    if (reduced) return;

    // 01 blend: open, align, overlap, ramp, lift
    {
      const r = blend.getBoundingClientRect();
      const p = clamp(-r.top / (r.height - h));
      const open = expo(seg(p, 0, 0.1) * 1.0), al = smooth(seg(p, 0.08, 0.3)), ov = smooth(seg(p, 0.3, 0.48));
      const rp = smooth(seg(p, 0.5, 0.7)), lf = smooth(seg(p, 0.74, 0.9));
      const st = blend.style;
      st.setProperty("--p", p.toFixed(4)); st.setProperty("--open", open.toFixed(4));
      st.setProperty("--al", al.toFixed(4)); st.setProperty("--ov", ov.toFixed(4));
      st.setProperty("--rp", rp.toFixed(4)); st.setProperty("--lf", lf.toFixed(4));
      const act = p < 0.3 ? 0 : p < 0.5 ? 1 : p < 0.73 ? 2 : 3;
      steps.forEach((li, i) => { li.classList.toggle("on", i === act); li.classList.toggle("done", i < act); });
    }

    {
      const r = map.getBoundingClientRect();
      map.style.setProperty("--k", smooth(clamp((h - r.top) / (h * 0.9))).toFixed(4));
    }

    // 03 trigger: tilt and ticker
    {
      const r = tilt.getBoundingClientRect();
      tilt.style.setProperty("--k", smooth(clamp((h - r.top) / (h * 0.8))).toFixed(4));
      const t = ticker.getBoundingClientRect();
      ticker.style.setProperty("--k", clamp((h - t.top) / (h + t.height)).toFixed(4));
    }

    // 05 gallery: vertical scroll drives horizontal travel
    if (galPinned) {
      const r = gallery.getBoundingClientRect();
      const p = clamp(-r.top / Math.max(1, r.height - h));
      setPage(Math.min(figs.length - 1, Math.floor(p * figs.length)));
    }
  }

  let ticking = false;
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; scenes(); }); } };
  addEventListener("scroll", onScroll, { passive: true });
  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { resize(); layout(); scenes(); }, 120); });

  if (reduced) {
    const st = blend.style;
    ["--p", "--open", "--al", "--ov", "--rp", "--lf"].forEach(v => st.setProperty(v, v === "--p" ? 0 : 1));
    steps.forEach((li, i) => li.classList.toggle("on", i === 3));
    map.style.setProperty("--k", 1);
  }

  /* endure: reveal on enter */
  { const en = document.getElementById("endure");
    if (en) { document.querySelectorAll("#endure .ledger li").forEach((li, i) => li.style.setProperty("--i", i));
      new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { en.classList.add("is-in"); o.disconnect(); } }), { threshold: 0.12 }).observe(en); } }

  /* ---------- 03 rule cycling ---------- */
  const rules = [
    ["osc /room2/visitor", "cue is Idle loop", "go Story · fade 2.0 s"],
    ["schedule daily 09:55", "day is not Monday", "PJLink power on, projectors 1 to 4"],
    ["button 3 · debounce 500 ms", "var lang = hi", "go Story (Hindi)"],
    ["cue ended: Story", "time 10:00 to 18:00", "visitors += 1 · go Idle loop"],
    ["art-net universe 0 ch 12 > 127", "not blacked out", "blackout · fade 1.5 s"],
  ];
  const slots = ["when", "if", "then"].map(n => document.querySelector(`[data-cycle="${n}"]`));
  let ri = 0;
  function showRule() {
    rules[ri].forEach((txt, n) => {
      const s = slots[n]; s.classList.remove("out");
      s.innerHTML = ""; const sp = document.createElement("span"); sp.textContent = txt;
      sp.style.setProperty("--d", `${n * 260}ms`); s.appendChild(sp);
    });
  }
  showRule();
  if (!reduced) {
    let visible = false;
    new IntersectionObserver(es => es.forEach(e => (visible = e.isIntersecting))).observe(document.querySelector(".rule"));
    setInterval(() => {
      if (!visible || document.hidden) return;
      slots.forEach(s => s.classList.add("out"));
      setTimeout(() => { ri = (ri + 1) % rules.length; showRule(); }, 520);
    }, 3800);
  }

  /* ---------- boot ---------- */
  function loop(now) { if (tween) tween(now); render(); requestAnimationFrame(loop); }
  const fontsReady = document.fonts ? Promise.all([
    document.fonts.load('700 100px "Plex Sans"'), document.fonts.load('500 12px "Plex Mono"'),
  ]).catch(() => {}) : Promise.resolve();
  fontsReady.then(() => {
    resize(); layout(); scenes();
    requestAnimationFrame(loop);
    if (!reduced) {
      readout.textContent = "Aligning · grid 5 × 3 · Catmull-Rom";
      setTimeout(() => animateTo(flatAll(), 1800, 90, () => { if (sel < 0) readout.textContent = "Aligned · grid 5 × 3 · Catmull-Rom"; }), 450);
    }
  });
  addEventListener("load", () => { layout(); scenes(); });
})();
