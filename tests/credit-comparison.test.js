// Run with: node tests/credit-comparison.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const nav = html.slice(html.indexOf('<nav class="tabs">'), html.indexOf('</nav>'));
assert.ok(nav.indexOf("switchTab('compare')") < nav.indexOf("switchTab('play')"));
assert.match(html, /class="compare-shortcut" onclick="switchTab\('compare'\)"/);
assert.match(html, /id="compare-starting-cash"[^>]*value="50"/);
assert.match(html, /id="compare-threshold-body"/);
const c = require('../assets/credit-comparison.js');

for (const [key, expected] of [['one', 0.9837345694841804], ['five', 0.9954390436947825]]) {
    const game = c.games[key];
    assert.ok(Math.abs(game.probs.reduce((a, b) => a + b, 0) - 1) < 1e-12);
    const one = c.convolve(game, 1, 1000);
    assert.ok(Math.abs(one.mean - expected) < 1e-9);
    for (let i = 0; i < game.pays.length; i++) assert.ok(Math.abs(one.pmf[game.pays[i]] - game.probs[i]) < 1e-12);
    const two = c.convolve(game, 2, 2000);
    const independent = new Float64Array(two.pmf.length);
    for (let i = 0; i < game.pays.length; i++) for (let j = 0; j < game.pays.length; j++) independent[game.pays[i] + game.pays[j]] += game.probs[i] * game.probs[j];
    for (let i = 0; i < independent.length; i++) assert.ok(Math.abs(independent[i] - two.pmf[i]) < 1e-12);
    const clipped = c.convolve(game, 2, 0);
    assert.ok(clipped.overflow > 0);
    assert.ok(Math.abs(clipped.pmf.reduce((a, b) => a + b, 0) + clipped.overflow - 1) < 1e-10);
    assert.equal(c.quantile(clipped, 0.99999), null);
    // Truncated and complete distributions must agree for all requested thresholds.
    const capped = c.convolve(game, 2, 200);
    for (const pct of c.thresholds) assert.ok(Math.abs(c.probabilityAbove(capped, 200, 100, pct) - c.probabilityAbove(two, 200, 100, pct)) < 1e-12);
    assert.throws(() => c.probabilityAbove(clipped, 200, 100, 200), /cap too small/);
}

const expected = {
    1: { hands: 200, net: -0.8132715, range: [37.25, 64.50], above100: 0.3996965, above120: 0.0656762, above200: 0.00375035 },
    2: { hands: 100, net: -0.8132715, range: [33.50, 71.50], above100: 0.3983399, above120: 0.1229710, above200: 0.00208389 },
    5: { hands: 40, net: -0.2280478, range: [26.25, 86.25], above100: 0.3759367, above120: 0.1805858, above200: 0.00891888 }
};
for (const credits of [1, 2, 5]) {
    const s = c.session(5000, credits), fixture = expected[credits];
    assert.equal(s.n, fixture.hands);
    assert.equal(s.wageredCents, 5000);
    assert.ok(Math.abs(s.n * s.betCents / 100 * (s.dist.mean - 1) - fixture.net) < 1e-6);
    assert.deepEqual([.025, .975].map(q => 50 + c.quantile(s.dist, q) * s.betCents / 100), fixture.range);
    for (const threshold of c.thresholds) {
        const p = c.probabilityAbove(s.dist, 5000, s.betCents, threshold);
        assert.ok(p >= 0 && p <= 1);
        if (threshold === 100) assert.ok(Math.abs(p - s.dist.profit) < 1e-10); // break-even is excluded
        if (fixture['above' + threshold] !== undefined) assert.ok(Math.abs(p - fixture['above' + threshold]) < 1e-6);
    }
    const probabilities = c.thresholds.map(t => c.probabilityAbove(s.dist, 5000, s.betCents, t));
    assert.ok(probabilities.every((p, i) => i === 0 || p <= probabilities[i - 1]));
    assert.ok(Math.abs(s.dist.loss + s.dist.even + s.dist.profit - 1) < 1e-10);
    const plotted = c.bin(s.dist, s.betCents / 100, 40, 60, 25, 50);
    assert.ok(Math.abs(plotted.bins.reduce((a, b) => a + b, 0) + plotted.outside - 1) < 1e-9);
    console.log(`${credits} credits: ${s.n} hands, expected net $${fixture.net.toFixed(4)}, P(profit) ${(probabilities[1] * 100).toFixed(2)}%`);
}
assert.equal(c.session(5001, 2).unusedCents, 1);
assert.equal(c.session(137, 2).n, 2);
assert.equal(c.session(137, 2).unusedCents, 37);
assert.throws(() => c.session(124, 5));
assert.throws(() => c.session(50001, 1));
// One 5-credit hand starting at $1.25: strictly above 100% means payout > one bet.
const single = c.session(125, 5);
assert.ok(Math.abs(c.probabilityAbove(single.dist, 125, 125, 100) - (1 - c.games.five.probs[0] - c.games.five.probs[1])) < 1e-12);

// Seeded Monte Carlo draws from the same per-hand model, checking the convolution.
let seed = 824913;
function random() { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
for (const credits of [1, 2, 5]) {
    const s = c.session(5000, credits), game = c.games[s.game], counts = [0, 0, 0, 0, 0], samples = 60000;
    let total = 0;
    const cumulative = game.probs.map(p => total += p);
    for (let r = 0; r < samples; r++) {
        let gross = 0;
        for (let hand = 0; hand < s.n; hand++) {
            const u = random(); let i = 0;
            while (i < cumulative.length - 1 && u >= cumulative[i]) i++;
            gross += game.pays[i];
        }
        const ending = 5000 + (gross - s.n) * s.betCents;
        c.thresholds.forEach((t, i) => { if (100 * ending > t * 5000) counts[i]++; });
    }
    for (let i = 0; i < c.thresholds.length; i++) {
        assert.ok(Math.abs(counts[i] / samples - c.probabilityAbove(s.dist, 5000, s.betCents, c.thresholds[i])) < .01, `Monte Carlo: ${credits} credits, ${c.thresholds[i]}%`);
    }
}

// Input validation, table and graph rendering, and unused-budget UI.
const ctx = { setTransform() {}, clearRect() {}, fillText() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, setLineDash() {} };
const elements = {
    'compare-starting-cash': { value: '50' }, 'compare-error': { textContent: '' },
    'compare-results': { hidden: true }, 'compare-bets': { textContent: '' },
    'compare-table-body': { innerHTML: '' }, 'compare-threshold-body': { innerHTML: '' },
    'compare-tail': { textContent: '' }, 'compare-chart': { getBoundingClientRect: () => ({ width: 500, height: 300 }), getContext: () => ctx }
};
global.document = { getElementById: id => elements[id] };
c.update();
assert.equal(elements['compare-results'].hidden, false);
assert.match(elements['compare-bets'].textContent, /1 credit: 200 hands at \$0.25/);
assert.match(elements['compare-bets'].textContent, /2 credits: 100 hands at \$0.50/);
assert.match(elements['compare-bets'].textContent, /5 credits: 40 hands at \$1.25/);
assert.equal((elements['compare-table-body'].innerHTML.match(/<tr>/g) || []).length, 3);
assert.equal((elements['compare-threshold-body'].innerHTML.match(/<tr>/g) || []).length, 5);
assert.match(elements['compare-threshold-body'].innerHTML, /39\.97%/);
assert.match(elements['compare-threshold-body'].innerHTML, /37\.59%/);
assert.match(elements['compare-tail'].textContent, /Outside chart:/);
elements['compare-starting-cash'].value = '50.01'; c.update();
assert.match(elements['compare-bets'].textContent, /\$0.01 of budget unused/);
assert.match(elements['compare-threshold-body'].innerHTML, /\$25\.005/);
for (const invalid of ['', '1.24', '500.01', '12.345', '-50']) {
    elements['compare-starting-cash'].value = invalid; c.update();
    assert.equal(elements['compare-results'].hidden, true);
    assert.match(elements['compare-error'].textContent, /Enter starting cash/);
}
elements['compare-starting-cash'].value = '500'; c.update();
assert.equal(elements['compare-results'].hidden, false);
console.log('Exact distributions, thresholds, simulation, and UI tests passed');
