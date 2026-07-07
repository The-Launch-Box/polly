"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormPayload } from "@/lib/types";
import { isHeatmapPoint } from "@/lib/types";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestionStep } from "@/components/QuestionStep";

type FormPlayerProps = {
  form: FormPayload;
};

const EXIT_MS = 280;
const ENTER_MS = 420;

type SlideDirection = "forward" | "back";
type SlidePhase = "idle" | "exit" | "enter";

export function FormPlayer({ form }: FormPlayerProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState<SlideDirection>("forward");
  const [slidePhase, setSlidePhase] = useState<SlidePhase>("enter");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surveyStartedAt = useRef(Date.now());
  const questionStartedAt = useRef(Date.now());
  const durationsRef = useRef<Record<string, number>>({});

  const questions = form.questions;
  const currentQuestion = questions[displayIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const isTransitioning = slidePhase !== "idle";

  const currentValue = useMemo(() => {
    if (!currentQuestion) {
      return undefined;
    }
    return answers[currentQuestion.id];
  }, [answers, currentQuestion]);

  useEffect(() => {
    transitionTimer.current = setTimeout(() => {
      setSlidePhase("idle");
      transitionTimer.current = null;
    }, ENTER_MS);

    return () => {
      clearTransitionTimer();
    };
  }, []);

  useEffect(() => {
    questionStartedAt.current = Date.now();
  }, [displayIndex]);

  function finalizeQuestionDuration(questionId: string) {
    const elapsed = Date.now() - questionStartedAt.current;
    if (elapsed > 0) {
      durationsRef.current[questionId] =
        (durationsRef.current[questionId] ?? 0) + elapsed;
    }
  }

  function clearTransitionTimer() {
    if (transitionTimer.current) {
      clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
  }

  function startSlide(nextIndex: number) {
    if (nextIndex === currentIndex || isTransitioning || isSubmitting) {
      return;
    }

    const leaving = questions[currentIndex];
    if (leaving) {
      finalizeQuestionDuration(leaving.id);
    }

    clearTransitionTimer();
    setSlideDirection(nextIndex > currentIndex ? "forward" : "back");
    setSlidePhase("exit");

    transitionTimer.current = setTimeout(() => {
      setDisplayIndex(nextIndex);
      setCurrentIndex(nextIndex);
      setSlidePhase("enter");
      setError(null);

      transitionTimer.current = setTimeout(() => {
        setSlidePhase("idle");
        transitionTimer.current = null;
      }, ENTER_MS);
    }, EXIT_MS);
  }

  function setCurrentAnswer(value: unknown) {
    if (!currentQuestion) {
      return;
    }
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    setError(null);
  }

  function validateCurrent(): string | null {
    const question = questions[currentIndex];
    if (!question) {
      return null;
    }
    const value = answers[question.id];
    if (!question.required) {
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
    if (question.type === "ATTACHMENT" && !(value instanceof File)) {
      return "Please upload a file before continuing.";
    }
    if (question.type === "HEATMAP" && !isHeatmapPoint(value)) {
      if (
        !Array.isArray(value) ||
        value.length === 0 ||
        !value.every(isHeatmapPoint)
      ) {
        return "Please click on the image before continuing.";
      }
    }
    if (
      question.type === "MULTIPLE_CHOICE" &&
      Array.isArray(value) &&
      value.length === 0
    ) {
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
      startSlide(currentIndex + 1);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const lastQuestion = questions[currentIndex];
    if (lastQuestion) {
      finalizeQuestionDuration(lastQuestion.id);
    }

    try {
      const answerPayload = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value: value instanceof File ? null : value,
        durationMs: durationsRef.current[questionId],
      }));
      const totalDurationMs = Date.now() - surveyStartedAt.current;
      const hasFiles = Object.values(answers).some((value) => value instanceof File);

      const response = await fetch(`/api/forms/${form.slug}/submit`, {
        method: "POST",
        ...(hasFiles
          ? {
              body: (() => {
                const formData = new FormData();
                formData.append(
                  "payload",
                  JSON.stringify({
                    totalDurationMs,
                    answers: answerPayload,
                  }),
                );
                for (const [questionId, value] of Object.entries(answers)) {
                  if (value instanceof File) {
                    formData.append(`attachment:${questionId}`, value);
                  }
                }
                return formData;
              })(),
            }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                totalDurationMs,
                answers: answerPayload,
              }),
            }),
      });

      const raw = await response.text();
      let data: { error?: string; submissionId?: string } = {};
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        setError("Submission failed. Please try again.");
        return;
      }

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
    startSlide(currentIndex - 1);
  }

  if (!currentQuestion) {
    return null;
  }

  const slideClass =
    slidePhase === "exit"
      ? slideDirection === "forward"
        ? "survey-step-exit-forward"
        : "survey-step-exit-back"
      : slidePhase === "enter"
        ? slideDirection === "forward"
          ? "survey-step-enter-forward"
          : "survey-step-enter-back"
        : "";

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col px-4 py-10">
      <div className="mb-8">
        <p
          className="text-sm font-medium transition-opacity duration-300"
          style={{ color: "var(--theme-text-muted)" }}
        >
          Question {currentIndex + 1} of {questions.length}
        </p>
        <ProgressBar value={progress} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div key={displayIndex} className={slideClass}>
          <QuestionStep
            question={currentQuestion}
            value={currentValue}
            onChange={setCurrentAnswer}
          />
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-4 pt-10">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0 || isSubmitting || isTransitioning}
            className="rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: "var(--theme-text-muted)" }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting || isTransitioning}
            className="rounded-lg px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: "var(--theme-primary)",
              color: "var(--theme-primary-foreground)",
            }}
          >
            {isSubmitting ? "Submitting..." : isLast ? "Submit" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
