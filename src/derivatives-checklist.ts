/**
 * Derivatives-specific vulnerability checklist.
 *
 * Generic static analyzers (Slither, etc.) are trained on general Solidity
 * patterns — reentrancy, tx.origin misuse, unchecked calls. They largely miss
 * the failure modes that actually break perpetuals / derivatives exchanges in
 * production, because those bugs live in business logic and financial
 * assumptions, not syntax patterns.
 *
 * This list is derived from real vulnerability classes seen in DeFi
 * derivatives protocols (funding rate mechanisms, mark-price oracles,
 * liquidation engines, margin accounting). It's fed to the LLM as additional
 * review criteria alongside the raw contract source, so the model checks for
 * *these specific things* rather than only general-purpose patterns.
 */

export interface DerivativesCheck {
  id: string;
  category: string;
  description: string;
  whyItMatters: string;
}

export const DERIVATIVES_CHECKLIST: DerivativesCheck[] = [
  {
    id: "funding-rate-manipulation",
    category: "Funding Rate",
    description:
      "Can a single address move the funding rate meaningfully by opening/closing large positions right before a funding settlement checkpoint?",
    whyItMatters:
      "Funding rate manipulation lets an attacker profit by skewing open interest just before settlement, extracting value from the opposite side of the book without taking on real market risk.",
  },
  {
    id: "oracle-staleness",
    category: "Oracle / Mark Price",
    description:
      "Does the contract check the timestamp/round freshness of the price feed before using it for liquidation, funding, or PnL calculations? Is there a max staleness threshold enforced on-chain?",
    whyItMatters:
      "A stale price feed lets attackers execute trades or trigger liquidations against a price the market has already moved away from — a classic and repeatedly exploited DeFi bug class.",
  },
  {
    id: "liquidation-incentive-griefing",
    category: "Liquidation Engine",
    description:
      "Can the liquidation reward/incentive be gamed — e.g. self-liquidation for a discount, or partial liquidations that leave dust positions that are unprofitable for anyone else to liquidate?",
    whyItMatters:
      "Broken liquidation incentives lead to insolvent positions sitting unliquidated, which can cascade into protocol-wide bad debt during volatile markets.",
  },
  {
    id: "margin-accounting-rounding",
    category: "Margin & PnL Accounting",
    description:
      "Do margin/PnL calculations use consistent rounding direction (always rounding in the protocol's favor, never the user's)? Are there paths where repeated small trades could drain precision-loss dust?",
    whyItMatters:
      "Asymmetric or inconsistent rounding is exploitable at scale — an attacker can execute thousands of trades to accumulate 'free' value from rounding errors.",
  },
  {
    id: "cross-margin-isolation",
    category: "Margin & PnL Accounting",
    description:
      "If the protocol supports cross-margining across multiple positions/markets, can a loss in one market improperly reduce required margin in another in a way that under-collateralizes the account?",
    whyItMatters:
      "Cross-margin bugs let traders take on more risk than their collateral supports, socializing losses to the protocol or LPs.",
  },
  {
    id: "front-running-position-changes",
    category: "MEV / Ordering",
    description:
      "Are trade execution prices determined in a way that's vulnerable to front-running or sandwich attacks around oracle updates or large orders?",
    whyItMatters:
      "Without commit-reveal, batch auctions, or similar protection, searchers can systematically extract value from ordinary users' trades.",
  },
  {
    id: "settlement-reentrancy",
    category: "Settlement",
    description:
      "During funding settlement or liquidation payout, is state updated before any external call (token transfer, callback) occurs? Could a malicious token or receiver re-enter mid-settlement?",
    whyItMatters:
      "This is reentrancy, but in a context generic detectors often miss because the external call is buried inside a multi-step settlement function rather than an obvious withdraw().",
  },
  {
    id: "access-control-admin-functions",
    category: "Access Control",
    description:
      "Are functions that change risk parameters (max leverage, liquidation threshold, funding interval, fee rates) properly gated, time-locked, or subject to governance — or can a single EOA change them instantly?",
    whyItMatters:
      "Instant, ungated changes to risk parameters are a common rug/exploit vector even when the core trading logic is otherwise sound.",
  },
];
