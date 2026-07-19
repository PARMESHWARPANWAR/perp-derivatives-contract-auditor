import OpenAI from "openai";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { SlitherFinding } from "./slither.js";
import { DERIVATIVES_CHECKLIST } from "./derivatives-checklist.js";

export interface ReasonedFinding {
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Informational";
  plainEnglishExplanation: string;
  suggestedFix: string;
  sourceLines?: number[];
}

export interface AuditReasoning {
  contractSummary: string;
  staticFindingsExplained: ReasonedFinding[];
  businessLogicRisks: ReasonedFinding[];
}

const severityFromImpact: Record<string, ReasonedFinding["severity"]> = {
  High: "High",
  Medium: "Medium",
  Low: "Low",
  Informational: "Informational",
};

interface MockFindingTemplate {
  title: string;
  explanation: string;
  fix: string;
}

// These are deliberately detector-specific demo interpretations. They make mock mode useful
// for walkthroughs without representing an actual GPT-5.6 assessment.
const mockFindingTemplates: Record<string, MockFindingTemplate> = {
  "arbitrary-send-eth": {
    title: "Ether can be sent to an attacker-controlled recipient",
    explanation:
      "A value transfer is made to an address that is not tightly constrained by the protocol. If a caller can influence that recipient, they may redirect funds that were intended for a trader, treasury, or settlement counterparty.",
    fix:
      "Derive payout recipients from trusted position ownership or immutable configuration, validate any user-supplied recipient against that ownership, and use a pull-payment withdrawal flow where practical.",
  },
  "unused-return": {
    title: "An external call result is ignored",
    explanation:
      "The contract calls another contract but does not use the returned value. A token transfer, oracle read, or adapter call can therefore report failure or an unexpected result while the surrounding operation continues as though it succeeded.",
    fix:
      "Capture the return value and revert when it indicates failure. For ERC-20 interactions, prefer OpenZeppelin SafeERC20 so tokens with non-standard return behavior are handled consistently.",
  },
  "events-maths": {
    title: "A state-changing calculation is not reflected in an event",
    explanation:
      "A material arithmetic update changes on-chain accounting without emitting the values needed to reconstruct it off-chain. Indexers, risk monitors, and user interfaces can then disagree with the contract about margin, funding, or position state.",
    fix:
      "Emit an event at the point the calculation is applied, including the account, old and new values, and the inputs used to derive the change. Add an indexer test that rebuilds the state from events.",
  },
  "missing-zero-check": {
    title: "A critical address may be configured as zero",
    explanation:
      "An address used as a dependency or recipient is accepted without rejecting address(0). A mistaken deployment or admin update could permanently disable oracle reads, route funds to an unusable address, or leave a market without its required component.",
    fix:
      "Require every essential address to be non-zero in constructors and setter functions, and emit a configuration-change event so monitoring can catch an unsafe update immediately.",
  },
  "immutable-states": {
    title: "A deployment-time value could be immutable",
    explanation:
      "This value is assigned once during construction and never changed, yet it is stored in regular contract storage. That costs additional gas on every read and obscures the fact that the dependency or configuration is intended to be permanent.",
    fix:
      "Declare the value immutable when it must not change after deployment. If it is meant to be upgradeable, retain storage but provide a guarded setter and an explicit configuration event instead.",
  },
  "low-level-calls": {
    title: "Low-level call needs explicit failure and reentrancy handling",
    explanation:
      "A raw call hands control to an external address and bypasses Solidity's typed interface guarantees. The recipient can run arbitrary fallback code, and failed calls or unexpected return data are easy to handle inconsistently in a settlement path.",
    fix:
      "Use a typed interface whenever possible. For necessary ETH transfers, update all accounting before the call, protect the entry point with a reentrancy guard, check the success flag, and consider crediting a withdrawable balance instead.",
  },
  "solc-version": {
    title: "The compiler pragma allows versions with known risks",
    explanation:
      "A broad or outdated Solidity version range can compile the same source with different compiler behavior and may permit versions affected by publicly documented bugs. Reproducible builds are especially important for contracts that custody collateral.",
    fix:
      "Pin the pragma to a reviewed compiler release, compile in CI with that exact version, and keep the compiler version aligned with Solidity's published security advisories.",
  },
  "reentrancy-eth": {
    title: "Ether transfer can re-enter contract logic",
    explanation:
      "The contract sends ETH to an external recipient during an operation. That recipient can execute code before the original call finishes, potentially invoking another public function against partially settled state.",
    fix:
      "Follow checks-effects-interactions: finalize all position and balance updates before transferring ETH, add a reentrancy guard to settlement entry points, and prefer withdrawable credits for complex payouts.",
  },
  "reentrancy-events": {
    title: "An external call can make emitted events misleading",
    explanation:
      "The function emits an event after interacting with an external address. If that address re-enters and changes related state before the event is produced, off-chain systems may receive an event that no longer describes the sequence users actually experienced.",
    fix:
      "Move event emission and all accounting updates before the external interaction where the event represents the original action, or use a reentrancy guard and emit values captured before the call.",
  },
  "reentrancy-no-eth": {
    title: "An external interaction can re-enter non-payment logic",
    explanation:
      "Even without sending ETH, calling an untrusted token or contract can yield control to attacker code. A callback can enter another public function while the current operation has not yet established its final margin, position, or authorization state.",
    fix:
      "Complete every state update before the external call, use a reentrancy guard across related entry points, and isolate token or adapter interactions behind well-reviewed interfaces.",
  },
  "divide-before-multiply": {
    title: "Early division can lose accounting precision",
    explanation:
      "The calculation divides before multiplying, truncating fractional value sooner than necessary. In margin and funding logic, repeated small trades can turn that rounding loss into a persistent imbalance between users and the protocol.",
    fix:
      "Reorder the expression to multiply before dividing where overflow is controlled, or use a full-precision mulDiv helper with an explicit rounding direction and tests around boundary-sized positions.",
  },
};

function mockFindingFor(finding: SlitherFinding): ReasonedFinding {
  const template = mockFindingTemplates[finding.check];
  const fallback: MockFindingTemplate = {
    title: `Review Slither detector: ${finding.check}`,
    explanation:
      `The ${finding.check} detector identified a pattern that deserves manual review in its surrounding execution path. ` +
      "In this simulated analysis, treat the result as a triage signal rather than a confirmed exploit and verify how the affected state, caller, and external dependencies interact.",
    fix:
      "Inspect the flagged source locations, define the intended security invariant, enforce it with explicit validation or access control, and add a regression test that proves the unsafe path cannot succeed.",
  };
  const analysis = template ?? fallback;

  return {
    title: analysis.title,
    severity: severityFromImpact[finding.impact] ?? "Medium",
    plainEnglishExplanation: analysis.explanation,
    suggestedFix: analysis.fix,
    sourceLines: finding.elements.flatMap((element) => element.source_mapping?.lines ?? []),
  };
}

function mockContractSummary(contractPath: string): string {
  let source: string;
  try {
    source = readFileSync(contractPath, "utf-8");
  } catch {
    return "This contract could not be read for a source-aware demo summary. Review its state transitions, external dependencies, and privileged operations before deployment.";
  }

  const contractName = source.match(/\bcontract\s+(\w+)/)?.[1] ?? path.basename(contractPath, ".sol");
  const functions = [...source.matchAll(/\bfunction\s+(\w+)/g)].map((match) => match[1]);
  const hasPosition = /\bPosition\b/i.test(source);
  const hasMargin = /\bmargin\b/i.test(source);
  const hasLiquidation = /\bliquidat/i.test(source);
  const hasFunding = /\bfunding/i.test(source);
  const hasOracle = /\boracle\b|\bprice\b/i.test(source);
  const actions = functions.slice(0, 4).join(", ");

  if (hasPosition && (hasMargin || hasLiquidation || hasFunding)) {
    const capabilities = [
      hasMargin && "accepts and tracks trader margin",
      hasOracle && "uses an external price input",
      hasLiquidation && "liquidates undercollateralized positions",
      hasFunding && "settles periodic funding payments",
    ].filter(Boolean).join(", ");
    return `${contractName} appears to be a perpetuals-style market that manages trader positions and ${capabilities}. ` +
      `Its key public flows include ${actions || "position management and settlement"}, so the highest-risk areas are price validity, collateral accounting, and the order in which settlement payouts are executed.`;
  }

  const traits = [
    hasOracle && "an external pricing dependency",
    hasMargin && "margin-related accounting",
    hasLiquidation && "liquidation logic",
    hasFunding && "funding-rate calculations",
  ].filter(Boolean);
  return `${contractName} is a Solidity contract with ${traits.length ? traits.join(", ") : "application-specific state and execution logic"}. ` +
    `The exposed functions (${actions || "no named public functions detected"}) should be reviewed for authorization, state consistency, and unsafe external interactions.`;
}

function mockReasoning(contractPath: string, slitherFindings: SlitherFinding[]): AuditReasoning {
  const staticFindingsExplained = slitherFindings.map(mockFindingFor);

  const oracleCheck = DERIVATIVES_CHECKLIST.find((check) => check.id === "oracle-staleness")!;
  const liquidationCheck = DERIVATIVES_CHECKLIST.find((check) => check.id === "liquidation-incentive-griefing")!;
  const marginCheck = DERIVATIVES_CHECKLIST.find((check) => check.id === "margin-accounting-rounding")!;

  return {
    contractSummary: mockContractSummary(contractPath),
    staticFindingsExplained,
    businessLogicRisks: [
      {
        title: "Price feed freshness must be enforced",
        severity: "High",
        plainEnglishExplanation:
          `${oracleCheck.description} ${oracleCheck.whyItMatters} A delayed or halted feed can make margin checks and liquidation decisions use an obsolete market price.`,
        suggestedFix:
          "Store and enforce a per-market maximum oracle age, reject incomplete or non-positive rounds, and pause price-sensitive actions when the feed is stale.",
      },
      {
        title: "Liquidation rewards can create bad-debt edge cases",
        severity: "High",
        plainEnglishExplanation:
          `${liquidationCheck.description} ${liquidationCheck.whyItMatters} The incentive needs to remain economically viable as position sizes become small or volatility rises.`,
        suggestedFix:
          "Model partial and self-liquidation scenarios, set a minimum liquidation size or protocol backstop, and cap rewards so they cannot exceed recoverable collateral.",
      },
      {
        title: "Margin arithmetic needs deterministic rounding",
        severity: "Medium",
        plainEnglishExplanation:
          `${marginCheck.description} ${marginCheck.whyItMatters} Tiny discrepancies compound when traders can repeatedly open, close, or settle positions.`,
        suggestedFix:
          "Document the rounding direction for every margin and PnL operation, use fixed-point helpers consistently, and fuzz repeated small-trade sequences for value leakage.",
      },
    ],
  };
}

function buildSystemPrompt(): string {
  const checklistText = DERIVATIVES_CHECKLIST.map(
    (c) => `- [${c.category}] ${c.description} (Why it matters: ${c.whyItMatters})`
  ).join("\n");

  return `You are a senior smart contract security auditor specialized in DeFi derivatives and perpetuals protocols — funding mechanisms, margin/PnL accounting, liquidation engines, and mark-price oracles. You will be given:
1. The full source of a Solidity contract
2. Structured static analysis findings from Slither (may be empty)

Your job:
- Summarize what the contract does in 2-3 sentences, noting whether it looks like a derivatives/margin-trading contract or a general-purpose contract
- For each static finding, explain it in plain English (assume the reader is a competent developer but not a security specialist) and suggest a concrete fix
- Separately, review the contract against the derivatives-specific checklist below. These are failure modes that generic static analyzers routinely miss because they live in business logic and financial assumptions, not syntax patterns. Only report a checklist item if it is genuinely applicable to this contract's code — do not force-fit items that don't apply.
- Also flag any other business-logic or economic risks you notice beyond the checklist (reentrancy in unusual contexts, access-control gaps, integer edge cases, incorrect assumptions about external call behavior, etc.)
- Assign each finding a severity: Critical, High, Medium, Low, or Informational

DERIVATIVES-SPECIFIC CHECKLIST:
${checklistText}

Respond ONLY with valid JSON matching this shape, no markdown fences, no preamble:
{
  "contractSummary": string,
  "staticFindingsExplained": [ { "title": string, "severity": string, "plainEnglishExplanation": string, "suggestedFix": string } ],
  "businessLogicRisks": [ { "title": string, "severity": string, "plainEnglishExplanation": string, "suggestedFix": string } ]
}`;
}

export async function reasonAboutContract(
  contractPath: string,
  slitherFindings: SlitherFinding[],
  apiKey?: string
): Promise<AuditReasoning> {
  if (process.env.MOCK_MODE === "true") {
    return mockReasoning(contractPath, slitherFindings);
  }

  const client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY });
  const source = readFileSync(contractPath, "utf-8");

  const userPrompt = `CONTRACT SOURCE (${contractPath}):\n\`\`\`solidity\n${source}\n\`\`\`\n\nSLITHER FINDINGS (JSON):\n${JSON.stringify(
    slitherFindings,
    null,
    2
  )}`;

  const response = await client.chat.completions.create({
    model: "gpt-5.6",
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as AuditReasoning;
  return parsed;
}
