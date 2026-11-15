// Run with: node tests/credit-comparison.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const nav = html.slice(html.indexOf('<nav class="tabs">'), html.indexOf('</nav>'));
assert.ok(nav.indexOf("switchTab('compare')") < nav.indexOf("switchTab('play')"), 'graph is visible near the start of navigation');
assert.match(html, /class="compare-shortcut" onclick="switchTab\('compare'\)"/);
assert.match(html, /id="tab-compare" class="tab-content"/);
const comparison = require('../assets/credit-comparison.js');
const { games, convolve, distribution, quantile, bin } = comparison;
for (const [key, expected] of [['one', 0.9837345694841804], ['five', 0.9954390436947825]]) {
    const game = games[key];
    assert.ok(Math.abs(game.probs.reduce((a, b) => a + b, 0) - 1) < 1e-10);
    const one = convolve(game, 1, 1000);
    assert.ok(Math.abs(one.mean - expected) < 1e-9);
    for (let i = 0; i < game.pays.length; i++) assert.ok(Math.abs(one.pmf[game.pays[i]] - game.probs[i]) < 1e-12);
    assert.ok(one.overflow < 1e-10);
    // Compare the convolution with an independently constructed two-hand distribution.
    const two = convolve(game, 2, 2000);
    const expectedPmf = new Float64Array(two.pmf.length);
    for (let i = 0; i < game.pays.length; i++) for (let j = 0; j < game.pays.length; j++) {
        expectedPmf[game.pays[i] + game.pays[j]] += game.probs[i] * game.probs[j];
    }
    for (let i = 0; i < expectedPmf.length; i++) assert.ok(Math.abs(expectedPmf[i] - two.pmf[i]) < 1e-12);
    const clipped = convolve(game, 2, 0);
    assert.ok(clipped.overflow > 0);
    assert.ok(Math.abs(clipped.pmf.reduce((a, b) => a + b, 0) + clipped.overflow - 1) < 1e-10);
    assert.equal(quantile(clipped, 0.99999), null);
    for (const n of comparison.rounds) {
        const d = distribution(key, n);
        assert.ok(Math.abs(d.loss + d.even + d.profit - 1) < 1e-10);
        assert.ok(d.overflow > 0);
        assert.ok(quantile(d, .025) <= quantile(d, .975));
        const binned = bin(d, .25, -5, 5, 25);
        assert.ok(Math.abs(binned.bins.reduce((a, b) => a + b, 0) + binned.outside - 1) < 1e-9);
        const lower = quantile(d, .025) * .25, upper = quantile(d, .975) * .25;
        console.log(`${n} rounds, ${key}: expected ${((d.mean - 1) * n * .25).toFixed(2)}, loss ${(d.loss*100).toFixed(2)}%, profit ${(d.profit*100).toFixed(2)}%, central 95% $${lower.toFixed(2)} to $${upper.toFixed(2)}`);
    }
}
console.log('Credit comparison convolution and tail accounting passed');
// Exercise both UI modes and invalid input with a minimal canvas/DOM stub.
const canvasContext = {
    setTransform() {}, clearRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, setLineDash() {}
};
const elements = {
    'compare-stake': { value: '0.25' }, 'compare-mode': { value: 'equal' },
    'compare-error': { textContent: '' }, 'compare-results': { hidden: true },
    'compare-bets': { textContent: '' }, 'compare-table-body': { innerHTML: '' }
};
for (const n of comparison.rounds) {
    elements['compare-chart-' + n] = { getBoundingClientRect: () => ({width: 500, height: 230}), getContext: () => canvasContext };
    elements['compare-tail-' + n] = { textContent: '' };
}
global.document = { getElementById: id => elements[id] };
comparison.update();
assert.equal(elements['compare-results'].hidden, false);
assert.match(elements['compare-bets'].textContent, /1 credit: \$0.25 per round · 5 credits: \$0.25 per round/);
assert.equal((elements['compare-table-body'].innerHTML.match(/<tr>/g) || []).length, 8);
assert.match(elements['compare-tail-150'].textContent, /Outside chart:/);
elements['compare-mode'].value = 'denom';
comparison.update();
assert.match(elements['compare-bets'].textContent, /5 credits: \$1.25 per round/);
elements['compare-stake'].value = '';
comparison.update();
assert.equal(elements['compare-results'].hidden, true);
assert.match(elements['compare-error'].textContent, /Enter/);
console.log('Equal-wager, same-denomination, and validation UI tests passed');
