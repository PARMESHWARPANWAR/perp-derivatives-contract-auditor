import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import { reasonAboutContract } from "../../../src/reasoner";
import { generateMarkdownReport } from "../../../src/report";
import { runSlither } from "../../../src/slither";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SOURCE_BYTES = 1_000_000;

function clientMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "The audit could not be completed.";

  if (/api.?key|authentication|unauthorized/i.test(message)) {
    return "The AI review service is not configured. Add a valid OPENAI_API_KEY and try again.";
  }
  if (/rate.?limit|429/i.test(message)) {
    return "The AI review service is temporarily rate-limited. Please wait a moment and try again.";
  }
  if (/ENOENT|solc|compilation|parser error/i.test(message)) {
    return "The Solidity source could not be analyzed. Check that it is valid and includes all required imports.";
  }
  return "The AI review could not be completed. Please try again shortly.";
}

export async function POST(request: Request) {
  let workspace: string | undefined;

  try {
    const formData = await request.formData();
    const sourceValue = formData.get("source");
    const fileValue = formData.get("file");
    const source = typeof sourceValue === "string" && sourceValue.trim()
      ? sourceValue
      : fileValue instanceof File
        ? await fileValue.text()
        : "";
    const originalName = fileValue instanceof File && fileValue.name.endsWith(".sol")
      ? path.basename(fileValue.name)
      : "PastedContract.sol";

    if (!source.trim()) {
      return NextResponse.json({ error: "Paste Solidity source or choose a .sol file to audit." }, { status: 400 });
    }
    if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
      return NextResponse.json({ error: "The contract is too large to audit in the web interface (limit: 1 MB)." }, { status: 413 });
    }
    if (fileValue instanceof File && fileValue.name && !fileValue.name.toLowerCase().endsWith(".sol")) {
      return NextResponse.json({ error: "Please upload a Solidity (.sol) file." }, { status: 400 });
    }

    workspace = await mkdtemp(path.join(tmpdir(), "ai-contract-audit-"));
    const contractPath = path.join(workspace, originalName);
    const reportPath = path.join(workspace, "audit-report.md");
    await writeFile(contractPath, source, "utf8");

    const slither = runSlither(contractPath);
    const reasoning = await reasonAboutContract(contractPath, slither.findings);
    generateMarkdownReport(originalName, reasoning, reportPath);
    const markdown = await readFile(reportPath, "utf8");

    return NextResponse.json({
      contractName: originalName,
      reasoning,
      markdown,
      mockMode: process.env.MOCK_MODE === "true",
      staticAnalysis: {
        available: slither.success,
        message: slither.success
          ? `Slither returned ${slither.findings.length} finding${slither.findings.length === 1 ? "" : "s"}.`
          : "Static analysis was unavailable; the AI review completed without Slither findings.",
      },
    });
  } catch (error) {
    console.error("Audit request failed:", error);
    return NextResponse.json({ error: clientMessage(error) }, { status: 500 });
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  }
}
