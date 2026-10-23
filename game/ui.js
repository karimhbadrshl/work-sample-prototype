/* Page: scene, tools, AI mentor, guide, notebook, guided practice, adaptive items and results. Uses window.Engine. */
(function () {
  'use strict';
  const E = window.Engine;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SHORT = { F: 'Fuse', PSU: 'Power supply', SW: 'Pump switch', LS: 'Level switch', K: 'Contactor', M: 'Pump motor' };
  const MODE_TEXT = { open: 'open circuit', low: 'output sagging to 17 V', seized: 'seized rotor' };
  const TIER_NAME = { medium: 'Item 1', hard: 'Item 2 (harder)', easy: 'Item 2 (easier)' };
  const BRICK = '<svg width="34" height="22" viewBox="0 0 34 22" aria-hidden="true"><g fill="#B07A0C"><rect x="0" y="5" width="34" height="17" rx="2"/><rect x="5" y="0" width="8" height="6" rx="1"/><rect x="21" y="0" width="8" height="6" rx="1"/></g></svg>';
  const STUDS = '<svg width="130" height="8" viewBox="0 0 130 8" aria-hidden="true">' + Array.from({ length: 11 }, (_, i) => `<circle cx="${4 + 12 * i}" cy="4" r="3" fill="#D9D4C7"/>`).join('') + '</svg>';
  const POS = { F: [35, 100], PSU: [145, 100], SW: [255, 100], LS: [365, 100], K: [475, 100], M: [650, 150, 110, 80] };
  const randSeed = () => Math.floor(Math.random() * 1e9);

  let tut = null, S = null, form = null, tool = 'hand', pendingSwap = null, trace = [], selected = null, awayAt = null, run = null, tankTimer = null;

  const part = (id) => {
    const [x, y, w = 96, h = 80] = POS[id];
    return `<g class="part" data-id="${id}" role="button" tabindex="0"><rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
      <text class="tg" x="${x + 8}" y="${y + 20}" data-tag="${id}"></text><text class="nm" x="${x + 8}" y="${y + 34}">${SHORT[id]}</text>
      <text class="st" x="${x + 8}" y="${y + h - 8}" data-st="${id}"></text>${decor(id, x, y, w)}</g>`;
  };
  function decor(id, x, y, w) {
    const cx = x + w / 2;
    if (id === 'SW') return `<line data-lever="SW" x1="${cx}" y1="${y + 56}" x2="${cx}" y2="${y + 40}" stroke="#22252B" stroke-width="5" stroke-linecap="round"/><circle cx="${cx}" cy="${y + 56}" r="5" fill="#22252B"/>`;
    if (id === 'M') { const fx = x + w - 24; return `<g class="spin"><circle cx="${fx}" cy="${y + 52}" r="13" fill="none" stroke="#22252B" stroke-width="2"/><path d="M${fx} ${y + 39} V${y + 65} M${fx - 13} ${y + 52} H${fx + 13}" stroke="#22252B" stroke-width="3"/></g>`; }
    return '';
  }

  function sceneSvg() {
    return `<svg viewBox="0 40 900 290" role="group" aria-label="Pump 3: control cabinet, pump and tank">
      <rect class="zone" x="15" y="55" width="570" height="140" rx="10"/><text class="zt" x="28" y="75">CONTROL CABINET · 230 V MAINS IN AT LEFT</text>
      <rect class="zone" x="610" y="55" width="275" height="260" rx="10"/><text class="zt" x="622" y="75">PUMP AND TANK</text>
      <path class="wire" d="M15 140H35M131 140H145M241 140H255M351 140H365M461 140H475M571 140H600V190H650"/>
      <g><circle class="lamp lamp-off" data-lamp="H1" cx="280" cy="90" r="9"/><text class="st" x="294" y="94" data-lamptxt="H1"></text></g>
      ${['F', 'PSU', 'SW', 'LS', 'K'].map(part).join('')}
      <g id="g-pump">${part('M')}
        <rect x="795" y="110" width="80" height="170" rx="4" fill="#FBFAF6" stroke="#B9B2A2" stroke-width="2"/>
        <rect id="water" class="water" x="797" y="120" width="76" height="158" fill="#2F5DA8" opacity=".3"/><path class="flow" d="M760 190H795"/>
        <text class="st" x="800" y="302" id="tanktxt">TANK EMPTY</text></g>
    </svg>`;
  }

  function mount() {
    $('#app').innerHTML = `<div class="wrap">
      <div class="top"><div><div class="kicker">${BRICK}<span>Field service · fault-finding · prototype</span></div><h1>Pump 3 will not fill the tank. Find the fault.</h1>
        <div class="muted">Switch the pump on, test, ask the mentor, then name the failed part. When the right part is found the pump fills the tank.</div></div>
        <div class="hud"><span class="chip" id="itemChip"></span><span class="chip">Test cost <b id="cost">0</b></span><button class="btn" id="newForm">Start again</button></div></div>
      <div id="coach" class="coach" role="region" aria-label="Guided practice" hidden></div>
      <div class="grid"><div>
        <div class="card scene" id="scene">${sceneSvg()}</div>
        <div class="tools" role="group" aria-label="Tools">
          <button class="tool" data-tool="hand" aria-pressed="true">Hand<small>operate the switch · cost 0</small></button>
          <button class="tool" data-tool="V" aria-pressed="false">Voltmeter<small>read a part's output · cost 1</small></button>
          <button class="tool" data-tool="SWAP" aria-pressed="false">Spare part<small>swap and see · cost 3</small></button>
          <div class="readout" aria-live="polite"><div class="sub">METER</div><div class="big" id="ro">no reading</div><div class="sub" id="ros">Pick the voltmeter, then click a part.</div></div></div>
        <div class="status" id="status" aria-live="polite"></div>
      </div><div class="card"><div class="tabs" role="tablist">
        <button class="tab" role="tab" data-tab="mentor" aria-selected="true">AI mentor</button><button class="tab" role="tab" data-tab="guide" aria-selected="false">Reference guide</button><button class="tab" role="tab" data-tab="nb" aria-selected="false">Notebook</button></div>
        <div class="pane" id="p-mentor"></div><div class="pane" id="p-guide" hidden></div><div class="pane" id="p-nb" hidden></div>
        <div class="askrow" id="askrow"><input id="q" type="text" maxlength="200" placeholder="Ask about a part, the meter or method" aria-label="Ask the AI mentor"><button class="btn" id="ask">Ask</button></div>
        <div class="dx"><h2>Your diagnosis</h2><label for="dxsel">Failed part</label><select id="dxsel"></select>
          <label for="why">Why? One line, optional</label><input type="text" id="why" maxlength="200">
          <p><button class="btn primary" id="submit">Submit diagnosis</button> <span class="muted" id="confirmNote"></span></p></div></div></div>
      <div class="studs">${STUDS}<div class="muted" style="font-size:12px;margin-top:4px">Prototype. Synthetic pump line, no real candidate data. The AI mentor runs as a rules-based mock in this demo.</div></div></div>`;
    $('#dxsel').innerHTML = '<option value="">Choose a part…</option>' + E.FAULTABLE.map((id) => `<option value="${id}">${esc(E.label(form, id))}</option>`).join('');
    $('#p-guide').innerHTML = E.guide(form.tags).map((g) => `<details class="g"><summary>${esc(g.title)}</summary><p>${esc(g.text)}</p></details>`).join('');
    $('#p-mentor').innerHTML = '<div class="msg ai"><span class="who">AI mentor</span>I can explain parts, the meter, the lamp and method, and tell you what a healthy part reads. I will not name the fault or confirm a guess.</div>';
    $('#itemChip').innerHTML = tut ? 'Practice' : `${esc(TIER_NAME[form.tier] || 'Item')}`;
    bind();
    paint();
  }

  function bind() {
    $('#scene').addEventListener('click', (e) => { const p = e.target.closest('.part'); if (p) act(p.dataset.id); });
    $('#scene').addEventListener('keydown', (e) => { const p = e.target.closest('.part'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); act(p.dataset.id); } });
    document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === b)));
      ['mentor', 'guide', 'nb'].forEach((n) => { $('#p-' + n).hidden = n !== b.dataset.tab; });
      $('#askrow').hidden = b.dataset.tab !== 'mentor';
    }));
    $('#ask').addEventListener('click', ask);
    $('#q').addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });
    ['#q', '#why'].forEach((s) => $(s).addEventListener('paste', () => S.event('paste', { field: s })));
    $('#submit').addEventListener('click', submitFlow);
    $('#newForm').addEventListener('click', () => { document.querySelectorAll('.overlay').forEach((o) => o.remove()); startRun(); });
  }
  document.addEventListener('copy', () => S && !S.done && S.event('copy'));
  document.addEventListener('visibilitychange', () => {
    if (!S || S.done) return;
    if (document.hidden) { awayAt = Date.now(); S.event('blur'); } else { S.event('focus', { awayFor: awayAt ? Math.round((Date.now() - awayAt) / 1000) : 0 }); awayAt = null; }
  });

  function setTool(t) {
    if (tut) tut.pin = null;
    tool = t; pendingSwap = null;
    document.querySelectorAll('.tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
    say({ hand: 'Hand: click the pump switch to operate it.', V: 'Voltmeter: click a part to read its output. Cost 1.', SWAP: 'Spare part: click a part to swap it. Cost 3.' }[t]);
    coach();
  }
  const say = (m) => { $('#status').textContent = m; };
  const L = (id) => E.label(form, id);
  const fmtObs = (o) => `H1 ${o.H1}, pump motor ${o.M}`;

  function act(id) {
    if (S.done) return;
    if (tut) tut.pin = null;
    selected = id;
    if (tool === 'hand') {
      if (id !== 'SW') { say(`${L(id)}: use the voltmeter or a spare to test this part.`); return paint(); }
      S.setSwitch('SW', !S.state.SW);
      const word = S.state.SW ? 'ON' : 'OFF';
      say(`${L(id)} ${word}. Now: ${fmtObs(S.observation())}.`); track(`${form.tags.SW} ${word}`); return paint();
    }
    if (tool === 'SWAP') {
      if (!E.FAULTABLE.includes(id)) { say(`${L(id)}: no spare held for this.`); return paint(); }
      if (pendingSwap !== id) { pendingSwap = id; say(`Swap ${L(id)}? Click it again to confirm (cost 3).`); return paint(); }
      pendingSwap = null;
    }
    const r = S.test({ type: tool, node: id });
    let txt;
    if (tool === 'V') { const v = Number(r.result).toFixed(1); txt = `${v} V ${id === 'F' ? 'AC' : 'DC'}`; ro(txt, `Voltmeter · ${L(id)} output`); }
    else { txt = r.result === 'fixed' ? 'the pump runs: this part was the cause' : 'no change: original part refitted'; ro(r.result === 'fixed' ? 'FIXED' : 'NO CHANGE', `Spare · ${L(id)}`); }
    say(`${L(id)}: ${txt}.${r.redundant ? ' This did not tell you anything new.' : ''}`);
    track(`${tool === 'V' ? 'Voltmeter' : 'Spare'} at ${form.tags[id]}: ${txt}`);
    paint();
  }
  const ro = (big, sub) => { $('#ro').textContent = big; $('#ros').textContent = sub; };
  function track(label) {
    trace.push({ label, n: new Set(S.hypotheses().map((h) => h.id)).size });
    $('#p-nb').insertAdjacentHTML('beforeend', `<p class="nb"><span class="n">${String(trace.length).padStart(2, '0')}</span> ${esc(label)}</p>`);
  }

  function ask() {
    const q = $('#q').value.trim(); if (!q || S.done) return;
    if (tut) tut.pin = null;
    const r = S.ask(q); $('#q').value = '';
    $('#p-mentor').insertAdjacentHTML('beforeend', `<div class="msg you"><span class="who">You</span>${esc(q)}</div><div class="msg ai"><span class="who">AI mentor</span>${esc(r.text)}</div>`);
    $('#p-mentor').scrollTop = 1e6;
    $('#p-nb').insertAdjacentHTML('beforeend', `<p class="nb"><span class="n">--</span> Asked mentor: ${esc(q)}</p>`);
    coach();
  }

  function paint() {
    const st = S.state, o = S.observation();
    document.querySelectorAll('.part').forEach((p) => p.classList.toggle('sel', p.dataset.id === selected));
    Object.keys(POS).forEach((id) => {
      const t = $(`[data-tag="${id}"]`), s = $(`[data-st="${id}"]`), p = $(`.part[data-id="${id}"]`);
      t.textContent = form.tags[id];
      const w = id === 'SW' ? (st.SW ? 'ON' : 'OFF') : id === 'M' ? o.M.toUpperCase() : '';
      s.textContent = w;
      p.setAttribute('aria-label', `${L(id)}${w ? ', ' + w.toLowerCase() : ''}`);
    });
    const l = $('[data-lever="SW"]'), cx = 255 + 48;
    l.setAttribute('x2', st.SW ? cx : cx - 14); l.setAttribute('y2', st.SW ? 140 : 144);
    $('[data-lamp="H1"]').setAttribute('class', `lamp lamp-${o.H1}`); $('[data-lamptxt="H1"]').textContent = `H1 ${o.H1.toUpperCase()}`;
    const running = o.M === 'running';
    $('#g-pump').setAttribute('class', running ? 'running' : o.M === 'jammed' ? 'humming' : '');
    clearTimeout(tankTimer);
    $('#tanktxt').textContent = running ? 'FILLING…' : 'TANK EMPTY';
    if (running) tankTimer = setTimeout(() => { const t = $('#tanktxt'); if (t) t.textContent = 'TANK FULL'; }, 6500);
    $('#cost').textContent = S.cost;
    coach();
  }

  // ---- Guided practice: a short walkthrough on a fixed practice fault (contactor open). Not recorded.
  const steps = () => {
    const T = form.tags, tested = (n) => S.tests.some((t) => t.test.type === 'V' && t.test.node === n);
    return [
      { h: 'Switch the pump on', t: `Hello, and thanks for trying this. The tank is not filling, so the pump is not doing its job. Start by switching it on: with the Hand tool selected, click the pump switch (${T.SW}). Switching costs nothing.`, hl: '.part[data-id="SW"]', done: () => S.state.SW },
      { h: 'Read the lamp and the motor', t: `Look at the scene. Lamp H1 is lit, so the power supply is working. The pump motor is stopped and the tank is empty. The lamp and the motor's movement are free clues. When you are ready, pick the Voltmeter below the scene.`, hl: '[data-tool="V"]', done: () => tool === 'V' },
      { h: 'Test part-way along the line', t: `Power flows left to right: fuse, power supply, switch, level switch, contactor, motor. With the Voltmeter, click the level switch (${T.LS}) to read its output. Each reading costs 1; your running cost is at the top right. Good diagnosticians choose tests that rule out as much as possible.`, hl: '.part[data-id="LS"]', done: () => tested('LS') },
      { h: 'Narrow it down', t: `24 V: power gets as far as ${T.LS}. That leaves the contactor ${T.K} and the motor ${T.M}. Read the contactor ${T.K} next.`, hl: '.part[data-id="K"]', done: () => tested('K') },
      { h: 'Meet the AI mentor', t: `0 V at ${T.K}, with 24 V going in. Before you decide, try the mentor in the right-hand panel. Ask what a healthy contactor needs, or ask "Which part is faulty?" to see what it will and will not do. The Reference guide tab holds the same specs.`, hl: '#q', done: () => S.log.some((e) => e.kind === 'mentor') },
      { h: 'Name the failed part', t: `Power goes in to ${T.K} but nothing comes out, so the contactor is not passing it on. Choose it in the Failed part list, then press Submit diagnosis twice (the second press confirms).`, hl: '#dxsel', done: () => !!S.done },
    ];
  };
  function coach() {
    const el = $('#coach'); if (!el) return;
    document.querySelectorAll('.hl').forEach((n) => n.classList.remove('hl'));
    if (!tut) { el.hidden = true; return; }
    const list = steps();
    let far = 0;
    while (far < list.length && list[far].done()) far++;
    if (tut.pin !== null && tut.pin >= far) tut.pin = null;
    const i = tut.pin !== null ? tut.pin : far;
    el.hidden = false;
    const nav = (back, fwd) => `<p class="coachnav">${back ? '<button class="btn" id="prevStep">Previous</button>' : ''}${fwd ? '<button class="btn primary" id="nextStep">Next</button>' : ''}</p>`;
    if (i >= list.length) { el.innerHTML = '<div class="kicker"><span>Practice complete</span></div><p>Well done. That is all there is to it.</p>' + nav(true, false); }
    else {
      const st = list[i], past = tut.pin !== null;
      el.innerHTML = `<div class="kicker"><span>Guided practice · step ${i + 1} of ${list.length}</span><button class="link" id="skipTut">Skip the practice</button></div><h2>${esc(st.h)}</h2><p>${esc(st.t)}</p>${past ? '<p class="muted">You have already done this step. Press Next to carry on, or just keep going.</p>' : ''}${nav(i > 0, past)}`;
      const target = document.querySelector(st.hl); if (target) target.classList.add('hl');
    }
    if ($('#skipTut')) $('#skipTut').onclick = () => { tut = null; startRun(); };
    if ($('#prevStep')) $('#prevStep').onclick = () => { tut.pin = i - 1; coach(); };
    if ($('#nextStep')) $('#nextStep').onclick = () => { tut.pin = i + 1 >= far ? null : i + 1; coach(); };
  }

  function submitFlow() {
    const v = $('#dxsel').value;
    if (!v) { $('#confirmNote').textContent = 'Choose a part first.'; return; }
    if (!$('#submit').dataset.arm) { $('#submit').dataset.arm = '1'; $('#submit').textContent = 'Confirm: this is final'; $('#confirmNote').textContent = `You are naming ${L(v)}.`; return; }
    finish(v);
  }

  function breakdown(r) {
    return [['Accuracy', r.parts.accuracy, 50], ['Efficiency', r.parts.efficiency, 30], ['No wasted tests', r.parts.redundancy, 10], ['Fits the evidence', r.parts.consistency, 10]]
      .map(([n, v, m]) => `<div class="row"><span>${n}</span><div class="bar"><i style="width:${(100 * v) / m}%"></i></div><span class="mono">${v}/${m}</span></div>`).join('');
  }
  const flagTags = (fl) => (fl.length ? fl.map((f) => `<span class="tag flag">Flag: ${esc(f.replace(/_/g, ' '))}</span>`).join(' ') : '<span class="tag">No flags</span>');
  function overlay(html) {
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="modal">${html}</div>`; document.body.appendChild(ov); return ov;
  }

  function finish(id) {
    const practice = !!tut;
    const r = S.submit(id, $('#why').value);
    const verdict = r.correct ? (r.justified ? 'Your evidence pointed to one part, and you named it.' : 'Right part, but your tests had not yet ruled out the others, so credit is halved. A lucky guess scores less than a diagnosis.') : 'That was not the failed part.';
    const reveal = `<p><b>The fault was ${esc(L(form.fault.id))}: ${MODE_TEXT[form.fault.mode]}.</b> You named ${esc(L(id))}.</p>`;
    const head = (label) => `<div class="kicker">${BRICK}<span>${label}</span></div>`;
    const pathTable = `<h2 style="margin-top:14px">Your path</h2><table class="t"><tr><th>#</th><th>Action</th><th>Parts still possible</th></tr>${trace.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.label)}</td><td class="mono">${t.n}</td></tr>`).join('') || '<tr><td colspan="3">No actions taken.</td></tr>'}</table><p class="muted">Test cost ${r.cost}; an efficient route needs ${r.policyCost}. ${r.nTests} tests, ${r.redundant} told you nothing new.</p>`;
    if (practice) {
      const ov = overlay(`${head('Practice result')}<div class="score" aria-label="Score ${r.total} out of 100">${r.total}<small> / 100</small></div><p>${verdict}</p>${reveal}${breakdown(r)}
        <h2>That was the practice</h2><p>Nicely done. The practice is not recorded and does not count. The real task has two items, and the second adapts to how the first goes. There are no hints, but the tools and the mentor work the same way. Take your time.</p>
        <p><button class="btn primary" id="again">Start the real task</button> <button class="btn" id="redo">Practise again</button></p>`);
      $('#again', ov).onclick = () => { ov.remove(); tut = null; startRun(); };
      $('#redo', ov).onclick = () => { ov.remove(); startPractice(); };
      $('#again', ov).focus(); return;
    }
    run.items.push({ tier: form.tier, formId: form.formId, fault: form.fault, result: r, log: S.log, events: S.events });
    const first = run.items.length === 1;
    const next = E.route(r);
    const body = `${head(`${TIER_NAME[form.tier]} result · form ${esc(form.formId)}`)}<div class="score" aria-label="Score ${r.total} out of 100">${r.total}<small> / 100</small></div><p>${verdict}</p>${reveal}${breakdown(r)}${pathTable}
      <h2>Integrity record</h2><p>${flagTags(r.flags)}</p><p class="muted">${esc(r.review)}. Flags are prompts for a person to look at the record. They are not a verdict and never reject anyone automatically.</p>`;
    if (first) {
      const ov = overlay(`${body}<h2>What happens next</h2><p>${r.correct && r.justified ? 'You diagnosed it soundly, so the second item is a harder one.' : 'That one did not go your way, so the second item is an easier one.'} <span class="muted">(The demo tells you about the routing. In live use candidates would not see it.)</span></p><p><button class="btn primary" id="nxt">Next item</button></p>`);
      $('#nxt', ov).onclick = () => { ov.remove(); startItem(next); }; $('#nxt', ov).focus(); return;
    }
    const [a, b] = run.items.map((x) => x.result);
    const bandName = E.band(a, b);
    const allFlags = [...new Set(run.items.flatMap((x) => x.result.flags))];
    const ov = overlay(`<div class="kicker">${BRICK}<span>Final result</span></div><h1>${bandName}</h1><p class="muted">Illustrative band from two adaptive items. Not calibrated: a real band would need data from people.</p>
      <table class="t"><tr><th>Item</th><th>Level</th><th>Sound</th><th>Score</th><th>Test cost</th></tr>${run.items.map((x, i) => `<tr><td>${i + 1}</td><td>${x.tier}</td><td>${x.result.correct && x.result.justified ? 'yes' : 'no'}</td><td class="mono">${x.result.total}</td><td class="mono">${x.result.cost}</td></tr>`).join('')}</table>
      <h2>Item ${run.items.length} detail</h2><div class="score" aria-label="Score ${r.total} out of 100">${r.total}<small> / 100</small></div><p>${verdict}</p>${reveal}${breakdown(r)}${pathTable}
      <h2>Integrity record, both items</h2><p>${flagTags(allFlags)}</p><p class="muted">${allFlags.length ? 'Human review recommended' : 'No review needed'}. Flags are prompts for a person to look at the record, never an automatic decision.</p>
      <p><button class="btn primary" id="again">Start again</button> <button class="btn" id="dl">Download session record</button> <button class="btn" id="close">Close</button></p>`);
    $('#again', ov).onclick = () => { ov.remove(); startRun(); };
    $('#close', ov).onclick = () => ov.remove();
    $('#dl', ov).onclick = () => { const bl = new Blob([JSON.stringify({ band: bandName, items: run.items }, null, 2)], { type: 'application/json' }); const x = document.createElement('a'); x.href = URL.createObjectURL(bl); x.download = 'session-record.json'; x.click(); };
    $('#again', ov).focus();
  }

  function welcome() {
    const ov = overlay(`<div class="kicker">${BRICK}<span>Field service · fault-finding · prototype</span></div><h1>Welcome. Let's find a fault together.</h1>
      <p>You are a maintenance technician. Pump 3 should fill a tank but it is not working. Your job is to work out which part has failed, using as few tests as you sensibly can. There are no trick questions, and using the reference guide and the AI mentor is part of the job.</p>
      <p>We will start with a short guided practice on a different fault. It takes about two minutes, shows you each tool in turn, and is not recorded or scored. Then you will do two items; the second adapts to how the first goes.</p>
      <p class="muted">There is no visible countdown, and you can use the keyboard throughout (Tab, Enter). <b>What is recorded in the real task:</b> your switch settings, tests, mentor questions and timings, and whether you leave this window, copy text or paste into a field. A person reviews these only if something looks unusual. No one is rejected automatically.</p>
      <p><button class="btn primary" id="go">Start the guided practice</button> <button class="btn" id="skip">Skip to the real task</button></p>`);
    ov.id = 'brief';
    $('#go', ov).onclick = () => { ov.remove(); startPractice(); };
    $('#skip', ov).onclick = () => { ov.remove(); };
    $('#go', ov).focus();
  }

  function begin(f, practice) {
    S = E.createSession(f); form = f; tut = practice ? { i: 0, pin: null } : null; trace = []; selected = null; pendingSwap = null; tool = 'hand';
    mount();
    say(practice ? 'Practice: follow the steps above.' : 'Start by switching the pump on with the hand tool.');
    coach();
    window.__session = S;
  }
  const q = new URLSearchParams(location.search);
  const seedParam = q.get('seed') ? Number(q.get('seed')) : null;
  const forced = () => { if (!q.get('fault')) return null; const [id, mode] = q.get('fault').split(':'); return { id, mode }; };
  function startItem(tier) {
    const first = run.items.length === 0;
    const seed = first && seedParam !== null ? seedParam : randSeed();
    let f = E.pickItem(tier, seed);
    if (first && forced()) { f = E.generate(seed, forced()); f.tier = tier; }
    begin(f, false);
  }
  function startRun() { run = { items: [] }; startItem('medium'); }
  const startPractice = () => { const f = E.generate(11, { id: 'K', mode: 'open' }); f.tier = 'practice'; begin(f, true); };

  startRun();
  welcome();
})();
