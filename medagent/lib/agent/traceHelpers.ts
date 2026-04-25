/**
 * Shared trace helper utilities for MedAgent sub-agents.
 *
 * These functions are extracted from the original medagent.ts so each
 * sub-agent can produce consistent AgentTrace records without duplicating logic.
 */

import { saveAgentTrace } from "@/lib/db";
import { AgentTrace, AgentTraceStatus, AgentTraceTool } from "@/lib/types";

function nowIso() {
  return new Date().toISOString();
}

/**
 * Appends a new trace step with the given status and summary.
 * Persists the updated trace to SQLite and returns the new trace object.
 */
export function addTraceStep(
  trace: AgentTrace,
  tool: AgentTraceTool,
  status: AgentTraceStatus,
  summary: string,
): AgentTrace {
  const step = {
    order: trace.steps.length + 1,
    tool,
    status,
    summary,
    startedAt: nowIso(),
    completedAt: status === "running" ? undefined : nowIso(),
  };
  const nextTrace: AgentTrace = {
    ...trace,
    steps: [...trace.steps, step],
  };
  saveAgentTrace(nextTrace);
  return nextTrace;
}

/**
 * Finds the most recent "running" step for the given tool, updates its status
 * and summary, and returns the updated trace. Falls back to addTraceStep if no
 * running step is found.
 */
export function completeTraceStep(
  trace: AgentTrace,
  tool: AgentTraceTool,
  status: Exclude<AgentTraceStatus, "running">,
  summary: string,
): AgentTrace {
  const stepIndex = trace.steps.findLastIndex(
    (step) => step.tool === tool && step.status === "running",
  );

  if (stepIndex === -1) {
    return addTraceStep(trace, tool, status, summary);
  }

  const nextSteps = [...trace.steps];
  nextSteps[stepIndex] = {
    ...nextSteps[stepIndex],
    status,
    summary,
    completedAt: nowIso(),
  };

  const nextTrace: AgentTrace = { ...trace, steps: nextSteps };
  saveAgentTrace(nextTrace);
  return nextTrace;
}
