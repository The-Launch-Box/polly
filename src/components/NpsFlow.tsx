"use client";

import { useMemo, useState } from "react";
import type { FormQuestion, NpsAnswer, NpsContactField, NpsOptions } from "@/lib/types";
import { isNpsOptions } from "@/lib/types";
import {
  buildNpsAnswer,
  getNpsContactFields,
  getNpsFollowUpPrompt,
  getNpsPrompt,
  isPromoterScore,
  NPS_CONTACT_FIELD_LABELS,
  NPS_MAX_SCORE,
  NPS_MIN_SCORE,
  validateNpsContact,
} from "@/lib/nps";

type NpsStep = "score" | "contact" | "followup" | "closing";

type NpsFlowProps = {
  question: FormQuestion;
  anonymous: boolean;
  onBack: () => void;
  canGoBack: boolean;
  onPromoterSubmit: (answer: NpsAnswer) => Promise<{ redirectUrl?: string }>;
  onDetractorComplete: (answer: NpsAnswer) => Promise<boolean>;
  isSubmitting: boolean;
  score: number | null;
  followUpText: string;
  onScoreChange: (score: number) => void;
  onFollowUpTextChange: (text: string) => void;
};

export function NpsFlow({
  question,
  anonymous,
  onBack,
  canGoBack,
  onPromoterSubmit,
  onDetractorComplete,
  isSubmitting,
  score,
  followUpText,
  onScoreChange,
  onFollowUpTextChange,
}: NpsFlowProps) {
  const options = isNpsOptions(question.options) ? question.options : null;
  const [step, setStep] = useState<NpsStep>("score");
  const [contact, setContact] = useState<Partial<Record<NpsContactField, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const prompt = useMemo(() => {
    if (!options) {
      return question.prompt;
    }
    return getNpsPrompt(question.prompt, options);
  }, [options, question.prompt]);

  const contactFields = useMemo(
    () => (options ? getNpsContactFields(options) : ["name", "email"]),
    [options],
  );

  if (!options) {
    return (
      <p className="text-sm text-red-600" role="alert">
        This NPS question is misconfigured.
      </p>
    );
  }

  async function handleScoreNext() {
    if (score === null) {
      setError("Please select a score before continuing.");
      return;
    }

    setError(null);
    if (isPromoterScore(score)) {
      if (anonymous) {
        const answer = buildNpsAnswer({ score });
        await onPromoterSubmit(answer);
        return;
      }
      setStep("contact");
      return;
    }

    setStep("followup");
  }

  async function handleContactSubmit() {
    if (score === null) {
      return;
    }

    const contactError = validateNpsContact(contact, contactFields);
    if (contactError) {
      setError(contactError);
      return;
    }

    setError(null);
    const answer = buildNpsAnswer({ score, contact });
    await onPromoterSubmit(answer);
  }

  async function handleFollowUpNext() {
    if (score === null) {
      return;
    }

    setError(null);
    setStep("closing");
  }

  function handleBack() {
    setError(null);
    if (step === "score") {
      onBack();
      return;
    }
    if (step === "contact" || step === "followup") {
      setStep("score");
    }
  }

  const primaryLabel =
    step === "score"
      ? "Next"
      : step === "contact"
        ? isSubmitting
          ? "Submitting..."
          : "Submit"
        : step === "followup"
          ? isSubmitting
            ? "Submitting..."
            : "Continue"
          : "Done";

  const showBack = step === "score" ? canGoBack : step !== "closing";

  async function handlePrimary() {
    if (step === "score") {
      await handleScoreNext();
      return;
    }
    if (step === "contact") {
      await handleContactSubmit();
      return;
    }
    if (step === "followup") {
      await handleFollowUpNext();
    }
  }

  return (
    <div>
      {step === "closing" ? (
        <>
          <NpsClosingSlide options={options} completed={completed} />
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={async () => {
                if (score === null || completed) {
                  return;
                }
                setError(null);
                const answer = buildNpsAnswer({ score, followUpText });
                const ok = await onDetractorComplete(answer);
                if (ok) {
                  setCompleted(true);
                }
              }}
              disabled={isSubmitting || completed}
              className="rounded-lg px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor: "var(--theme-primary)",
                color: "var(--theme-primary-foreground)",
              }}
            >
              {isSubmitting ? "Submitting..." : completed ? "Submitted" : "Done"}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2
            className="text-2xl font-semibold leading-snug sm:text-3xl"
            style={{ color: "var(--theme-text)" }}
          >
            {step === "followup" ? getNpsFollowUpPrompt(options) : prompt}
          </h2>

          {step === "followup" && (
            <p className="mt-2 text-sm" style={{ color: "var(--theme-text-muted)" }}>
              Optional
            </p>
          )}

          <div className="mt-8">
            {step === "score" && (
              <NpsScoreInput value={score} onChange={onScoreChange} />
            )}

            {step === "contact" && (
              <NpsContactForm
                fields={contactFields}
                values={contact}
                onChange={setContact}
              />
            )}

            {step === "followup" && (
              <textarea
                value={followUpText}
                onChange={(event) => onFollowUpTextChange(event.target.value)}
                rows={5}
                placeholder="Share any feedback that could help us improve..."
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                style={{
                  borderColor: "var(--theme-border)",
                  backgroundColor: "var(--theme-surface)",
                  color: "var(--theme-text)",
                }}
              />
            )}
          </div>
        </>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {step !== "closing" && (
        <div className="mt-10 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={!showBack || isSubmitting}
            className="rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ color: "var(--theme-text-muted)" }}
          >
            Back
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={isSubmitting}
            className="rounded-lg px-6 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: "var(--theme-primary)",
              color: "var(--theme-primary-foreground)",
            }}
          >
            {primaryLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function NpsScoreInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number) => void;
}) {
  const scores = Array.from(
    { length: NPS_MAX_SCORE - NPS_MIN_SCORE + 1 },
    (_, index) => NPS_MIN_SCORE + index,
  );

  return (
    <div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {scores.map((scoreValue) => {
          const selected = value === scoreValue;
          return (
            <button
              key={scoreValue}
              type="button"
              onClick={() => onChange(scoreValue)}
              className="rounded-xl border px-2 py-3 text-sm font-semibold transition hover:opacity-90"
              style={{
                borderColor: selected
                  ? "var(--theme-primary)"
                  : "var(--theme-border)",
                backgroundColor: selected
                  ? "var(--theme-primary)"
                  : "var(--theme-surface)",
                color: selected
                  ? "var(--theme-primary-foreground)"
                  : "var(--theme-text)",
              }}
            >
              {scoreValue}
            </button>
          );
        })}
      </div>
      <div
        className="mt-3 flex justify-between text-xs"
        style={{ color: "var(--theme-text-muted)" }}
      >
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
    </div>
  );
}

function NpsContactForm({
  fields,
  values,
  onChange,
}: {
  fields: NpsContactField[];
  values: Partial<Record<NpsContactField, string>>;
  onChange: (values: Partial<Record<NpsContactField, string>>) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--theme-text-muted)" }}>
        We&apos;d love for you to share a review. Please leave your contact
        information so we can follow up.
      </p>
      {fields.map((field) => (
        <label key={field} className="block">
          <span
            className="mb-1 block text-sm font-medium"
            style={{ color: "var(--theme-text)" }}
          >
            {NPS_CONTACT_FIELD_LABELS[field]}
          </span>
          <input
            type={field === "email" ? "email" : "text"}
            value={values[field] ?? ""}
            onChange={(event) =>
              onChange({ ...values, [field]: event.target.value })
            }
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
            style={{
              borderColor: "var(--theme-border)",
              backgroundColor: "var(--theme-surface)",
              color: "var(--theme-text)",
            }}
          />
        </label>
      ))}
    </div>
  );
}

function NpsClosingSlide({
  options,
  completed,
}: {
  options: NpsOptions;
  completed: boolean;
}) {
  const title = options.closingTitle?.trim() || "Thanks for the feedback!";
  const body =
    options.closingBody?.trim() ||
    "Follow us on LinkedIn or subscribe to our newsletter.";
  const links = options.closingLinks ?? [];

  return (
    <div className="text-center">
      {options.closingLogoUrl && (
        <img
          src={options.closingLogoUrl}
          alt=""
          className="mx-auto mb-6 h-16 w-auto max-w-[200px] object-contain"
        />
      )}
      <h2
        className="text-2xl font-semibold leading-snug sm:text-3xl"
        style={{ color: "var(--theme-text)" }}
      >
        {title}
      </h2>
      <p
        className="mx-auto mt-4 max-w-lg whitespace-pre-line text-sm leading-relaxed"
        style={{ color: "var(--theme-text-muted)" }}
      >
        {body}
      </p>
      {links.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {links.map((link) => (
            <a
              key={`${link.label}-${link.url}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-90"
              style={{
                backgroundColor: "var(--theme-primary)",
                color: "var(--theme-primary-foreground)",
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
      {completed && (
        <p className="mt-6 text-sm" style={{ color: "var(--theme-text-muted)" }}>
          Your response has been recorded.
        </p>
      )}
    </div>
  );
}
