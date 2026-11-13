// Run with: node tests/photo-solver.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
assert.match(html, /class="tab active" onclick="switchTab\('solver'\)"/);
assert.match(html, /id="tab-solver" class="tab-content active"/);
assert.match(html, /id="photo-camera"[^>]*capture="environment"/);
assert.ok(html.indexOf('id="manual-solve-btn"') < html.indexOf('id="manual-result-panel"'));
assert.ok(html.indexOf('id="manual-result-panel"') < html.indexOf('id="selector-grid"'));
assert.ok(html.indexOf('id="selector-grid"') < html.indexOf('class="solver-help"'));
assert.match(html, /for="photo-camera"/);
assert.match(html, /for="photo-file"/);
const elements = {};
for (const id of ['photo-read-btn', 'photo-preview', 'photo-status', 'manual-result-panel', 'manual-result-content', 'manual-solve-btn', 'manual-solve-bottom-btn', 'rounds-analyzed']) {
    elements[id] = { disabled: false, value: '', textContent: '', innerHTML: '', style: {} };
}
elements['manual-slots'] = { children: Array.from({ length: 5 }, () => ({ className: '', innerHTML: '' })) };
const storage = new Map();
const localStorage = { getItem: key => storage.has(key) ? storage.get(key) : null, setItem: (key, value) => storage.set(key, value) };
const context = vm.createContext({
    window: { localStorage }, console, setTimeout,
    document: { getElementById: id => elements[id], querySelectorAll: () => [] }
});
vm.runInContext(fs.readFileSync('assets/card-detector.js', 'utf8'), context);
vm.runInContext(script, context);
const run = source => vm.runInContext(source, context);
run('initAnalysisCounter()');
assert.equal(elements['rounds-analyzed'].textContent, '0');
storage.set('videoPokerGenie.roundsAnalyzed', '7');
run('initAnalysisCounter()');
assert.equal(elements['rounds-analyzed'].textContent, '7');
// Synthetic output tests class order, score threshold, NMS, and left-to-right ordering.
const tensor = new Float32Array(56 * 4);
function detection(i, x, rankClass, score) {
    tensor[i] = x; tensor[4 + i] = 100; tensor[8 + i] = 60; tensor[12 + i] = 100;
    tensor[(4 + rankClass) * 4 + i] = score;
}
detection(0, 300, 0, .9); // 10 clubs
detection(1, 100, 38, .95); // ace hearts
detection(2, 301, 1, .8); // same box, competing class
detection(3, 500, 5, .2); // below threshold
context.tensor = tensor;
assert.equal(run('CardDetector.decode(tensor, [1, 56, 4]).map(c => c.rank + c.suit).join(" ")'), 'A♥ 10♣');
assert.throws(() => run('CardDetector.decode(tensor, [1, 55, 4])'));
const cards = [
    { rank: '10', suit: '♥', color: 'red' }, { rank: 'J', suit: '♥', color: 'red' },
    { rank: 'Q', suit: '♥', color: 'red' }, { rank: 'K', suit: '♥', color: 'red' }, { rank: '2', suit: '♣', color: 'black' }
];
context.cards = cards;
console.time('exact solve');
const result = run('solveHand(cards)');
console.timeEnd('exact solve');
assert.equal(Array.from(result[0].indices).join(','), '0,1,2,3');
assert.ok(Math.abs(result[0].ev - 4625 / 47) < 1e-8);
assert.ok(result.find(r => r.indices.length === 0).ev > 1);
context.bestIndices = result[0].indices;
const distribution = run('getHoldDistribution(cards, bestIndices)');
assert.equal(distribution.total, 47);
assert.equal(distribution.counts.ROYAL_FLUSH, 1);
assert.equal(distribution.counts.STRAIGHT_FLUSH, 1);
assert.equal(Object.values(distribution.counts).reduce((sum, n) => sum + n, 0), 47);
const standPat = run('getHoldDistribution(cards, [0,1,2,3,4])');
assert.equal(standPat.total, 1);
assert.equal(standPat.counts.NOTHING, 1);

(async () => {
    run('photoData = "data:image/jpeg;base64,abc"; CardDetector.detect = async () => cards');
    await run('readHandPhoto()');
    assert.equal(run('manualHand.map(c => c.rank + c.suit).join(" ")'), '10♥ J♥ Q♥ K♥ 2♣');
    assert.match(elements['photo-status'].textContent, /Verify/);
    assert.equal(elements['manual-solve-btn'].disabled, false);
    assert.equal(elements['manual-solve-bottom-btn'].disabled, false);
    run('CardDetector.detect = async () => cards.slice(0, 4)');
    await run('readHandPhoto()');
    assert.match(elements['photo-status'].textContent, /Found 4 cards/);
    assert.equal(run('manualHand.length'), 5);
    run('CardDetector.detect = async () => [cards[0], cards[0], cards[2], cards[3], cards[4]]');
    await run('readHandPhoto()');
    assert.match(elements['photo-status'].textContent, /duplicates/);
    let finish;
    context.detectPending = () => new Promise(resolve => { finish = resolve; });
    run('CardDetector.detect = detectPending');
    const pending = run('readHandPhoto()');
    await new Promise(resolve => setTimeout(resolve, 70));
    run('toggleManualCard("10", "♥")');
    finish(cards);
    await pending;
    assert.equal(run('manualHand.length'), 4);
    assert.equal(elements['rounds-analyzed'].textContent, '7'); // Reading a photo is not a completed analysis.
    run('solveManualHand()'); // four cards cannot be analyzed
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(elements['rounds-analyzed'].textContent, '7');
    // Check the rendered EV and probability headings without repeating the slow solve.
    context.cachedResults = result;
    run('manualHand = cards.map(card => ({ ...card })); manualRevision++; solveHand = () => cachedResults; solveManualHand(); solveManualHand()');
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.match(elements['manual-result-content'].innerHTML, /98\.4043/);
    assert.match(elements['manual-result-content'].innerHTML, /Net EV/);
    assert.match(elements['manual-result-content'].innerHTML, /Possible outcomes for the best hold/);
    assert.match(elements['manual-result-content'].innerHTML, /2\.1277%/);
    assert.equal(elements['rounds-analyzed'].textContent, '8'); // duplicate clicks count once
    assert.equal(storage.get('videoPokerGenie.roundsAnalyzed'), '8');
    assert.equal(elements['manual-solve-bottom-btn'].disabled, false);
    let scrolled = false;
    elements['manual-result-panel'].scrollIntoView = () => { scrolled = true; };
    run('solveManualHand(true); manualRevision++'); // bottom action reveals the result; stale analysis is cancelled
    assert.equal(scrolled, true);
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(elements['rounds-analyzed'].textContent, '8');
    run('resetManualSolver(); initAnalysisCounter()');
    assert.equal(elements['rounds-analyzed'].textContent, '8'); // clear and reload retain count
    context.window.localStorage = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
    run('manualHand = cards.map(card => ({ ...card })); manualRevision++; solveManualHand()');
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(elements['rounds-analyzed'].textContent, '9'); // session fallback
    console.log('Local detection, EV display, analysis counter, and solver tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
