import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

export interface SlitherFinding {
  check: string;
  impact: string;
  confidence: string;
  description: string;
  elements: Array<{ name: string; type: string; source_mapping?: { filename_short?: string; lines?: number[] } }>;
}

export interface SlitherResult {
  success: boolean;
  findings: SlitherFinding[];
  raw?: string;
  error?: string;
}

/**
 * Runs Slither static analysis against a Solidity contract file and returns
 * structured findings. Requires `slither-analyzer` to be installed
 * (pip install slither-analyzer) and solc available via solc-select.
 */
export function runSlither(contractPath: string): SlitherResult {
  if (!existsSync(contractPath)) {
    return { success: false, findings: [], error: `Contract not found: ${contractPath}` };
  }

  try {
    const output = execSync(`slither ${contractPath} --json -`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 20,
    });

    const parsed = JSON.parse(output);
    const detectors = parsed?.results?.detectors ?? [];

    const findings: SlitherFinding[] = detectors.map((d: any) => ({
      check: d.check,
      impact: d.impact,
      confidence: d.confidence,
      description: d.description,
      elements: (d.elements ?? []).map((e: any) => ({
        name: e.name,
        type: e.type,
        source_mapping: e.source_mapping,
      })),
    }));

    return { success: true, findings, raw: output };
  } catch (err: any) {
    // Slither exits non-zero when it finds issues, but still emits valid JSON on stdout.
    const stdout = err?.stdout?.toString?.();
    if (stdout) {
      try {
        const parsed = JSON.parse(stdout);
        const detectors = parsed?.results?.detectors ?? [];
        const findings: SlitherFinding[] = detectors.map((d: any) => ({
          check: d.check,
          impact: d.impact,
          confidence: d.confidence,
          description: d.description,
          elements: (d.elements ?? []).map((e: any) => ({
            name: e.name,
            type: e.type,
            source_mapping: e.source_mapping,
          })),
        }));
        return { success: true, findings, raw: stdout };
      } catch {
        // fall through to error
      }
    }
    return {
      success: false,
      findings: [],
      error: err?.message ?? "Slither execution failed. Is slither-analyzer installed?",
    };
  }
}
