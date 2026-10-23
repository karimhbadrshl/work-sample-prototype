/* Page: scene, tools, AI mentor, guide, notebook, briefing and results. Uses window.Engine. */
(function () {
  'use strict';
  const E = window.Engine;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SHORT = { Q1: 'Isolator', F1: 'Fuse', PSU: 'Power supply', S1: 'E-stop', K1: 'Safety relay', SW1: 'Conveyor on', SW2: 'Pump on', KM1: 'Conv. contactor', KM2: 'Pump contactor', M1: 'Conveyor motor', M2: 'Pump motor' };
  const MODE_TEXT = { open: 'open circuit', low: 'output sagging to 17 V', seized: 'seized rotor' };
  const BRICK = '<svg width="34" height="22" viewBox="0 0 34 22" aria-hidden="true"><g fill="#B07A0C"><rect x="0" y="5" width="34" height="17" rx="2"/><rect x="5" y="0" width="8" height="6" rx="1"/><rect x="21" y="0" width="8" height="6" rx="1"/></g></svg>';
  const STUDS = '<svg width="130" height="8" viewBox="0 0 130 8" aria-hidden="true">' + Array.from({ length: 11 }, (_, i) => `<circle cx="${4 + 12 * i}" cy="4" r="3" fill="#D9D4C7"/>`).join('') + '</svg>';
  const POS = { Q1: [35, 100], F1: [145, 100], PSU: [255, 100], S1: [365, 100], K1: [475, 100], SW1: [35, 250], KM1: [145, 250], SW2: [275, 250], KM2: [385, 250], M1: [35, 395, 100, 80], M2: [650, 150, 110, 80] };

  let S = null, form = null, tool = 'hand', pendingSwap = null, trace = [], selected = null, awayAt = null;

  const part = (id) => {
    const [x, y, w = 96, h = 80] = POS[id];
    return `<g class="part" data-id="${id}" role="button" tabindex="0"><rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
      <text class="tg" x="${x + 8}" y="${y + 20}" data-tag="${id}"></text><text class="nm" x="${x + 8}" y="${y + 34}">${SHORT[id]}</text>
      <text class="st" x="${x + 8}" y="${y + h - 8}" data-st="${id}"></text>${decor(id, x, y, w, h)}</g>`;
  };
  function decor(id, x, y, w, h) {
    const cx = x + w / 2;
    if (id === 'Q1' || id === 'SW1' || id === 'SW2') return `<line data-lever="${id}" x1="${cx}" y1="${y + 56}" x2="${cx}" y2="${y + 40}" stroke="#22252B" stroke-width="5" stroke-linecap="round"/><circle cx="${cx}" cy="${y + 56}" r="5" fill="#22252B"/>`;
    if (id === 'S1') return `<circle data-estop="1" cx="${cx}" cy="${y + 52}" r="13" fill="#22252B"/><circle cx="${cx}" cy="${y + 52}" r="13" fill="none" stroke="#B07A0C" stroke-width="0"/>`;
    if (id === 'M1' || id === 'M2') { const fx = x + w - 24; return `<g class="spin"><circle cx="${fx}" cy="${y + 52}" r="13" fill="none" stroke="#22252B" stroke-width="2"/><path d="M${fx} ${y + 39} V${y + 65} M${fx - 13} ${y + 52} H${fx + 13}" stroke="#22252B" stroke-width="3"/></g>`; }
    return '';
  }
  const lamp = (id, cx, cy) => `<g><circle class="lamp lamp-off" data-lamp="${id}" cx="${cx}" cy="${cy}" r="9"/><text class="st" x="${cx + 14}" y="${cy + 4}" data-lamptxt="${id}"></text></g>`;

  function sceneSvg() {
    return `<svg viewBox="0 40 900 500" role="group" aria-label="Packaging cell 3: control cabinet, conveyor and pump skid">
      <rect class="zone" x="15" y="55" width="570" height="300" rx="10"/><text class="zt" x="28" y="75">CONTROL CABINET · 230 V MAINS IN AT LEFT</text>
      <rect class="zone" x="15" y="370" width="570" height="150" rx="10"/><text class="zt" x="150" y="388">CONVEYOR</text>
      <rect class="zone" x="610" y="55" width="275" height="300" rx="10"/><text class="zt" x="622" y="75">PUMP SKID</text>
      <path class="wire" d="M15 140H35M131 140H145M241 140H255M351 140H365M461 140H475M520 180V215H83M323 215V250M131 290H145M371 290H385M193 330V365H85V395M481 290H600V190H650M760 190H800"/>
      
      ${['Q1', 'F1', 'PSU', 'S1', 'K1', 'SW1', 'KM1', 'SW2', 'KM2'].map(part).join('')}
      ${lamp('H1', 280, 90)}${lamp('H2', 500, 90)}
      <g id="g-conv">${part('M1')}<line class="belt" x1="150" y1="440" x2="580" y2="440"/><g class="crates"><rect class="crate" x="170" y="410" width="34" height="28" rx="3"/><rect class="crate" x="300" y="410" width="34" height="28" rx="3"/></g></g>
      <g id="g-pump">${part('M2')}<rect x="800" y="110" width="70" height="170" rx="4" fill="#FBFAF6" stroke="#B9B2A2" stroke-width="1.5"/><rect x="802" y="190" width="66" height="88" fill="#2F5DA8" opacity=".25"/><path class="flow" d="M760 190H800"/><text class="nm" x="806" y="300">Tank</text></g>
    </svg>`;
  }

  function mount() {
    $('#app').innerHTML = `<div class="wrap">
      <div class="top"><div><div class="kicker">${BRICK}<span>Field service · fault-finding · prototype</span></div><h1>Cell 3 will not run. Find the fault.</h1>
        <div class="muted">Operator report: nothing runs when started. Switch things on, test, ask the mentor, then name the failed part.</div></div>
        <div class="hud"><span class="chip">Form <b id="formId"></b></span><span class="chip">Test cost <b id="cost">0</b></span><button class="btn" id="newForm">Load another form</button></div></div>
      <div class="grid"><div>
        <div class="card scene" id="scene">${sceneSvg()}</div>
        <div class="tools" role="group" aria-label="Tools">
          <button class="tool" data-tool="hand" aria-pressed="true">Hand<small>operate switches · cost 0</small></button>
          <button class="tool" data-tool="V" aria-pressed="false">Voltmeter<small>read output · cost 1</small></button>
          <button class="tool" data-tool="I" aria-pressed="false">Clamp ammeter<small>motors only · cost 1</small></button>
          <button class="tool" data-tool="SWAP" aria-pressed="false">Spare part<small>swap and see · cost 3</small></button>
          <div class="readout" aria-live="polite"><div class="sub">METER</div><div class="big" id="ro">no reading</div><div class="sub" id="ros">Pick a meter, then click a part.</div></div></div>
        <div class="status" id="status" aria-live="polite"></div>
      </div><div class="card"><div class="tabs" role="tablist">
        <button class="tab" role="tab" data-tab="mentor" aria-selected="true">AI mentor</button><button class="tab" role="tab" data-tab="guide" aria-selected="false">Reference guide</button><button class="tab" role="tab" data-tab="nb" aria-selected="false">Notebook</button></div>
        <div class="pane" id="p-mentor"></div><div class="pane" id="p-guide" hidden></div><div class="pane" id="p-nb" hidden></div>
        <div class="askrow" id="askrow"><input id="q" type="text" maxlength="200" placeholder="Ask about a part, a meter or method" aria-label="Ask the AI mentor"><button class="btn" id="ask">Ask</button></div>
        <div class="dx"><h2>Your diagnosis</h2><label for="dxsel">Failed part</label><select id="dxsel"></select>
          <label for="why">Why? One line, optional</label><input type="text" id="why" maxlength="200">
          <p><button class="btn primary" id="submit">Submit diagnosis</button> <span class="muted" id="confirmNote"></span></p></div></div></div>
      <div class="studs">${STUDS}<div class="muted" style="font-size:12px;margin-top:4px">Prototype. Synthetic cell, no real candidate data. The AI mentor runs as a rules-based mock in this demo.</div></div></div>`;
    $('#dxsel').innerHTML = '<option value="">Choose a part…</option>' + E.FAULTABLE.map((id) => `<option value="${id}">${esc(E.label(form, id))}</option>`).join('');
    $('#p-guide').innerHTML = E.guide(form.tags).map((g) => `<details class="g"><summary>${esc(g.title)}</summary><p>${esc(g.text)}</p></details>`).join('');
    $('#p-mentor').innerHTML = '<div class="msg ai"><span class="who">AI mentor</span>I can explain parts, meters, lamps and method, and tell you what a healthy part reads. I will not name the fault or confirm a guess.</div>';
    $('#formId').textContent = form.formId;
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
    $('#newForm').addEventListener('click', () => start(Math.floor(Math.random() * 1e9)));
  }
  document.addEventListener('copy', () => S && !S.done && S.event('copy'));
  document.addEventListener('visibilitychange', () => {
    if (!S || S.done) return;
    if (document.hidden) { awayAt = Date.now(); S.event('blur'); } else { S.event('focus', { awayFor: awayAt ? Math.round((Date.now() - awayAt) / 1000) : 0 }); awayAt = null; }
  });

  function setTool(t) {
    tool = t; pendingSwap = null;
    document.querySelectorAll('.tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
    say({ hand: 'Hand: click a switch to operate it.', V: 'Voltmeter: click a part to read its output. Cost 1.', I: 'Clamp ammeter: click a motor. Cost 1.', SWAP: 'Spare part: click a part to swap it. Cost 3.' }[t]);
  }
  const say = (m) => { $('#status').textContent = m; };
  const L = (id) => E.label(form, id);
  const fmtObs = (o) => `H1 ${o.H1}, H2 ${o.H2}, ${form.tags.M1} ${o.M1}, ${form.tags.M2} ${o.M2}`;

  function act(id) {
    if (S.done) return;
    selected = id;
    const gate = { Q1: 'Q1', S1: 'S1', SW1: 'SW1', SW2: 'SW2' }[id];
    if (tool === 'hand') {
      if (!gate) { say(`${L(id)}: use a meter or spare to test this part.`); return paint(); }
      const e = S.setSwitch(gate, !S.state[gate]);
      const word = gate === 'S1' ? (S.state.S1 ? 'released' : 'pressed in') : (S.state[gate] ? 'ON' : 'OFF');
      say(`${L(id)} ${word}. Now: ${fmtObs(S.observation())}.`); track(`${form.tags[id]} ${word}`); return paint();
    }
    if (tool === 'I' && id !== 'M1' && id !== 'M2') { say('The clamp ammeter works on the motor leads only.'); return paint(); }
    if (tool === 'SWAP') {
      if (!E.FAULTABLE.includes(id)) { say(`${L(id)}: no spare held for this part.`); return paint(); }
      if (pendingSwap !== id) { pendingSwap = id; say(`Swap ${L(id)}? Click it again to confirm (cost 3).`); return paint(); }
      pendingSwap = null;
    }
    const t = { type: tool, node: id };
    const r = S.test(t);
    let txt;
    if (tool === 'V') { const v = Number(r.result).toFixed(1); txt = `${v} V ${['Q1', 'F1'].includes(id) ? 'AC' : 'DC'}`; ro(txt, `Voltmeter · ${L(id)} output`); }
    else if (tool === 'I') { txt = `${Number(r.result).toFixed(1)} A`; ro(txt, `Clamp · ${L(id)} lead`); }
    else { txt = r.result === 'fixed' ? 'cell runs: this part was the cause' : 'no change: original part refitted'; ro(r.result === 'fixed' ? 'FIXED' : 'NO CHANGE', `Spare · ${L(id)}`); }
    say(`${L(id)}: ${txt}.${r.redundant ? ' This did not tell you anything new.' : ''}`);
    track(`${{ V: 'Voltmeter', I: 'Clamp', SWAP: 'Spare' }[tool]} at ${form.tags[id]}: ${txt}`);
    paint();
  }
  const ro = (big, sub) => { $('#ro').textContent = big; $('#ros').textContent = sub; };
  function track(label) {
    trace.push({ label, n: new Set(S.hypotheses().map((h) => h.id)).size });
    $('#p-nb').insertAdjacentHTML('beforeend', `<p class="nb"><span class="n">${String(trace.length).padStart(2, '0')}</span> ${esc(label)}</p>`);
  }

  function ask() {
    const q = $('#q').value.trim(); if (!q || S.done) return;
    const r = S.ask(q); $('#q').value = '';
    $('#p-mentor').insertAdjacentHTML('beforeend', `<div class="msg you"><span class="who">You</span>${esc(q)}</div><div class="msg ai"><span class="who">AI mentor</span>${esc(r.text)}</div>`);
    $('#p-mentor').scrollTop = 1e6;
    $('#p-nb').insertAdjacentHTML('beforeend', `<p class="nb"><span class="n">--</span> Asked mentor: ${esc(q)}</p>`);
  }

  function paint() {
    const st = S.state, o = S.observation();
    document.querySelectorAll('.part').forEach((p) => p.classList.toggle('sel', p.dataset.id === selected));
    Object.keys(POS).forEach((id) => {
      const t = $(`[data-tag="${id}"]`), s = $(`[data-st="${id}"]`), p = $(`.part[data-id="${id}"]`);
      t.textContent = form.tags[id];
      let w = '';
      if (id === 'Q1' || id === 'SW1' || id === 'SW2') w = st[id] ? 'ON' : 'OFF';
      if (id === 'S1') w = st.S1 ? 'RELEASED' : 'PRESSED';
      if (id === 'M1' || id === 'M2') w = o[id].toUpperCase();
      s.textContent = w;
      p.setAttribute('aria-label', `${L(id)}${w ? ', ' + w.toLowerCase() : ''}`);
    });
    ['Q1', 'SW1', 'SW2'].forEach((id) => {
      const l = $(`[data-lever="${id}"]`), [x, y, w = 96] = POS[id], cx = x + w / 2;
      l.setAttribute('x2', st[id] ? cx : cx - 14); l.setAttribute('y2', st[id] ? y + 40 : y + 44);
    });
    $('[data-estop]').setAttribute('r', st.S1 ? 13 : 9);
    ['H1', 'H2'].forEach((h) => { $(`[data-lamp="${h}"]`).setAttribute('class', `lamp lamp-${o[h]}`); $(`[data-lamptxt="${h}"]`).textContent = `${h} ${o[h].toUpperCase()}`; });
    $('#g-conv').setAttribute('class', o.M1 === 'running' ? 'running' : o.M1 === 'humming' ? 'humming' : '');
    $('#g-pump').setAttribute('class', o.M2 === 'running' ? 'running' : o.M2 === 'humming' ? 'humming' : '');
    $('#cost').textContent = S.cost;
  }

  function submitFlow() {
    const v = $('#dxsel').value;
    if (!v) { $('#confirmNote').textContent = 'Choose a part first.'; return; }
    if (!$('#submit').dataset.arm) { $('#submit').dataset.arm = '1'; $('#submit').textContent = 'Confirm: this is final'; $('#confirmNote').textContent = `You are naming ${L(v)}.`; return; }
    finish(v);
  }

  function finish(id) {
    const r = S.submit(id, $('#why').value);
    const label = (n) => `${esc(L(n))}`;
    const rows = [['Accuracy', r.parts.accuracy, 50], ['Efficiency', r.parts.efficiency, 30], ['No wasted tests', r.parts.redundancy, 10], ['Fits the evidence', r.parts.consistency, 10]];
    const verdict = r.correct ? (r.justified ? 'Your evidence pointed to one part, and you named it.' : 'Right part, but your tests had not yet ruled out the others, so credit is halved. A lucky guess scores less than a diagnosis.') : 'That was not the failed part.';
    const flags = r.flags.length ? r.flags.map((f) => `<span class="tag flag">Flag: ${esc(f.replace(/_/g, ' '))}</span>`).join(' ') : '<span class="tag">No flags</span>';
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="modal"><div class="kicker">${BRICK}<span>Result · form ${esc(form.formId)}</span></div>
      <div class="score" aria-label="Score ${r.total} out of 100">${r.total}<small> / 100</small></div><p>${verdict}</p>
      <p><b>The fault was ${label(form.fault.id)}: ${MODE_TEXT[form.fault.mode]}.</b> You named ${label(id)}.</p>
      ${rows.map(([n, v, m]) => `<div class="row"><span>${n}</span><div class="bar"><i style="width:${(100 * v) / m}%"></i></div><span class="mono">${v}/${m}</span></div>`).join('')}
      <h2 style="margin-top:14px">Your path</h2>
      <table class="t"><tr><th>#</th><th>Action</th><th>Parts still possible</th></tr>${trace.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.label)}</td><td class="mono">${t.n}</td></tr>`).join('') || '<tr><td colspan="3">No actions taken.</td></tr>'}</table>
      <p class="muted">Test cost ${r.cost}; an efficient route needs ${r.policyCost}. ${r.nTests} tests, ${r.redundant} told you nothing new.</p>
      <h2>Integrity record</h2><p>${flags}</p><p class="muted">${esc(r.review)}. Flags are prompts for a person to look at the record. They are not a verdict and never reject anyone automatically.</p>
      <p><button class="btn primary" id="again">Try another form</button> <button class="btn" id="dl">Download session record</button> <button class="btn" id="close">Close</button></p></div>`;
    document.body.appendChild(ov);
    $('#again', ov).onclick = () => { ov.remove(); start(Math.floor(Math.random() * 1e9)); };
    $('#close', ov).onclick = () => ov.remove();
    $('#dl', ov).onclick = () => { const b = new Blob([JSON.stringify({ form: form.formId, result: r, log: S.log, events: S.events }, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `session-${form.formId}.json`; a.click(); };
    $('#again', ov).focus();
  }

  function briefing() {
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'brief'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="modal"><div class="kicker">${BRICK}<span>Field service · fault-finding · prototype</span></div><h1>Before you start</h1>
      <p>Packaging cell 3 has stopped. You are the technician. Find the part that has failed using as few tests as you sensibly can.</p>
      <ul><li><b>Operate</b> the isolator, emergency stop and enable switches with the hand tool. Switching costs nothing.</li>
      <li><b>Test</b> with the voltmeter, clamp ammeter or a spare part. Each test has a cost, shown at the top.</li>
      <li><b>Ask</b> the AI mentor or read the reference guide for specs, meters and method. The mentor will not name the fault.</li>
      <li>There is no visible countdown. You can use the keyboard throughout (Tab, Enter).</li></ul>
      <h2>What is recorded</h2><p class="muted">Your switch settings, tests, mentor questions and timings, and whether you leave this window, copy text or paste into a field. A person reviews these only if something looks unusual. No score is ever rejected automatically.</p>
      <p><button class="btn primary" id="go">Start</button></p></div>`;
    document.body.appendChild(ov);
    $('#go', ov).onclick = () => { ov.remove(); };
    $('#go', ov).focus();
  }

  function start(seed, force) {
    const q = new URLSearchParams(location.search);
    let f = force;
    if (!f && q.get('fault')) { const [id, mode] = q.get('fault').split(':'); f = { id, mode }; }
    form = E.generate(seed, f); S = E.createSession(form); trace = []; selected = null; pendingSwap = null; tool = 'hand';
    mount();
    document.querySelectorAll('.overlay').forEach((o) => { if (o.id !== 'brief') o.remove(); });
    say('Start by switching the conveyor and pump on with the hand tool.');
    window.__session = S;
  }
  const seedParam = new URLSearchParams(location.search).get('seed');
  start(seedParam ? Number(seedParam) : Math.floor(Math.random() * 1e9));
  briefing();
})();
