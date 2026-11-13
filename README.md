# Video Poker Genie

The ultimate Video Poker trainer, solver, and variance engine powered by mathematical precision for Full Pay (9/6) Jacks or Better.

## Core Features
- **Real-time Solver & Trainer:** Uses Exhaustive Expectation Evaluation to calculate the Expected Value (EV) of all 32 possible hold combinations for any dealt hand.
- **Strategy Accuracy Tracker:** Measures how often your decisions align with mathematically optimal play (99.54% return).
- **Photo & Hand Solver:** Upload a photo to read a dealt hand, verify or correct the detected cards, and calculate the optimal hold, draw, and alternative holds. You can also select all five cards manually.
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

## Photo recognition

Open **Photo & Hand Solver**, choose a clear, tightly cropped photo of five upright, separated cards, and select **Read cards**. Verify every rank and suit using the card selector before selecting **Analyze Hand**. The solver uses the full-pay 9/6 Jacks or Better paytable with a five-coin bet; other games and paytables may require different holds. The recommendation maximizes expected payout, not the probability of winning any particular hand.

Recognition is free, requires no API key, and runs in your browser; the photo is not uploaded. The local model and runtime are downloaded from the site on first use (about 23 MB). Recognition is trained on standard playing cards and may struggle with video poker screen graphics, unusual designs, glare, overlapping cards or small images. Always check the results, or use the manual selector if the photo cannot be read.

For local use, serve the directory over HTTP (for example `python3 -m http.server 8000`) and visit `http://localhost:8000`; loading model and WebAssembly files directly via `file://` is not reliably supported. GitHub Pages serves them automatically.

Run checks with `node tests/photo-solver.test.js` and `node tests/model-smoke.test.js`.

### Third-party recognition components

- `assets/playing-cards.onnx` is an ONNX export of the YOLOv8 card model from [MustafaKemal0146/kart-tanima](https://github.com/MustafaKemal0146/kart-tanima), distributed there under the MIT license (see `assets/MODEL-LICENSE.txt`). It was exported at 640×640, opset 17, using Ultralytics 8.4.211. The upstream model was trained using a Roboflow playing-cards dataset and Ultralytics YOLOv8; those components may have separate terms.
- `assets/ort/` contains ONNX Runtime Web 1.22.0 (MIT; see `assets/ort/LICENSE`).

## Mathematical Engine
- **Full Pay 9/6 Jacks or Better:** Theoretical return of **99.5439%** with 5 coins max bet; per-hand variance $\sigma^2 \approx 19.5157$ ($\sigma \approx 4.4177$).
- **Base Game (Without Royal):** Base return **97.5631%**; base variance $\sigma^2 \approx 3.7084$ ($\sigma \approx 1.9257$).
- **EV Convergence Formula:** $N_{\text{hands}} = \left( \frac{Z_{1-\alpha/2} \cdot \sigma}{\Delta} \right)^2$.
- **Finite-Horizon Bankroll Formula:** $B(N, \alpha) = Z_{1-\alpha} \cdot \sigma_{\text{base}} \sqrt{N} + N \cdot |\mu_{\text{base}}|$.

## Publishing & Deployment
- Pure HTML5, CSS3, and modern vanilla JavaScript.
- No build step required; photo recognition and solving run locally in the browser.
- Designed for responsive mobile and desktop viewing and published via GitHub Pages.
