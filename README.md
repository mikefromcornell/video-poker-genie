# Video Poker Genie

The ultimate Video Poker trainer and solver powered by mathematical precision.

## Core Features
- **Real-time Solver:** Uses Exhaustive Expectation Evaluation to calculate the Expected Value (EV) of all 32 possible hold combinations for any hand.
- **Strategy Accuracy Tracker:** Measures how often your decisions align with the mathematically optimal play.
- **Paytable Analysis:** Focuses on Full Pay Jacks or Better (9/6) logic.
- **Educational Guide:** Learn why betting max coins is essential and how to manage your bankroll.

## Mathematical Engine: Exhaustive Expectation Evaluation
Unlike simple heuristic-based trainers, Video Poker Genie evaluates every possible outcome for every hold.
1. It identifies all 32 ways to hold a 5-card hand.
2. For each hold, it simulates every possible combination of replacement cards from the remaining deck.
3. It averages the payouts of all outcomes to determine the "Expected Value".
4. It recommends the move with the absolute highest EV.

## Publishing
This project is published via GitHub Pages.

## Tech Stack
- Pure HTML5/CSS3/JavaScript
- No external dependencies or build steps required.
