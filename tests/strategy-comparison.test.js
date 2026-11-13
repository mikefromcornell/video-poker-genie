// Compare Genie holds against the published full-pay 9/6 chart at
// https://www.beatingbonuses.com/job.htm (not a live calculator comparison).
// Run with: node tests/strategy-comparison.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const script = fs.readFileSync('index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const context = vm.createContext({ window: {}, console });
vm.runInContext(script, context);
const examples = [
    { hand: '10♥ J♥ Q♥ K♥ 2♣', hold: '10♥ J♥ Q♥ K♥', rule: '4 to a royal' },
    { hand: 'A♥ A♦ K♣ 7♦ 3♠', hold: 'A♥ A♦', rule: 'high pair' },
    { hand: '2♥ 2♦ 9♣ 6♠ 4♥', hold: '2♥ 2♦', rule: 'low pair' },
    { hand: '9♥ 9♣ 5♦ 5♠ A♥', hold: '9♥ 9♣ 5♦ 5♠', rule: 'two pair' },
    { hand: '5♣ 6♣ 7♣ 8♣ A♠', hold: '5♣ 6♣ 7♣ 8♣', rule: '4 to a straight flush' },
    { hand: '10♥ J♥ Q♥ K♥ A♥', hold: '10♥ J♥ Q♥ K♥ A♥', rule: 'royal flush' }
];
for (const example of examples) {
    context.sampleHand = example.hand.split(' ').map(code => ({rank: code.slice(0, -1), suit: code.slice(-1)}));
    const result = vm.runInContext('solveHand(sampleHand)', context)[0];
    const held = result.indices.map(i => example.hand.split(' ')[i]).join(' ');
    assert.equal(held, example.hold, example.rule);
    context.bestIndices = result.indices;
    const dist = vm.runInContext('getHoldDistribution(sampleHand, bestIndices)', context);
    context.counts = dist.counts;
    const totalPayout = vm.runInContext('Object.keys(counts).reduce((sum, name) => sum + counts[name] * getPayout(name, 5), 0)', context);
    assert.equal(Object.values(dist.counts).reduce((a, b) => a + b, 0), dist.total);
    assert.ok(Math.abs(totalPayout / dist.total - result.ev) < 1e-10);
    console.log(`${example.hand} | hold ${held} | gross EV ${result.ev.toFixed(4)} | ${example.rule} agrees with chart`);
}
console.log(`${examples.length}/${examples.length} holds agree with published chart; EV values are Genie calculations, not Beating Bonuses results.`);
