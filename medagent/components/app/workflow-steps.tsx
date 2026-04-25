"use client";

import { useEffect, useState } from "react";

const STEPS = [
  { id: "verify", label: "Verifying clinician", icon: "🔐", duration: 800 },
  { id: "policy", label: "Checking access policy", icon: "📋", duration: 1200 },
  { id: "retrieval", label: "Retrieving medical records", icon: "🔍", duration: 2000 },
  { id: "synthesis", label: "Synthesizing clinical brief", icon: "🧠", duration: 1800 },
  { id: "audit", label: "Recording on Solana", icon: "⛓️", duration: 1500 },
  { id: "session", label: "Issuing secure session", icon: "🔑", duration: 600 },
];

export function WorkflowSteps({ active }: { active: boolean }) {
  const [currentStep, setCurrentStep] = useState(-1);

  useEffect(() => {
    if (!active) {
      setCurrentStep(-1);
      return;
    }

    let stepIndex = 0;
    setCurrentStep(0);

    const timers: ReturnType<typeof setTimeout>[] = [];

    function scheduleNext() {
      if (stepIndex >= STEPS.length - 1) return;
      const timer = setTimeout(() => {
        stepIndex++;
        setCurrentStep(stepIndex);
        scheduleNext();
      }, STEPS[stepIndex].duration);
      timers.push(timer);
    }

    scheduleNext();

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [active]);

  if (!active && currentStep === -1) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-5 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary/70 mb-3">
        MedAgent Workflow
      </p>
      <div className="space-y-0">
        {STEPS.map((step, index) => {
          const isDone = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;

          return (
            <div key={step.id} className="flex items-start gap-3 relative">
              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`absolute left-[15px] top-[30px] w-0.5 h-[calc(100%-6px)] transition-colors duration-500 ${
                    isDone ? "bg-green-400" : "bg-slate-200"
                  }`}
                />
              )}
              {/* Step indicator */}
              <div className="relative z-10 flex-shrink-0 mt-0.5">
                {isDone ? (
                  <div className="h-[30px] w-[30px] rounded-full bg-green-100 border border-green-300 flex items-center justify-center text-green-600 text-sm">
                    ✓
                  </div>
                ) : isCurrent ? (
                  <div className="h-[30px] w-[30px] rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                    <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                  </div>
                ) : (
                  <div className="h-[30px] w-[30px] rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs">
                    {index + 1}
                  </div>
                )}
              </div>
              {/* Step content */}
              <div className={`py-1.5 pb-4 transition-opacity duration-300 ${isPending ? "opacity-40" : "opacity-100"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{step.icon}</span>
                  <span className={`text-sm font-medium ${
                    isDone ? "text-green-700" : isCurrent ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {step.label}
                  </span>
                  {isCurrent && (
                    <span className="text-xs text-primary/60 animate-pulse">processing...</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
