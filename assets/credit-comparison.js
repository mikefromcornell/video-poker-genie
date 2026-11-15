/* Exact short-session payout convolution for full-pay 9/6 Jacks or Better.
 * Outcome probabilities use independently optimized one- and five-credit strategies;
 * see README.md for provenance and assumptions. Values are probabilities per hand.
 */
(function (root) {
    'use strict';
    const rounds = [20, 50, 100, 150];
    const regularPays = [0, 1, 2, 3, 4, 6, 9, 25, 50];
    const games = {
        one: {
            pays: [...regularPays, 250],
            probs: [0.545742205508107, 0.21390686725871008, 0.12898722803243967, 0.07436689471042746, 0.01101877985921388, 0.011986788586118007, 0.011502654780925138, 0.00236324663838811, 0.0001059100220698181, 0.00001942460393794403]
        },
        five: {
            pays: [...regularPays, 800],
            probs: [0.5454346692334092, 0.21458503112564242, 0.12927890248024082, 0.07444869857110013, 0.011229367241343302, 0.011014510968033802, 0.011512207336284245, 0.002362545685876329, 0.00010930909037144676, 0.000024758268037625494]
        }
    };
    const cache = new Map();

    // Gross payouts are nonnegative integers in units of the total bet.
    // Values above cap are retained as probability mass, not silently discarded.
    function convolve(game, n, profitCap = 200) {
        if (!Number.isInteger(n) || n < 1 || !Number.isInteger(profitCap) || profitCap < 0) throw new RangeError('Invalid session length or cap');
        const cap = n + profitCap;
        let current = new Float64Array(cap + 1);
        current[0] = 1;
        for (let hand = 0; hand < n; hand++) {
            const next = new Float64Array(cap + 1);
            for (let x = 0; x <= cap; x++) {
                if (current[x] === 0) continue;
                for (let i = 0; i < game.pays.length; i++) {
                    const y = x + game.pays[i];
                    if (y <= cap) next[y] += current[x] * game.probs[i];
                }
            }
            current = next;
        }
        let retained = 0, loss = 0;
        for (let i = 0; i <= cap; i++) {
            retained += current[i];
            if (i < n) loss += current[i];
        }
        const overflow = Math.max(0, 1 - retained);
        const even = current[n];
        const mean = game.pays.reduce((sum, pay, i) => sum + pay * game.probs[i], 0);
        return { n, pmf: current, overflow, loss, even, profit: Math.max(0, 1 - loss - even), mean };
    }

    function distribution(name, n) {
        const key = name + ':' + n;
        if (!cache.has(key)) cache.set(key, convolve(games[name], n));
        return cache.get(key);
    }

    // Discrete inverse CDF; null means the quantile is in the retained overflow.
    function quantile(dist, probability) {
        let cumulative = 0;
        for (let i = 0; i < dist.pmf.length; i++) {
            cumulative += dist.pmf[i];
            if (cumulative >= probability) return i - dist.n;
        }
        return null;
    }

    function bin(dist, stake, min, max, count) {
        const bins = new Float64Array(count);
        let outside = dist.overflow;
        const width = (max - min) / count;
        for (let gross = 0; gross < dist.pmf.length; gross++) {
            const value = (gross - dist.n) * stake;
            const p = dist.pmf[gross];
            if (value < min || value > max) outside += p;
            else bins[Math.min(count - 1, Math.floor((value - min) / width))] += p;
        }
        return { bins, outside };
    }

    function money(value) {
        if (Math.abs(value) < 0.0000001) return '$0.00';
        return (value < 0 ? '−$' : '+$') + Math.abs(value).toFixed(2);
    }
    const pct = value => (value * 100).toFixed(2) + '%';

    function draw(canvas, one, five, stake1, stake5) {
        const dpr = root.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = rect.width, h = rect.height;
        ctx.clearRect(0, 0, w, h);
        const left = 48, right = 15, top = 22, bottom = 43, cw = w - left - right, ch = h - top - bottom;
        const q = (d, p) => quantile(d, p) ?? (d.pmf.length - 1 - d.n);
        let min = Math.min(q(one, 0.005) * stake1, q(five, 0.005) * stake5, 0);
        let max = Math.max(q(one, 0.995) * stake1, q(five, 0.995) * stake5, stake1, stake5);
        const padding = (max - min) * 0.03; min -= padding; max += padding;
        const binCount = 35;
        const a = bin(one, stake1, min, max, binCount), b = bin(five, stake5, min, max, binCount);
        const peak = Math.max(...a.bins, ...b.bins) * 1.12 || 1;
        ctx.font = '11px system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = '#aeb8c4';
        for (let i = 0; i <= 4; i++) {
            const y = top + ch - ch * i / 4;
            ctx.strokeStyle = 'rgba(139,148,158,0.25)'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
            ctx.fillText((peak * i / 4 * 100).toFixed(1) + '%', left - 6, y + 4);
        }
        const zero = left + (0 - min) / (max - min) * cw;
        ctx.strokeStyle = '#8b949e'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(zero, top); ctx.lineTo(zero, top + ch); ctx.stroke(); ctx.setLineDash([]);
        function line(bins, color, dash) {
            ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash(dash); ctx.beginPath();
            bins.forEach((p, i) => {
                const x = left + ((i + 0.5) / binCount) * cw, y = top + ch - p / peak * ch;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke(); ctx.setLineDash([]);
        }
        line(a.bins, '#38bdf8', [5, 3]); line(b.bins, '#fbbf24', []);
        ctx.textAlign = 'center'; ctx.fillStyle = '#aeb8c4';
        for (let i = 0; i <= 4; i++) {
            const value = min + (max - min) * i / 4;
            ctx.fillText(money(value), left + cw * i / 4, h - 24);
        }
        ctx.fillText('Net profit / loss', left + cw / 2, h - 5);
        ctx.textAlign = 'left'; ctx.fillText('Probability per bin', left, 13);
        return { one: a.outside, five: b.outside };
    }

    function update() {
        const input = document.getElementById('compare-stake');
        const mode = document.getElementById('compare-mode').value;
        const error = document.getElementById('compare-error');
        const amount = Number(input.value);
        const contents = document.getElementById('compare-results');
        if (!input.value || !Number.isFinite(amount) || amount < 0.01 || amount > 1000) {
            error.textContent = 'Enter a one-credit denomination from $0.01 to $1,000.';
            contents.hidden = true;
            return;
        }
        error.textContent = '';
        contents.hidden = false;
        const stake1 = amount, stake5 = mode === 'equal' ? amount : amount * 5;
        document.getElementById('compare-bets').textContent = `1 credit: $${stake1.toFixed(2)} per round · 5 credits: $${stake5.toFixed(2)} per round` + (mode === 'equal' ? ` (5 × $${(stake5 / 5).toFixed(3)} credits)` : ' (same credit denomination)') + ` · Royal payouts: $${(250 * stake1).toFixed(2)} vs $${(800 * stake5).toFixed(2)}`;
        let table = '';
        for (const n of rounds) {
            const one = distribution('one', n), five = distribution('five', n);
            const outside = draw(document.getElementById('compare-chart-' + n), one, five, stake1, stake5);
            if (outside) document.getElementById('compare-tail-' + n).textContent = `Outside chart: 1 credit ${pct(outside.one)} · 5 credits ${pct(outside.five)}`;
            for (const [label, d, stake] of [['1 credit', one, stake1], ['5 credits', five, stake5]]) {
                const low = quantile(d, 0.025), high = quantile(d, 0.975);
                const loText = low === null ? '>' + money(200 * stake) : money(low * stake);
                const hiText = high === null ? '>' + money(200 * stake) : money(high * stake);
                const royalProbability = label === '1 credit' ? games.one.probs[9] : games.five.probs[9];
                const royalChance = -Math.expm1(n * Math.log1p(-royalProbability));
                table += `<tr><td>${n}</td><td>${label}</td><td>${money(n * stake * (d.mean - 1))}</td><td>${pct(d.loss)}</td><td>${pct(d.even)}</td><td>${pct(d.profit)}</td><td>${loText} to ${hiText}</td><td>${pct(royalChance)}</td></tr>`;
            }
        }
        document.getElementById('compare-table-body').innerHTML = table;
    }
    root.CreditComparison = { rounds, games, convolve, distribution, quantile, bin, update };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.CreditComparison;
})(globalThis);
