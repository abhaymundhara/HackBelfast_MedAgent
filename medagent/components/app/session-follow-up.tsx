"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function SessionFollowUp({
  sessionId,
  suggestedQuestions = [],
}: {
  sessionId: string;
  suggestedQuestions?: string[];
}) {
  const [question, setQuestion] = useState(
    suggestedQuestions[0] ?? "What is the highest-priority risk in this authorized dataset?",
  );
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitQuestion() {
    setBusy(true);
    const response = await fetch(`/api/access/session/${sessionId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const payload = await response.json();
    setAnswer(payload.answer);
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {suggestedQuestions.length ? (
        <div className="flex flex-wrap gap-2">
          {suggestedQuestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
              onClick={() => setQuestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <Textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        rows={4}
      />
      <Button disabled={busy} onClick={submitQuestion}>
        {busy ? "Thinking..." : "Ask within authorized data"}
      </Button>
      {answer ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {answer}
        </div>
      ) : null}
    </div>
  );
}
