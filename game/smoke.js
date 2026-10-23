const E = require('./engine.js');
console.log(E.HYPS.length, 'hypotheses,', E.TESTS.length, 'tests');
for (const h of E.HYPS) {
  const p = E.policyPath(h);
  console.log(h.id.padEnd(4), h.mode.padEnd(7), 'free-look set', String(E.afterFreeLook(h).length).padStart(2), 'policy cost', p.cost, p.steps.map((s) => s.type + s.node).join(','));
}
