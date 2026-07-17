"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NpsFlow } from "@/components/NpsFlow";
import { validateContactInfoAnswer } from "@/lib/contact-info";
import { getVisibleQuestionIds } from "@/lib/branching";
import type { FormPayload, NpsAnswer } from "@/lib/types";
import { isHeatmapPoint, isNpsOptions } from "@/lib/types";
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
  const [questionErrors, setQuestionErrors] = useState<Record<string, boolean>>(
    {},
  );
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [npsFollowUpText, setNpsFollowUpText] = useState("");
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surveyStartedAt = useRef(Date.now());
  const questionStartedAt = useRef(Date.now());
  const durationsRef = useRef<Record<string, number>>({});

  const questions = form.questions;
  const currentQuestion = questions[displayIndex];
  const isNpsQuestion = currentQuestion?.type === "NPS";
  const isTransitioning = slidePhase !== "idle";

  // Questions reachable given the answers so far, as indices into `questions`.
  // Branching means this set changes as the respondent answers, so navigation,
  // progress, and validation all work off the visible subset rather than the
  // raw question list.
  const visibleIndexList = useMemo(() => {
    const visibleIds = getVisibleQuestionIds(questions, answers);
    return questions.reduce<number[]>((acc, question, index) => {
      if (visibleIds.has(question.id)) {
        acc.push(index);
      }
      return acc;
    }, []);
  }, [questions, answers]);

  const visibleCount = visibleIndexList.length;
  const currentVisiblePos = visibleIndexList.indexOf(currentIndex);
  const isLast =
    currentVisiblePos !== -1 && currentVisiblePos === visibleCount - 1;
  const progress =
    visibleCount > 0 ? ((currentVisiblePos + 1) / visibleCount) * 100 : 0;
  const visibleErrorFlags = visibleIndexList.map(
    (index) => questionErrors[questions[index].id] ?? false,
  );

  function visibleListFor(nextAnswers: Record<string, unknown>): number[] {
    const visibleIds = getVisibleQuestionIds(questions, nextAnswers);
    return questions.reduce<number[]>((acc, question, index) => {
      if (visibleIds.has(question.id)) {
        acc.push(index);
      }
      return acc;
    }, []);
  }

  function nextVisibleIndex(
    fromIndex: number,
    list: number[] = visibleIndexList,
  ): number | null {
    const pos = list.indexOf(fromIndex);
    if (pos === -1) {
      return list.find((index) => index > fromIndex) ?? null;
    }
    return pos + 1 < list.length ? list[pos + 1] : null;
  }

  function prevVisibleIndex(fromIndex: number): number | null {
    const pos = visibleIndexList.indexOf(fromIndex);
    if (pos === -1) {
      const earlier = visibleIndexList.filter((index) => index < fromIndex);
      return earlier.length > 0 ? earlier[earlier.length - 1] : null;
    }
    return pos - 1 >= 0 ? visibleIndexList[pos - 1] : null;
  }

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
    setQuestionErrors((prev) => {
      if (!prev[currentQuestion.id]) return prev;
      const next = { ...prev };
      delete next[currentQuestion.id];
      return next;
    });
  }

  function validateQuestion(questionIndex: number): string | null {
    const question = questions[questionIndex];
    if (!question || question.type === "NPS") return null;

    const value = answers[question.id];

    if (question.type === "CONTACT_INFO") {
      return validateContactInfoAnswer(value, question.required, form.anonymous);
    }

    if (!question.required) return null;

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
      if (!Array.isArray(value) || value.length === 0 || !value.every(isHeatmapPoint)) {
        return "Please click on the image before continuing.";
      }
    }
    if (question.type === "MULTIPLE_CHOICE" && Array.isArray(value) && value.length === 0) {
      return "Please select at least one option before continuing.";
    }
    return null;
  }

  function validateCurrent(): string | null {
    return validateQuestion(currentIndex);
  }

  async function submitSurvey(
    nextAnswers: Record<string, unknown>,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const lastQuestion = questions[currentIndex];
    if (lastQuestion) {
      finalizeQuestionDuration(lastQuestion.id);
    }

    // Only submit answers for questions that remain visible under the final set
    // of answers; abandoned branches are dropped client-side (and the server
    // re-derives visibility as an authoritative check).
    const visibleIds = getVisibleQuestionIds(questions, nextAnswers);
    const visibleAnswers = Object.entries(nextAnswers).filter(([questionId]) =>
      visibleIds.has(questionId),
    );

    const answerPayload = visibleAnswers.map(([questionId, value]) => ({
      questionId,
      value: value instanceof File ? null : value,
      ...(form.anonymous ? {} : { durationMs: durationsRef.current[questionId] }),
    }));
    const timingPayload = form.anonymous
      ? {}
      : { totalDurationMs: Date.now() - surveyStartedAt.current };
    const hasFiles = visibleAnswers.some(([, value]) => value instanceof File);

    const response = await fetch(`/api/forms/${form.slug}/submit`, {
      method: "POST",
      ...(hasFiles
        ? {
            body: (() => {
              const formData = new FormData();
              formData.append(
                "payload",
                JSON.stringify({
                  ...timingPayload,
                  answers: answerPayload,
                }),
              );
              for (const [questionId, value] of visibleAnswers) {
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
              ...timingPayload,
              answers: answerPayload,
            }),
          }),
    });

    const raw = await response.text();
    let data: { error?: string } = {};
    try {
      data = raw ? (JSON.parse(raw) as typeof data) : {};
    } catch {
      return { ok: false, error: "Submission failed. Please try again." };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: data.error ?? "Submission failed. Please try again.",
      };
    }

    return { ok: true };
  }

  async function handleNpsPromoterSubmit(
    answer: NpsAnswer,
  ): Promise<{ redirectUrl?: string }> {
    if (!currentQuestion) {
      return {};
    }

    const nextAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(nextAnswers);

    const next = nextVisibleIndex(currentIndex, visibleListFor(nextAnswers));
    if (next !== null) {
      startSlide(next);
      return {};
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitSurvey(nextAnswers);
      if (!result.ok) {
        setError(result.error);
        return {};
      }

      const options = isNpsOptions(currentQuestion.options)
        ? currentQuestion.options
        : null;
      const redirectUrl = options?.promoterRedirectUrl?.trim();
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        router.push(`/q/${form.slug}/thank-you`);
      }

      return { redirectUrl };
    } catch {
      setError("Network error. Please try again.");
      return {};
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNpsDetractorComplete(answer: NpsAnswer): Promise<boolean> {
    if (!currentQuestion) {
      return false;
    }

    const nextAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(nextAnswers);

    const next = nextVisibleIndex(currentIndex, visibleListFor(nextAnswers));
    if (next !== null) {
      startSlide(next);
      return true;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitSurvey(nextAnswers);
      if (!result.ok) {
        setError(result.error);
        return false;
      }

      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleNext() {
    if (!isLast) {
      const validationError = validateCurrent();
      if (validationError) {
        setError(validationError);
        setQuestionErrors((prev) => ({
          ...prev,
          [currentQuestion.id]: true,
        }));
        return;
      }
      const next = nextVisibleIndex(currentIndex);
      if (next !== null) {
        startSlide(next);
      }
      return;
    }

    // On the last question validate every visible question at once — catches
    // required questions the user skipped by dragging the progress bar. The
    // current question is included so its specific message is shown when it's
    // the blocker.
    const errorFlags: Record<string, boolean> = {};
    for (const index of visibleIndexList) {
      if (validateQuestion(index) !== null) {
        errorFlags[questions[index].id] = true;
      }
    }
    if (Object.keys(errorFlags).length > 0) {
      setQuestionErrors(errorFlags);
      setError(
        errorFlags[currentQuestion.id]
          ? (validateCurrent() ?? "Please answer this question before continuing.")
          : "Please go back and answer all required questions before submitting.",
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitSurvey(answers);
      if (!result.ok) {
        setError(result.error);
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
    const prev = prevVisibleIndex(currentIndex);
    if (prev === null) {
      return;
    }
    startSlide(prev);
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
          Question {currentVisiblePos + 1} of {visibleCount}
        </p>
        <ProgressBar
          value={progress}
          total={visibleCount}
          currentIndex={currentVisiblePos}
          onSeek={(pos) => {
            const target = visibleIndexList[pos];
            if (target !== undefined) {
              startSlide(target);
            }
          }}
          disabled={isTransitioning || isSubmitting}
          questionErrors={visibleErrorFlags}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div key={displayIndex} className={slideClass}>
          {isNpsQuestion ? (
            <NpsFlow
              question={currentQuestion}
              anonymous={form.anonymous}
              onBack={handleBack}
              canGoBack={currentVisiblePos > 0}
              onPromoterSubmit={handleNpsPromoterSubmit}
              onDetractorComplete={handleNpsDetractorComplete}
              isSubmitting={isSubmitting}
              score={npsScore}
              followUpText={npsFollowUpText}
              onScoreChange={setNpsScore}
              onFollowUpTextChange={setNpsFollowUpText}
            />
          ) : (
            <QuestionStep
              question={currentQuestion}
              value={currentValue}
              onChange={setCurrentAnswer}
            />
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {!isNpsQuestion && (
          <div className="mt-auto flex items-center justify-between gap-4 pt-10">
            <button
              type="button"
              onClick={handleBack}
              disabled={
                currentVisiblePos <= 0 || isSubmitting || isTransitioning
              }
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
        )}
      </div>
    </div>
  );
}
