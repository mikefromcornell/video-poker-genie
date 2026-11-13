// Run with: node tests/photo-solver.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script = fs.readFileSync('index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = {};
for (const id of ['photo-read-btn', 'photo-preview', 'photo-status', 'manual-result-panel', 'manual-result-content', 'manual-solve-btn']) {
    elements[id] = { disabled: false, value: '', textContent: '', innerHTML: '', style: {} };
}
elements['manual-slots'] = { children: Array.from({ length: 5 }, () => ({ className: '', innerHTML: '' })) };
const context = vm.createContext({
    window: {}, console, setTimeout,
    document: { getElementById: id => elements[id], querySelectorAll: () => [] }
});
vm.runInContext(fs.readFileSync('assets/card-detector.js', 'utf8'), context);
vm.runInContext(script, context);
const run = source => vm.runInContext(source, context);
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

(async () => {
    run('photoData = "data:image/jpeg;base64,abc"; CardDetector.detect = async () => cards');
    await run('readHandPhoto()');
    assert.equal(run('manualHand.map(c => c.rank + c.suit).join(" ")'), '10♥ J♥ Q♥ K♥ 2♣');
    assert.match(elements['photo-status'].textContent, /Verify/);
    assert.equal(elements['manual-solve-btn'].disabled, false);
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
    console.log('Local detection, stale response, and solver tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
