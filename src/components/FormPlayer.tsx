"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NpsFlow } from "@/components/NpsFlow";
import { validateContactInfoAnswer } from "@/lib/contact-info";
import { getVisibleQuestionIds } from "@/lib/branching";
import type { FormPayload, FormQuestion, NpsAnswer } from "@/lib/types";
import {
  isHeatmapPoint,
  isNpsOptions,
  isPointAllocationAnswer,
  isPointAllocationOptions,
  isChoiceListOptions,
  pointAllocationTotal,
  type MultipleChoiceOptions,
} from "@/lib/types";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestionStep } from "@/components/QuestionStep";
import { SectionQuestionsPage } from "@/components/SectionQuestionsPage";
import { isNonInputQuestionType } from "@/lib/question-types";
import {
  buildSurveyPages,
  filterVisibleSurveyPages,
  pageKey,
  type SurveyPage,
} from "@/lib/survey-pages";

type FormPlayerProps = {
  form: FormPayload;
};

const EXIT_MS = 280;
const ENTER_MS = 420;

type SlideDirection = "forward" | "back";
type SlidePhase = "idle" | "exit" | "enter";

export function FormPlayer({ form }: FormPlayerProps) {
  const router = useRouter();
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [displayPageIndex, setDisplayPageIndex] = useState(0);
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
  const activeDurationIdsRef = useRef<string[]>([]);

  const questions = form.questions;
  const allPages = useMemo(() => buildSurveyPages(questions), [questions]);

  const visiblePages = useMemo(() => {
    const visibleIds = getVisibleQuestionIds(questions, answers);
    return filterVisibleSurveyPages(allPages, questions, visibleIds);
  }, [allPages, questions, answers]);

  const visibleCount = visiblePages.length;
  const safeCurrentPageIndex = Math.min(
    currentPageIndex,
    Math.max(visibleCount - 1, 0),
  );
  const safeDisplayPageIndex = Math.min(
    displayPageIndex,
    Math.max(visibleCount - 1, 0),
  );
  const currentPage = visiblePages[safeCurrentPageIndex] ?? null;
  const displayPage = visiblePages[safeDisplayPageIndex] ?? null;
  const isTransitioning = slidePhase !== "idle";
  const isLast =
    safeCurrentPageIndex !== -1 &&
    visibleCount > 0 &&
    safeCurrentPageIndex === visibleCount - 1;
  const progress =
    visibleCount > 0 ? ((safeCurrentPageIndex + 1) / visibleCount) * 100 : 0;

  const displayQuestions = useMemo(
    () => (displayPage ? questionsOnPage(displayPage, questions) : []),
    [displayPage, questions],
  );

  const isNpsOnlyPage =
    displayPage?.kind === "single" &&
    questions[displayPage.questionIndex]?.type === "NPS";

  const isNonInputStep =
    displayPage?.kind === "single" &&
    isNonInputQuestionType(questions[displayPage.questionIndex].type);

  const answerableQuestions = useMemo(
    () =>
      visiblePages.flatMap((page) =>
        questionsOnPage(page, questions).filter(
          (question) => !isNonInputQuestionType(question.type),
        ),
      ),
    [visiblePages, questions],
  );

  const answerableVisibleCount = answerableQuestions.length;
  const answerableVisiblePos = (() => {
    if (!currentPage) return 0;
    const idsOnCurrent = new Set(
      questionsOnPage(currentPage, questions).map((question) => question.id),
    );
    let count = 0;
    for (const question of answerableQuestions) {
      count += 1;
      if (idsOnCurrent.has(question.id)) {
        break;
      }
    }
    return count;
  })();

  const visibleErrorFlags = visiblePages.map((page) =>
    questionsOnPage(page, questions).some(
      (question) => questionErrors[question.id] ?? false,
    ),
  );

  function visiblePagesFor(nextAnswers: Record<string, unknown>): SurveyPage[] {
    const visibleIds = getVisibleQuestionIds(questions, nextAnswers);
    return filterVisibleSurveyPages(allPages, questions, visibleIds);
  }

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
    activeDurationIdsRef.current = displayQuestions.map((question) => question.id);
  }, [displayPageIndex, displayQuestions]);

  function finalizeActiveDurations() {
    const elapsed = Date.now() - questionStartedAt.current;
    if (elapsed <= 0) return;
    const share = Math.floor(elapsed / Math.max(activeDurationIdsRef.current.length, 1));
    for (const questionId of activeDurationIdsRef.current) {
      durationsRef.current[questionId] =
        (durationsRef.current[questionId] ?? 0) + share;
    }
  }

  function clearTransitionTimer() {
    if (transitionTimer.current) {
      clearTimeout(transitionTimer.current);
      transitionTimer.current = null;
    }
  }

  function startSlide(nextPageIndex: number, fromPageIndex = currentPageIndex) {
    if (nextPageIndex === fromPageIndex || isTransitioning || isSubmitting) {
      return;
    }

    finalizeActiveDurations();
    clearTransitionTimer();
    setSlideDirection(nextPageIndex > fromPageIndex ? "forward" : "back");
    setSlidePhase("exit");

    transitionTimer.current = setTimeout(() => {
      setDisplayPageIndex(nextPageIndex);
      setCurrentPageIndex(nextPageIndex);
      setSlidePhase("enter");
      setError(null);
      window.scrollTo({ top: 0, behavior: "auto" });

      transitionTimer.current = setTimeout(() => {
        setSlidePhase("idle");
        transitionTimer.current = null;
      }, ENTER_MS);
    }, EXIT_MS);
  }

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setError(null);
    setQuestionErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  function setCurrentAnswer(value: unknown) {
    if (!currentPage || currentPage.kind !== "single") {
      return;
    }
    setAnswer(questions[currentPage.questionIndex].id, value);
  }

  function validateQuestion(questionIndex: number): string | null {
    const question = questions[questionIndex];
    if (!question || isNonInputQuestionType(question.type)) {
      return null;
    }

    const value = answers[question.id];

    if (question.type === "NPS") {
      if (question.required && (value === undefined || value === null)) {
        return "Please complete this question before continuing.";
      }
      return null;
    }

    if (question.type === "CONTACT_INFO") {
      return validateContactInfoAnswer(value, question.required, form.anonymous);
    }

    if (question.type === "POINT_ALLOCATION") {
      if (!isPointAllocationOptions(question.options)) {
        return "This question is misconfigured.";
      }
      if (!isPointAllocationAnswer(value)) {
        return question.required
          ? "Please allocate your points before continuing."
          : null;
      }
      const total = pointAllocationTotal(value);
      if (!question.required && total === 0) {
        return null;
      }
      if (total !== question.options.totalPoints) {
        return `Please distribute all ${question.options.totalPoints} points before continuing.`;
      }
      return null;
    }

    if (question.type === "MULTIPLE_CHOICE") {
      if (!isChoiceListOptions(question.options)) {
        return "This question is misconfigured.";
      }
      const multi = question.options as MultipleChoiceOptions;
      const min = multi.minSelections ?? 1;
      const max = multi.maxSelections ?? multi.choices.length;
      const selected = Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];

      if (selected.length === 0) {
        return question.required
          ? "Please select at least one option before continuing."
          : null;
      }
      if (selected.length < min) {
        return `Select at least ${min} option${min === 1 ? "" : "s"}.`;
      }
      if (selected.length > max) {
        return `Select at most ${max} option${max === 1 ? "" : "s"}.`;
      }
      return null;
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
      if (
        !Array.isArray(value) ||
        value.length === 0 ||
        !value.every(isHeatmapPoint)
      ) {
        return "Please click on the image before continuing.";
      }
    }
    return null;
  }

  function validatePage(page: SurveyPage): {
    error: string | null;
    errorFlags: Record<string, boolean>;
  } {
    const errorFlags: Record<string, boolean> = {};
    let firstError: string | null = null;

    for (const index of questionIndicesOnPage(page)) {
      const message = validateQuestion(index);
      if (message) {
        errorFlags[questions[index].id] = true;
        if (!firstError) firstError = message;
      }
    }

    return { error: firstError, errorFlags };
  }

  function scrollToFirstError(flags: Record<string, boolean>) {
    const firstId = Object.keys(flags)[0];
    if (!firstId) return;
    const el = document.getElementById(`survey-q-${firstId}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  async function submitSurvey(
    nextAnswers: Record<string, unknown>,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    finalizeActiveDurations();

    const visibleIds = getVisibleQuestionIds(questions, nextAnswers);
    const visibleAnswers = Object.entries(nextAnswers).filter(([questionId]) =>
      visibleIds.has(questionId),
    );

    const answerPayload = visibleAnswers.map(([questionId, value]) => ({
      questionId,
      value: value instanceof File ? null : value,
      ...(form.anonymous
        ? {}
        : { durationMs: durationsRef.current[questionId] }),
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

  function advanceAfterNps(
    nextAnswers: Record<string, unknown>,
    npsQuestionId: string,
  ): "slid" | "submit" | "stayed" {
    const pages = visiblePagesFor(nextAnswers);
    const pagePos = pages.findIndex((page) =>
      questionsOnPage(page, questions).some(
        (question) => question.id === npsQuestionId,
      ),
    );
    if (pagePos === -1) {
      return "submit";
    }

    const page = pages[pagePos];
    if (page.kind === "section-body") {
      const sectionQuestions = questionsOnPage(page, questions);
      const npsPos = sectionQuestions.findIndex(
        (question) => question.id === npsQuestionId,
      );
      if (npsPos !== -1 && npsPos < sectionQuestions.length - 1) {
        const nextId = sectionQuestions[npsPos + 1].id;
        requestAnimationFrame(() => {
          const el = document.getElementById(`survey-q-${nextId}`);
          if (!el) return;
          const top = el.getBoundingClientRect().top + window.scrollY - 96;
          window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        });
        return "stayed";
      }
    }

    if (pagePos + 1 < pages.length) {
      // `pages` is derived from the new answers (branching may have shifted
      // indices), so animate from this page's position in that list.
      startSlide(pagePos + 1, pagePos);
      return "slid";
    }

    return "submit";
  }

  async function handleNpsPromoterSubmit(
    answer: NpsAnswer,
    npsQuestion: FormQuestion,
  ): Promise<{ redirectUrl?: string }> {
    const nextAnswers = { ...answers, [npsQuestion.id]: answer };
    setAnswers(nextAnswers);

    const advance = advanceAfterNps(nextAnswers, npsQuestion.id);
    if (advance === "slid" || advance === "stayed") {
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

      const options = isNpsOptions(npsQuestion.options)
        ? npsQuestion.options
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

  async function handleNpsDetractorComplete(
    answer: NpsAnswer,
    npsQuestion: FormQuestion,
  ): Promise<boolean> {
    const nextAnswers = { ...answers, [npsQuestion.id]: answer };
    setAnswers(nextAnswers);

    const advance = advanceAfterNps(nextAnswers, npsQuestion.id);
    if (advance === "slid" || advance === "stayed") {
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
    if (!currentPage) return;

    if (!isLast) {
      const { error: validationError, errorFlags } = validatePage(currentPage);
      if (validationError) {
        setError(validationError);
        setQuestionErrors((prev) => ({ ...prev, ...errorFlags }));
        if (currentPage.kind === "section-body") {
          scrollToFirstError(errorFlags);
        }
        return;
      }
      startSlide(safeCurrentPageIndex + 1);
      return;
    }

    const errorFlags: Record<string, boolean> = {};
    for (const page of visiblePages) {
      const result = validatePage(page);
      Object.assign(errorFlags, result.errorFlags);
    }
    if (Object.keys(errorFlags).length > 0) {
      setQuestionErrors(errorFlags);
      const currentResult = validatePage(currentPage);
      setError(
        currentResult.error ??
          "Please go back and answer all required questions before submitting.",
      );
      if (currentPage.kind === "section-body") {
        scrollToFirstError(errorFlags);
      }
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
    if (safeCurrentPageIndex <= 0) {
      return;
    }
    startSlide(safeCurrentPageIndex - 1);
  }

  if (!displayPage || !currentPage) {
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

  const headerLabel = (() => {
    if (displayPage.kind === "section-body") {
      return (
        questions[displayPage.sectionIndex].prompt.trim() || "Section"
      );
    }
    if (isNonInputStep) {
      const question = questions[displayPage.questionIndex];
      return question.prompt.trim() || "Title";
    }
    if (answerableVisibleCount > 0) {
      return `Question ${answerableVisiblePos} of ${answerableVisibleCount}`;
    }
    return null;
  })();

  const singleQuestion =
    displayPage.kind === "single"
      ? questions[displayPage.questionIndex]
      : null;
  const sectionQuestion =
    displayPage.kind === "section-body"
      ? questions[displayPage.sectionIndex]
      : null;
  const sectionBodyQuestions =
    displayPage.kind === "section-body" ? displayQuestions : [];

  const sectionHasIncompleteNps =
    displayPage.kind === "section-body" &&
    sectionBodyQuestions.some(
      (question) =>
        question.type === "NPS" &&
        (answers[question.id] === undefined || answers[question.id] === null),
    );

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col px-4 py-10">
      <div className="mb-8">
        <p
          className="text-sm font-medium transition-opacity duration-300"
          style={{ color: "var(--theme-text-muted)" }}
        >
          {headerLabel}
        </p>
        <ProgressBar
          value={progress}
          total={visibleCount}
          currentIndex={safeCurrentPageIndex}
          onSeek={(pos) => {
            if (pos >= 0 && pos < visibleCount) {
              startSlide(pos);
            }
          }}
          disabled={isTransitioning || isSubmitting}
          questionErrors={visibleErrorFlags}
        />
      </div>

      <div className="flex flex-1 flex-col">
        <div key={pageKey(displayPage)} className={slideClass}>
          {isNpsOnlyPage && singleQuestion ? (
            <NpsFlow
              question={singleQuestion}
              anonymous={form.anonymous}
              onBack={handleBack}
              canGoBack={safeCurrentPageIndex > 0}
              onPromoterSubmit={(answer) =>
                handleNpsPromoterSubmit(answer, singleQuestion)
              }
              onDetractorComplete={(answer) =>
                handleNpsDetractorComplete(answer, singleQuestion)
              }
              isSubmitting={isSubmitting}
              score={npsScore}
              followUpText={npsFollowUpText}
              onScoreChange={setNpsScore}
              onFollowUpTextChange={setNpsFollowUpText}
            />
          ) : displayPage.kind === "section-body" && sectionQuestion ? (
            <SectionQuestionsPage
              section={sectionQuestion}
              questions={sectionBodyQuestions}
              answers={answers}
              onAnswer={setAnswer}
              questionErrors={questionErrors}
              anonymous={form.anonymous}
              npsQuestionId={
                sectionBodyQuestions.find((question) => question.type === "NPS")
                  ?.id ?? null
              }
              npsScore={npsScore}
              npsFollowUpText={npsFollowUpText}
              onNpsScoreChange={setNpsScore}
              onNpsFollowUpTextChange={setNpsFollowUpText}
              onNpsPromoterSubmit={(answer) => {
                const npsQuestion = sectionBodyQuestions.find(
                  (question) => question.type === "NPS",
                );
                if (!npsQuestion) return Promise.resolve({});
                return handleNpsPromoterSubmit(answer, npsQuestion);
              }}
              onNpsDetractorComplete={(answer) => {
                const npsQuestion = sectionBodyQuestions.find(
                  (question) => question.type === "NPS",
                );
                if (!npsQuestion) return Promise.resolve(false);
                return handleNpsDetractorComplete(answer, npsQuestion);
              }}
              onNpsBack={handleBack}
              canGoBack={safeCurrentPageIndex > 0}
              isSubmitting={isSubmitting}
            />
          ) : singleQuestion ? (
            <QuestionStep
              question={singleQuestion}
              value={answers[singleQuestion.id]}
              onChange={setCurrentAnswer}
            />
          ) : null}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {!isNpsOnlyPage && !sectionHasIncompleteNps && (
          <div className="sticky bottom-0 mt-auto flex items-center justify-between gap-4 bg-transparent pt-10 pb-2">
            <button
              type="button"
              onClick={handleBack}
              disabled={
                safeCurrentPageIndex <= 0 || isSubmitting || isTransitioning
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
              {isSubmitting
                ? "Submitting..."
                : isLast
                  ? "Submit"
                  : isNonInputStep
                    ? "Continue"
                    : "Next"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function questionIndicesOnPage(page: SurveyPage): number[] {
  if (page.kind === "single") {
    return [page.questionIndex];
  }
  return page.questionIndices;
}

function questionsOnPage(
  page: SurveyPage,
  questions: FormQuestion[],
): FormQuestion[] {
  return questionIndicesOnPage(page).map((index) => questions[index]);
}
