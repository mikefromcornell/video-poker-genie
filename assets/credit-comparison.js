/* Exact short-session payout convolution for full-pay 9/6 Jacks or Better.
 * One- and five-credit strategies use their respective optimal per-hand outcomes;
 * two credits use the one-credit strategy because their paytable scales linearly.
 * See README.md for provenance and assumptions.
 */
(function (root) {
    'use strict';
    const thresholds = [50, 100, 120, 150, 200];
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
    // Roundoff in the published probabilities must not compound over many rounds.
    for (const game of Object.values(games)) {
        const total = game.probs.reduce((sum, probability) => sum + probability, 0);
        game.probs = game.probs.map(probability => probability / total);
    }
    const bets = [
        { credits: 1, game: 'one', color: '#38bdf8', dash: [5, 3] },
        { credits: 2, game: 'one', color: '#c084fc', dash: [2, 3] },
        { credits: 5, game: 'five', color: '#fbbf24', dash: [] }
    ];
    const cache = new Map();
    let updateTimer;

    // Gross payouts are nonnegative integers in units of the total bet.
    // Values above the cap are retained as probability mass, not discarded.
    function convolve(game, n, profitCap = 200) {
        if (!Number.isInteger(n) || n < 1 || !Number.isInteger(profitCap) || profitCap < 0) throw new RangeError('Invalid session length or cap');
        const cap = n + profitCap;
        let current = new Float64Array(cap + 1);
        current[0] = 1;
        let overflow = 0;
        for (let hand = 0; hand < n; hand++) {
            const next = new Float64Array(cap + 1);
            for (let x = 0; x <= cap; x++) {
                if (current[x] === 0) continue;
                for (let i = 0; i < game.pays.length; i++) {
                    const y = x + game.pays[i];
                    if (y <= cap) next[y] += current[x] * game.probs[i];
                    else overflow += current[x] * game.probs[i];
                }
            }
            current = next;
        }
        let loss = 0, profit = overflow;
        for (let i = 0; i <= cap; i++) {
            if (i < n) loss += current[i];
            else if (i > n) profit += current[i];
        }
        const even = current[n];
        const mean = game.pays.reduce((sum, pay, i) => sum + pay * game.probs[i], 0);
        return { n, pmf: current, overflow, loss, even, profit, mean };
    }

    function distribution(name, n, profitCap = 200) {
        const key = `${name}:${n}:${profitCap}`;
        if (!cache.has(key)) {
            if (cache.size >= 12) cache.delete(cache.keys().next().value);
            cache.set(key, convolve(games[name], n, profitCap));
        }
        return cache.get(key);
    }

    // Discrete inverse CDF; null means the quantile is in the tracked overflow.
    function quantile(dist, probability) {
        let cumulative = 0;
        for (let i = 0; i < dist.pmf.length; i++) {
            cumulative += dist.pmf[i];
            if (cumulative >= probability) return i - dist.n;
        }
        return null;
    }

    // Sum exact probability of ending cash strictly above pct% of starting cash.
    // Cents and integer percentages avoid floating-point threshold errors.
    function probabilityAbove(dist, startingCents, betCents, pct) {
        const capProfit = dist.pmf.length - 1 - dist.n;
        if (100 * (startingCents + capProfit * betCents) < pct * startingCents) throw new RangeError('Distribution cap too small for threshold');
        let result = dist.overflow;
        for (let gross = 0; gross < dist.pmf.length; gross++) {
            const endingCents = startingCents + (gross - dist.n) * betCents;
            if (100 * endingCents > pct * startingCents) result += dist.pmf[gross];
        }
        return Math.min(1, Math.max(0, result));
    }

    function session(startingCents, credits) {
        const bet = bets.find(item => item.credits === credits);
        if (!bet || !Number.isInteger(startingCents) || startingCents < 125 || startingCents > 50000) throw new RangeError('Invalid starting cash or bet');
        const betCents = credits * 25;
        const n = Math.floor(startingCents / betCents);
        // Track at least the 200% cash threshold; the positive overflow is above it.
        const profitCap = Math.max(200, Math.ceil(startingCents / betCents));
        const dist = distribution(bet.game, n, profitCap);
        return { ...bet, startingCents, betCents, n, wageredCents: n * betCents, unusedCents: startingCents - n * betCents, dist };
    }

    function bin(dist, stake, min, max, count, startingCash = 0) {
        const bins = new Float64Array(count);
        let outside = dist.overflow;
        const width = (max - min) / count;
        for (let gross = 0; gross < dist.pmf.length; gross++) {
            const value = startingCash + (gross - dist.n) * stake;
            const p = dist.pmf[gross];
            if (value < min || value > max) outside += p;
            else bins[Math.min(count - 1, Math.floor((value - min) / width))] += p;
        }
        return { bins, outside };
    }

    function money(value) {
        if (Math.abs(value) < 0.0000001) return '$0.00';
        return (value < 0 ? '−$' : '$') + Math.abs(value).toFixed(2);
    }
    const pct = value => value < 0.0001 ? '<0.01%' : value > 0.9999 ? '>99.99%' : (value * 100).toFixed(2) + '%';
    const thresholdMoney = (cents, percent) => '$' + (cents * percent / 10000).toFixed((cents * percent) % 100 ? 3 : 2);

    function draw(canvas, sessions) {
        const dpr = root.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const w = rect.width, h = rect.height;
        ctx.clearRect(0, 0, w, h);
        const left = 50, right = 20, top = 22, bottom = 43, cw = w - left - right, ch = h - top - bottom;
        const start = sessions[0].startingCents / 100;
        const q = (s, p) => start + (quantile(s.dist, p) ?? (s.dist.pmf.length - 1 - s.n)) * s.betCents / 100;
        let min = Math.min(...sessions.map(s => q(s, 0.025)), start);
        let max = Math.max(...sessions.map(s => q(s, 0.975)), start + 0.25);
        const padding = (max - min) * 0.03; min = Math.max(0, min - padding); max += padding;
        const binCount = 35;
        const plotted = sessions.map(s => ({ session: s, ...bin(s.dist, s.betCents / 100, min, max, binCount, start) }));
        const peak = Math.max(...plotted.flatMap(item => Array.from(item.bins))) * 1.12 || 1;
        ctx.font = '11px system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = '#aeb8c4';
        for (let i = 0; i <= 4; i++) {
            const y = top + ch - ch * i / 4;
            ctx.strokeStyle = 'rgba(139,148,158,0.25)'; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
            ctx.fillText((peak * i / 4 * 100).toFixed(1) + '%', left - 6, y + 4);
        }
        const breakEven = left + (start - min) / (max - min) * cw;
        ctx.strokeStyle = '#8b949e'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(breakEven, top); ctx.lineTo(breakEven, top + ch); ctx.stroke(); ctx.setLineDash([]);
        for (const item of plotted) {
            ctx.strokeStyle = item.session.color; ctx.lineWidth = 2.5; ctx.setLineDash(item.session.dash); ctx.beginPath();
            item.bins.forEach((p, i) => {
                const x = left + ((i + 0.5) / binCount) * cw, y = top + ch - p / peak * ch;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.textAlign = 'center'; ctx.fillStyle = '#aeb8c4';
        for (let i = 0; i <= 4; i++) ctx.fillText(money(min + (max - min) * i / 4), left + cw * i / 4, h - 24);
        ctx.fillText('Ending cash', left + cw / 2, h - 5);
        ctx.textAlign = 'left'; ctx.fillText('Probability per bin', left, 13);
        return plotted.map(item => ({ credits: item.session.credits, outside: item.outside }));
    }

    function update() {
        const input = document.getElementById('compare-starting-cash');
        const error = document.getElementById('compare-error');
        const contents = document.getElementById('compare-results');
        const raw = input.value.trim();
        const amount = Number(raw);
        if (!/^\d+(?:\.\d{1,2})?$/.test(raw) || !Number.isFinite(amount) || amount < 1.25 || amount > 500) {
            error.textContent = 'Enter starting cash from $1.25 to $500, with at most two decimal places.';
            contents.hidden = true;
            return;
        }
        const cents = Math.round(amount * 100);
        error.textContent = '';
        contents.hidden = false;
        const sessions = bets.map(b => session(cents, b.credits));
        document.getElementById('compare-bets').textContent = sessions.map(s => `${s.credits} ${s.credits === 1 ? 'credit' : 'credits'}: ${s.n} hands at ${money(s.betCents / 100)}${s.unusedCents ? `; ${money(s.unusedCents / 100)} of budget unused` : ''}`).join(' · ');
        const outside = draw(document.getElementById('compare-chart'), sessions);
        if (outside) document.getElementById('compare-tail').textContent = 'Outside chart: ' + outside.map(item => `${item.credits} ${item.credits === 1 ? 'credit' : 'credits'} ${pct(item.outside)}`).join(' · ');
        let summary = '';
        for (const s of sessions) {
            const low = quantile(s.dist, 0.025), high = quantile(s.dist, 0.975);
            const bound = cents / 100 + (s.dist.pmf.length - 1 - s.n) * s.betCents / 100;
            const loText = low === null ? '>' + money(bound) : money(cents / 100 + low * s.betCents / 100);
            const hiText = high === null ? '>' + money(bound) : money(cents / 100 + high * s.betCents / 100);
            const expectedNet = s.n * (s.betCents / 100) * (s.dist.mean - 1);
            summary += `<tr><td>${s.credits}</td><td>${money(s.betCents / 100)}</td><td>${s.n}</td><td>${money(s.wageredCents / 100)}</td><td>${money(cents / 100 + expectedNet)}</td><td>${money(expectedNet)}</td><td>${pct(s.dist.profit)}</td><td>${loText} to ${hiText}</td></tr>`;
        }
        document.getElementById('compare-table-body').innerHTML = summary;
        document.getElementById('compare-threshold-body').innerHTML = thresholds.map(t =>
            `<tr><td>${t}%</td><td>${thresholdMoney(cents, t)}</td>${sessions.map(s => `<td>${pct(probabilityAbove(s.dist, cents, s.betCents, t))}</td>`).join('')}</tr>`
        ).join('');
    }

    function scheduleUpdate() {
        clearTimeout(updateTimer);
        updateTimer = setTimeout(update, 250);
    }
    root.CreditComparison = { thresholds, games, bets, convolve, distribution, quantile, probabilityAbove, session, bin, update, scheduleUpdate };
    if (typeof module !== 'undefined' && module.exports) module.exports = root.CreditComparison;
})(globalThis);
