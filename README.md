# Video Poker Genie

The ultimate Video Poker trainer, solver, and variance engine powered by mathematical precision for Full Pay (9/6) Jacks or Better.

## Core Features
- **Real-time Solver & Trainer:** Uses Exhaustive Expectation Evaluation to calculate the Expected Value (EV) of all 32 possible hold combinations for any dealt hand.
- **Strategy Accuracy Tracker:** Measures how often your decisions align with mathematically optimal play (99.54% return).
- **Manual Hand Solver:** Pick any 5 cards from the deck to analyze optimal holds and alternative strategies.
- **Variance & Return Distribution Visualizer:**
  - High-speed Monte Carlo simulation (5,000+ paths) modeling ending bankroll and return distributions.
  - Interactive probability density chart with customizable starting bankroll, coin denomination ($0.05 to $100), bet coins (1-5), and session length (hands/hours).
  - Trajectory Fan Chart with 5th–95th percentile confidence bands and step-by-step path animator.
  - Comprehensive percentile spectrum (1st to 99th percentile) and "Without Royal Flush" overlay.
  - Exact paytable EV and variance contribution decomposition ($77.3\%$ of variance from the Royal Flush).
- **Optimal Bankroll & EV Convergence Calculator:**
  - **Trip & Session Survival:** Calculates exact bankroll to guarantee 90%, 95%, or 99% survival rate for finite sessions.
  - **EV Convergence Funnel:** Calculates hands ($N$) and bankroll required to overcome variance and converge within $\pm \Delta\%$ of theoretical EV via the Central Limit Theorem.
  - **Royal Flush Drought Hunter:** Sizing bankrolls to withstand 1, 2, 3, or 4 Royal cycles (up to 160k hands) without busting.
  - **Advantage Play & Kelly Criterion:** Fractional bankroll sizing when casino cashback/comps bring total EV $> 100\%$.
  - Universal Multi-Denomination Bankroll Reference Matrix.
- **Paytable & Mathematical Guides:** Learn the mathematics of video poker, Gambler's Ruin, and bankroll principles.

## Mathematical Engine
- **Full Pay 9/6 Jacks or Better:** Theoretical return of **99.5439%** with 5 coins max bet; per-hand variance $\sigma^2 \approx 19.5157$ ($\sigma \approx 4.4177$).
- **Base Game (Without Royal):** Base return **97.5631%**; base variance $\sigma^2 \approx 3.7084$ ($\sigma \approx 1.9257$).
- **EV Convergence Formula:** $N_{\text{hands}} = \left( \frac{Z_{1-\alpha/2} \cdot \sigma}{\Delta} \right)^2$.
- **Finite-Horizon Bankroll Formula:** $B(N, \alpha) = Z_{1-\alpha} \cdot \sigma_{\text{base}} \sqrt{N} + N \cdot |\mu_{\text{base}}|$.

## Publishing & Deployment
- Pure HTML5, CSS3, and modern vanilla JavaScript.
- 100% self-contained with no external dependencies or build steps.
- Designed for responsive mobile and desktop viewing and published via GitHub Pages.
