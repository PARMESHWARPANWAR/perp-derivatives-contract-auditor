#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import "dotenv/config";
import { runSlither } from "./slither.js";
import { reasonAboutContract } from "./reasoner.js";
import { generateMarkdownReport } from "./report.js";
import path from "node:path";

const program = new Command();

program
  .name("ai-audit")
  .description("AI-powered Solidity security auditor — Slither + GPT-5.6")
  .argument("<contract>", "path to .sol contract file")
  .option("-o, --out <path>", "output report path", "reports/audit-report.md")
  .action(async (contractPath: string, opts: { out: string }) => {
    console.log(chalk.bold.cyan("\n🔍 AI Contract Auditor\n"));

    const spinner = ora("Running Slither static analysis...").start();
    const slitherResult = runSlither(contractPath);

    if (!slitherResult.success) {
      spinner.warn(
        chalk.yellow(`Slither analysis unavailable (${slitherResult.error}). Proceeding with AI-only review.`)
      );
    } else {
      spinner.succeed(`Slither found ${slitherResult.findings.length} raw finding(s).`);
    }

    const reasoningSpinner = ora("Asking GPT-5.6 to reason about the contract...").start();
    try {
      const reasoning = await reasonAboutContract(contractPath, slitherResult.findings);
      reasoningSpinner.succeed("AI reasoning complete.");

      const contractName = path.basename(contractPath);
      generateMarkdownReport(contractName, reasoning, opts.out);

      console.log(chalk.green(`\n✅ Report written to ${opts.out}\n`));
    } catch (err: any) {
      reasoningSpinner.fail(`AI reasoning failed: ${err?.message ?? err}`);
      process.exitCode = 1;
    }
  });

program.parse();
