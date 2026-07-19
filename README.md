# Perp/Derivatives Contract Auditor

An AI-powered Solidity security auditor **specialized in DeFi derivatives and perpetuals protocols**. It combines **Slither** static analysis with **GPT-5.6** reasoning (built with Codex) to catch the failure modes that actually break margin-trading contracts in production — funding rate manipulation, oracle staleness, liquidation incentive griefing, cross-margin isolation bugs — not just generic Solidity patterns.

Built for the OpenAI Build Week Challenge — **Developer Tools** track.

## Why this exists (and why "specialized" matters)

Generic static analyzers like Slither are trained on general Solidity patterns: reentrancy, unchecked calls, tx.origin misuse. They're good at that. But the bugs that actually drain derivatives/perp protocols — stale price feeds used for liquidation, funding rates that can be gamed right before settlement, self-liquidation for a fee discount, ungated instant changes to leverage/liquidation parameters — live in financial business logic that pattern-matching tools don't understand and routinely miss entirely.

This tool runs Slither for the baseline, then feeds the contract to GPT-5.6 alongside an explicit **[derivatives-specific vulnerability checklist](src/derivatives-checklist.ts)** built from real production failure classes in margin-trading protocols. The result: findings a general-purpose auditor tool would never surface, explained in plain English with concrete fixes.

We validated this gap directly — running Slither alone against our sample perpetual futures contract (`test-contracts/SimplePerpMarket.sol`) surfaces 11 generic findings (unchecked external calls, missing events, etc.) but **misses every one of the 4 intentionally-planted derivatives-specific vulnerabilities**: missing oracle staleness checks, self-liquidation griefing, ungated risk-parameter changes, and funding-rate-before-settlement manipulation. Our specialized reasoning layer is built to catch exactly those.

## Setup

### Prerequisites
- Node.js >= 18
- Python 3.8+ with `pip` (for Slither)
- An OpenAI API key with GPT-5.6 access

### Install

```bash
# Install JS dependencies
npm install

# Install Slither (static analysis engine)
pip install slither-analyzer

# Install a Solidity compiler version manager and a compiler version
pip install solc-select
solc-select install 0.8.19
solc-select use 0.8.19

# Set up your API key
cp .env.example .env
# then edit .env and add your OPENAI_API_KEY
```

## Usage

```bash
npm run audit -- test-contracts/SimplePerpMarket.sol
```

This will:
1. Run Slither against the contract
2. Send the source + static findings + the derivatives checklist to GPT-5.6 for plain-English explanation and a specialized business-logic review
3. Write a Markdown report to `reports/audit-report.md`

Custom output path:

```bash
npm run audit -- path/to/YourContract.sol --out reports/your-report.md
```

## Sample data

`test-contracts/SimplePerpMarket.sol` is a simplified perpetual futures contract with 4 intentionally-planted derivatives-specific vulnerabilities (missing oracle staleness checks, self-liquidation griefing, ungated risk-parameter changes, funding-rate manipulation window) plus a couple of generic issues Slither catches on its own. It demonstrates the full tool end-to-end and shows the gap between generic and specialized analysis.

`test-contracts/VulnerableVault.sol` is also included as a simpler generic-vulnerability contract (reentrancy, missing access control) for comparison.

## Project structure

```
src/
  index.ts                    — CLI entrypoint
  slither.ts                  — Slither wrapper, parses JSON output into structured findings
  derivatives-checklist.ts    — domain-specific vulnerability checklist for perp/margin contracts
  reasoner.ts                 — GPT-5.6 reasoning layer (plain-English explanations + specialized business-logic review)
  report.ts                   — Markdown report generator
test-contracts/
  SimplePerpMarket.sol        — sample perpetual futures contract with planted derivatives-specific bugs
  VulnerableVault.sol         — sample generic-vulnerability contract for comparison
reports/                      — generated audit reports land here
```

## How Codex was used

_[To be filled in during the build — see the "highlight where Codex accelerated your workflow" requirement. Track: scaffolding decisions, prompt iteration on the reasoner system prompt, and any debugging sessions here, plus the /feedback Codex Session ID for the submission form.]_

## License

MIT
