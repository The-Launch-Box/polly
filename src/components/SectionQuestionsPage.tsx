"use client";

import { useEffect, useRef } from "react";
import { NpsFlow } from "@/components/NpsFlow";
import { QuestionStep } from "@/components/QuestionStep";
import { MarkdownContent } from "@/components/MarkdownContent";
import type { FormQuestion, NpsAnswer, SectionOptions } from "@/lib/types";
import {
  hasAnswerValue,
  shouldAutoAdvanceOnAnswer,
} from "@/lib/survey-pages";

type SectionQuestionsPageProps = {
  section: FormQuestion;
  questions: FormQuestion[];
  answers: Record<string, unknown>;
  onAnswer: (questionId: string, value: unknown) => void;
  questionErrors: Record<string, boolean>;
  /** NPS-only props — used when a section contains an NPS question. */
  anonymous: boolean;
  npsQuestionId: string | null;
  npsScore: number | null;
  npsFollowUpText: string;
  onNpsScoreChange: (score: number) => void;
  onNpsFollowUpTextChange: (text: string) => void;
  onNpsPromoterSubmit: (answer: NpsAnswer) => Promise<{ redirectUrl?: string }>;
  onNpsDetractorComplete: (answer: NpsAnswer) => Promise<boolean>;
  onNpsBack: () => void;
  canGoBack: boolean;
  isSubmitting: boolean;
};

export function SectionQuestionsPage({
  section,
  questions,
  answers,
  onAnswer,
  questionErrors,
  anonymous,
  npsQuestionId,
  npsScore,
  npsFollowUpText,
  onNpsScoreChange,
  onNpsFollowUpTextChange,
  onNpsPromoterSubmit,
  onNpsDetractorComplete,
  onNpsBack,
  canGoBack,
  isSubmitting,
}: SectionQuestionsPageProps) {
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const description =
    section.options &&
    typeof section.options === "object" &&
    "description" in section.options
      ? String((section.options as SectionOptions).description ?? "").trim()
      : "";

  useEffect(() => {
    // Land at the top of the section when the page first appears.
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [section.id]);

  function scrollToQuestion(questionId: string) {
    const el = itemRefs.current.get(questionId);
    if (!el) return;
    // Leave room for sticky header/footer chrome.
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function handleAnswer(question: FormQuestion, value: unknown) {
    const wasAnswered = hasAnswerValue(question, answers[question.id]);
    onAnswer(question.id, value);

    if (!shouldAutoAdvanceOnAnswer(question.type)) {
      return;
    }
    if (wasAnswered) {
      return;
    }
    if (!hasAnswerValue(question, value)) {
      return;
    }

    const index = questions.findIndex((item) => item.id === question.id);
    if (index === -1 || index >= questions.length - 1) {
      return;
    }

    const next = questions[index + 1];
    // Defer so the answer paint lands before scrolling.
    requestAnimationFrame(() => {
      scrollToQuestion(next.id);
    });
  }

  return (
    <div className="space-y-10 pb-4">
      <header className="border-b pb-6" style={{ borderColor: "var(--theme-border)" }}>
        <p
          className="text-sm font-medium uppercase tracking-wide"
          style={{ color: "var(--theme-text-muted)" }}
        >
          Section
        </p>
        <h2
          className="mt-2 text-2xl font-semibold leading-snug sm:text-3xl"
          style={{ color: "var(--theme-text)" }}
        >
          {section.prompt}
        </h2>
        {description ? (
          <div className="mt-3 text-base leading-relaxed">
            <MarkdownContent content={description} themed />
          </div>
        ) : null}
      </header>

      <ol className="space-y-12">
        {questions.map((question, index) => {
          const isNps = question.type === "NPS";
          const showNpsFlow = isNps && npsQuestionId === question.id;
          const hasError = questionErrors[question.id] ?? false;

          return (
            <li
              key={question.id}
              ref={(node) => {
                if (node) {
                  itemRefs.current.set(question.id, node);
                } else {
                  itemRefs.current.delete(question.id);
                }
              }}
              id={`survey-q-${question.id}`}
              className="scroll-mt-24"
            >
              <div className="flex gap-3 sm:gap-4">
                <span
                  className="mt-1 shrink-0 text-sm font-medium tabular-nums"
                  style={{ color: "var(--theme-text-muted)" }}
                  aria-hidden="true"
                >
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  {hasError ? (
                    <p className="mb-2 text-xs font-medium text-red-600">
                      Needs an answer
                    </p>
                  ) : null}
                  {showNpsFlow ? (
                    <NpsFlow
                      question={question}
                      anonymous={anonymous}
                      onBack={onNpsBack}
                      canGoBack={canGoBack || index > 0}
                      onPromoterSubmit={onNpsPromoterSubmit}
                      onDetractorComplete={onNpsDetractorComplete}
                      isSubmitting={isSubmitting}
                      score={npsScore}
                      followUpText={npsFollowUpText}
                      onScoreChange={onNpsScoreChange}
                      onFollowUpTextChange={onNpsFollowUpTextChange}
                    />
                  ) : (
                    <QuestionStep
                      question={question}
                      value={answers[question.id]}
                      onChange={(value) => handleAnswer(question, value)}
                      layout="stacked"
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
