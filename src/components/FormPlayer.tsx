"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormPayload } from "@/lib/types";
import { isHeatmapPoint } from "@/lib/types";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestionStep } from "@/components/QuestionStep";

type FormPlayerProps = {
  form: FormPayload;
};

export function FormPlayer({ form }: FormPlayerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = form.questions;
  const currentQuestion = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const currentValue = useMemo(() => {
    if (!currentQuestion) {
      return undefined;
    }
    return answers[currentQuestion.id];
  }, [answers, currentQuestion]);

  function setCurrentAnswer(value: unknown) {
    if (!currentQuestion) {
      return;
    }
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    setError(null);
  }

  function validateCurrent(): string | null {
    if (!currentQuestion) {
      return null;
    }
    const value = answers[currentQuestion.id];
    if (!currentQuestion.required) {
      return null;
    }
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (typeof value === "string" && !value.trim())
    ) {
      return "Please answer this question before continuing.";
    }
    if (Array.isArray(value) && value.length === 0) {
      return "Please answer this question before continuing.";
    }
    if (currentQuestion.type === "HEATMAP" && !isHeatmapPoint(value)) {
      if (
        !Array.isArray(value) ||
        value.length === 0 ||
        !value.every(isHeatmapPoint)
      ) {
        return "Please click on the image before continuing.";
      }
    }
    if (currentQuestion.type === "MULTIPLE_CHOICE" && Array.isArray(value) && value.length === 0) {
      return "Please select at least one option before continuing.";
    }
    return null;
  }

  async function handleNext() {
    const validationError = validateCurrent();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isLast) {
      setCurrentIndex((index) => index + 1);
      setError(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/forms/${form.slug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: Object.entries(answers).map(([questionId, value]) => ({
            questionId,
            value,
          })),
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        submissionId?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Submission failed. Please try again.");
        return;
      }

      router.push(`/q/${form.slug}/thank-you`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBack() {
    if (currentIndex === 0) {
      return;
    }
    setCurrentIndex((index) => index - 1);
    setError(null);
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col px-4 py-10">
      <div className="mb-8">
        <p className="text-sm font-medium text-zinc-500">
          Question {currentIndex + 1} of {questions.length}
        </p>
        <ProgressBar value={progress} />
      </div>

      <div className="flex flex-1 flex-col">
        <QuestionStep
          question={currentQuestion}
          value={currentValue}
          onChange={setCurrentAnswer}
        />

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-4 pt-10">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0 || isSubmitting}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : isLast ? "Submit" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
