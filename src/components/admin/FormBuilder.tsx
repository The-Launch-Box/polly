"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionType } from "@/generated/prisma/enums";
import {
  defaultOptionsForType,
  slugify,
  type FormInput,
  type FormQuestionInput,
} from "@/lib/form-create";
import { formatFileSize } from "@/lib/attachments-shared";
import { DEFAULT_THEME_ID } from "@/lib/company-themes";
import {
  asQuestionType,
  isQuestionTypeValue,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_VALUES,
} from "@/lib/question-types";
import {
  getDefaultNpsPrompt,
  NPS_CONTACT_FIELD_LABELS,
} from "@/lib/nps";
import { DEFAULT_CONTACT_INFO_PROMPT } from "@/lib/contact-info";
import { ThemePicker } from "@/components/admin/ThemePicker";
import { WebhookSection, type WebhookInput } from "@/components/admin/WebhookSection";
import {
  BRANCH_OPERATOR_LABELS,
  operatorRequiresValue,
  operatorUsesChoiceValue,
  operatorsForType,
} from "@/lib/branching";
import type {
  QuestionOptions,
  ScaleOptions,
  SingleChoiceOptions,
  MultipleChoiceOptions,
  ShortTextOptions,
  SliderOptions,
  HeatmapOptions,
  AttachmentOptions,
  AttachmentKind,
  NpsOptions,
  NpsContactField,
  NpsLink,
  BranchCondition,
  BranchOperator,
  QuestionVisibility,
} from "@/lib/types";
import { isChoiceListOptions } from "@/lib/types";

type QuestionDraft = FormQuestionInput & { key: string };

function createQuestionDraft(type: QuestionType = "SCALE"): QuestionDraft {
  // A stable id is assigned up front (not just for saved questions) so branching
  // rules can reference this question even before the form is first saved.
  const id = crypto.randomUUID();
  return {
    key: id,
    id,
    order: 0,
    type,
    prompt: "",
    required: true,
    options: defaultOptionsForType(type),
    visibility: null,
  };
}

function createQuestionDraftFromExisting(question: FormQuestionInput): QuestionDraft {
  return {
    key: question.id ?? crypto.randomUUID(),
    id: question.id,
    order: question.order,
    type: question.type,
    prompt: question.prompt,
    required: question.required,
    options: question.options,
    visibility: question.visibility ?? null,
  };
}

const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  image: "Images",
  video: "Videos",
  document: "Documents",
};

type FormBuilderProps = {
  mode?: "create" | "edit";
  originalSlug?: string;
  initialData?: FormInput;
  submissionCount?: number;
  initialWebhooks?: WebhookInput[];
};

export function FormBuilder({
  mode = "create",
  originalSlug,
  initialData,
  submissionCount = 0,
  initialWebhooks = [],
}: FormBuilderProps) {
  const isEdit = mode === "edit";
  const router = useRouter();
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [themeId, setThemeId] = useState(initialData?.themeId ?? DEFAULT_THEME_ID);
  const [anonymous, setAnonymous] = useState(initialData?.anonymous ?? false);
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    initialData?.questions.length
      ? initialData.questions.map(createQuestionDraftFromExisting)
      : [createQuestionDraft()],
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  function toggleCollapsed(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function collapseAll() {
    setCollapsedKeys(new Set(questions.map((q) => q.key)));
  }

  function expandAll() {
    setCollapsedKeys(new Set());
  }

  useEffect(() => {
    function onScroll() {
      setShowScrollTop(window.scrollY > 300);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const previewUrl = useMemo(() => {
    const value = slug.trim();
    return value ? `/q/${value}` : "/q/your-slug";
  }, [slug]);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  function updateQuestion(key: string, patch: Partial<QuestionDraft>) {
    setQuestions((current) =>
      current.map((question) =>
        question.key === key ? { ...question, ...patch } : question,
      ),
    );
  }

  function changeQuestionType(key: string, type: QuestionType) {
    setQuestions((current) =>
      current.map((question) => {
        if (question.key !== key) {
          return question;
        }

        const options = defaultOptionsForType(type);
        return {
          ...question,
          type,
          options,
          ...(type === "NPS" && "firmName" in options
            ? {
                prompt: getDefaultNpsPrompt(
                  String((options as NpsOptions).firmName),
                ),
              }
            : {}),
          ...(type === "CONTACT_INFO"
            ? { prompt: DEFAULT_CONTACT_INFO_PROMPT }
            : {}),
        };
      }),
    );
  }

  function addQuestion() {
    setQuestions((current) => [...current, createQuestionDraft()]);
  }

  function removeQuestion(key: string) {
    setQuestions((current) =>
      current.length === 1 ? current : current.filter((q) => q.key !== key),
    );
  }

  function moveQuestion(key: string, direction: -1 | 1) {
    setQuestions((current) => {
      const index = current.findIndex((question) => question.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const payload: FormInput = {
      slug,
      title,
      description: description || null,
      themeId,
      anonymous,
      questions: questions.map((question, index) => {
        if (!isQuestionTypeValue(question.type)) {
          throw new Error(
            `Question ${index + 1} has an invalid type. Re-select its type and try again.`,
          );
        }

        return {
          ...(question.id ? { id: question.id } : {}),
          order: index + 1,
          type: question.type,
          prompt: question.prompt,
          required: question.required,
          options: question.options,
          visibility: question.visibility ?? null,
        };
      }),
    };

    try {
      const response = await fetch(
        isEdit ? `/api/admin/forms/${originalSlug}` : "/api/admin/forms",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        },
      );

      const rawBody = await response.text();
      let data: {
        error?: string;
        errors?: Record<string, string>;
        slug?: string;
      } = {};

      if (rawBody) {
        try {
          data = JSON.parse(rawBody) as typeof data;
        } catch {
          setError(
            `Server returned ${response.status} without a JSON response. Restart the dev server and try again.`,
          );
          return;
        }
      }

      if (!response.ok) {
        if (data.errors) {
          setFieldErrors(data.errors);
        }
        setError(
          data.error ??
            (isEdit ? "Could not save changes." : "Could not create form."),
        );
        return;
      }

      router.push(isEdit ? "/admin/forms" : `/q/${data.slug}`);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : isEdit
            ? "Could not save changes. Please try again."
            : "Could not create form. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Survey details</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Respondents will take the survey at{" "}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700">
              {previewUrl}
            </code>
          </p>
          {isEdit && submissionCount > 0 && (
            <p className="mt-2 text-sm text-amber-700">
              This survey has {submissionCount} submission
              {submissionCount === 1 ? "" : "s"}. Questions with existing
              responses cannot be removed.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
          <Field
            label="Title"
            htmlFor="title"
            error={fieldErrors.title}
            required
          >
            <input
              id="title"
              value={title}
              onChange={(event) => handleTitleChange(event.target.value)}
              className={inputClass(fieldErrors.title)}
              placeholder="How was the offsite?"
            />
          </Field>

          <Field
            label="URL slug"
            htmlFor="slug"
            error={fieldErrors.slug}
            required
            hint={
              isEdit
                ? "The public URL stays the same after publishing."
                : "Lowercase letters, numbers, and hyphens only."
            }
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-500">/q/</span>
              <input
                id="slug"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
                disabled={isEdit}
                className={`${inputClass(fieldErrors.slug)} disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500`}
                placeholder="offsite-feedback"
              />
            </div>
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            error={fieldErrors.description}
          >
            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className={inputClass(fieldErrors.description)}
              placeholder="Optional intro shown above the first question"
            />
          </Field>

          <ThemePicker
            value={themeId}
            onChange={setThemeId}
            error={fieldErrors.themeId}
          />

          <Field
            label="Anonymous responses"
            htmlFor="anonymous"
            hint="When enabled, no timing metadata or NPS contact details are stored. IP addresses, device info, and location are never recorded."
          >
            <label className="flex items-center gap-3 text-sm text-zinc-700">
              <input
                id="anonymous"
                type="checkbox"
                checked={anonymous}
                onChange={(event) => setAnonymous(event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Keep respondent identity private
            </label>
          </Field>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Questions</h2>
            <p className="text-sm text-zinc-500">
              One question per screen, in the order shown below.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {questions.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500"
                >
                  Collapse all
                </button>
                <button
                  type="button"
                  onClick={expandAll}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500"
                >
                  Expand all
                </button>
              </>
            )}
            <button
              type="button"
              onClick={addQuestion}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500"
            >
              Add question
            </button>
          </div>
        </div>

        {fieldErrors.questions && (
          <p className="text-sm text-red-600">{fieldErrors.questions}</p>
        )}

        {questions.map((question, index) => (
          <QuestionEditor
            key={question.key}
            index={index}
            question={question}
            total={questions.length}
            anonymous={anonymous}
            errors={fieldErrors}
            collapsed={collapsedKeys.has(question.key)}
            onToggleCollapse={() => toggleCollapsed(question.key)}
            precedingQuestions={questions.slice(0, index).map((q, i) => ({
              id: q.id ?? q.key,
              position: i + 1,
              prompt: q.prompt,
              type: q.type,
              options: q.options,
            }))}
            onChange={(patch) => updateQuestion(question.key, patch)}
            onTypeChange={(type) => changeQuestionType(question.key, type)}
            onRemove={() => removeQuestion(question.key)}
            onMove={(direction) => moveQuestion(question.key, direction)}
          />
        ))}

        {questions.length > 0 && (
          <button
            type="button"
            onClick={addQuestion}
            className="flex w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 py-3 text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-600"
          >
            <span className="text-xl leading-none">+</span>
          </button>
        )}
      </section>

      {isEdit && (
        <WebhookSection
          formSlug={originalSlug!}
          initialWebhooks={initialWebhooks}
        />
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
              ? "Save changes"
              : "Create survey"}
        </button>
        <p className="text-sm text-zinc-500">
          {isEdit
            ? "Changes apply immediately to the live survey."
            : "You'll be taken to the live survey when it's ready."}
        </p>
      </div>
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition hover:bg-zinc-700"
          aria-label="Scroll to top"
        >
          ↑
        </button>
      )}
    </form>
  );
}

type PrecedingQuestion = {
  id: string;
  position: number;
  prompt: string;
  type: QuestionType;
  options: QuestionOptions;
};

function QuestionEditor({
  index,
  question,
  total,
  anonymous,
  errors,
  collapsed,
  onToggleCollapse,
  precedingQuestions,
  onChange,
  onTypeChange,
  onRemove,
  onMove,
}: {
  index: number;
  question: QuestionDraft;
  total: number;
  anonymous: boolean;
  errors: Record<string, string>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  precedingQuestions: PrecedingQuestion[];
  onChange: (patch: Partial<QuestionDraft>) => void;
  onTypeChange: (type: QuestionType) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const prefix = `questions.${index}`;
  const promptError = errors[`${prefix}.prompt`];
  const optionsError = errors[`${prefix}.options`];
  const visibilityError = errors[`${prefix}.visibility`];
  const hasError = Object.keys(errors).some((k) => k.startsWith(prefix));

  const promptSummary = question.prompt.trim() || "(untitled)";

  const collapsedWithError = collapsed && hasError;

  return (
    <article className={`rounded-xl border bg-white shadow-sm ${collapsedWithError ? "border-red-300" : "border-zinc-200"}`}>
      <div className={`flex flex-wrap items-center justify-between gap-3 p-5 ${collapsedWithError ? "rounded-xl bg-red-50" : ""}`}>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={!collapsed}
        >
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Q{index + 1}
          </span>
          <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {QUESTION_TYPE_LABELS[question.type]}
          </span>
          {collapsed && (
            <span className="truncate text-sm text-zinc-700">
              {promptSummary}
            </span>
          )}
          <span
            className={`ml-auto shrink-0 text-xs text-zinc-400 transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? "" : "rotate-90"}`}
          >
            ▶
          </span>
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 disabled:opacity-40"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 disabled:opacity-40"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total === 1}
            className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>

      <div className={`question-body-grid${collapsed ? " collapsed" : ""}`}>
        <div>
        <div className="border-t border-zinc-100 px-5 pb-5 pt-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor={`type-${question.key}`}>
          <select
            id={`type-${question.key}`}
            value={question.type}
            onChange={(event) =>
              onTypeChange(asQuestionType(event.target.value))
            }
            className={inputClass()}
          >
            {QUESTION_TYPE_VALUES.map((value) => (
              <option key={value} value={value}>
                {QUESTION_TYPE_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Required" htmlFor={`required-${question.key}`}>
          <label className="flex h-10 items-center gap-2 text-sm text-zinc-700">
            <input
              id={`required-${question.key}`}
              type="checkbox"
              checked={question.required}
              onChange={(event) =>
                onChange({ required: event.target.checked })
              }
              className="h-4 w-4 rounded border-zinc-300"
            />
            Respondents must answer this question
          </label>
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Prompt"
          htmlFor={`prompt-${question.key}`}
          error={promptError}
          required
        >
          <input
            id={`prompt-${question.key}`}
            value={question.prompt}
            onChange={(event) => onChange({ prompt: event.target.value })}
            className={inputClass(promptError)}
            placeholder="What would you like to ask?"
          />
        </Field>
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <QuestionOptionsEditor
          type={question.type}
          options={question.options}
          anonymous={anonymous}
          onChange={(options) => onChange({ options })}
        />
        {optionsError && (
          <p className="mt-2 text-sm text-red-600">{optionsError}</p>
        )}
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <BranchingEditor
          visibility={question.visibility ?? null}
          precedingQuestions={precedingQuestions}
          error={visibilityError}
          onChange={(visibility) => onChange({ visibility })}
        />
        </div>
        </div>
        </div>
      </div>
    </article>
  );
}

const NO_PROMPT_LABEL = "(untitled question)";

function BranchingEditor({
  visibility,
  precedingQuestions,
  error,
  onChange,
}: {
  visibility: QuestionVisibility | null;
  precedingQuestions: PrecedingQuestion[];
  error?: string;
  onChange: (visibility: QuestionVisibility | null) => void;
}) {
  if (precedingQuestions.length === 0) {
    return (
      <div>
        <p className="text-sm font-medium text-zinc-800">Branching</p>
        <p className="mt-1 text-xs text-zinc-500">
          The first question is always shown. Add more questions above this one
          to make it appear only for certain answers.
        </p>
      </div>
    );
  }

  const conditions = visibility?.conditions ?? [];
  const match = visibility?.match ?? "all";
  const byId = new Map(precedingQuestions.map((q) => [q.id, q]));

  function emit(nextConditions: BranchCondition[], nextMatch = match) {
    if (nextConditions.length === 0) {
      onChange(null);
      return;
    }
    onChange({ match: nextMatch, conditions: nextConditions });
  }

  function defaultConditionFor(target: PrecedingQuestion): BranchCondition {
    const operator = operatorsForType(target.type)[0];
    const condition: BranchCondition = { questionId: target.id, operator };
    if (operatorRequiresValue(operator) && operatorUsesChoiceValue(target.type)) {
      const first = isChoiceListOptions(target.options)
        ? target.options.choices[0]
        : undefined;
      if (first) {
        condition.value = first.value;
      }
    }
    return condition;
  }

  function addCondition() {
    emit([...conditions, defaultConditionFor(precedingQuestions[0])]);
  }

  function updateCondition(index: number, patch: Partial<BranchCondition>) {
    const next = conditions.map((condition, i) =>
      i === index ? { ...condition, ...patch } : condition,
    );
    emit(next);
  }

  function changeTarget(index: number, questionId: string) {
    const target = byId.get(questionId);
    if (!target) return;
    const next = conditions.map((condition, i) =>
      i === index ? defaultConditionFor(target) : condition,
    );
    emit(next);
  }

  function changeOperator(index: number, operator: BranchOperator) {
    const condition = conditions[index];
    const target = byId.get(condition.questionId);
    const patch: Partial<BranchCondition> = { operator };
    if (!operatorRequiresValue(operator)) {
      patch.value = undefined;
    } else if (
      target &&
      operatorUsesChoiceValue(target.type) &&
      condition.value === undefined
    ) {
      const first = isChoiceListOptions(target.options)
        ? target.options.choices[0]
        : undefined;
      patch.value = first?.value;
    }
    updateCondition(index, patch);
  }

  function removeCondition(index: number) {
    emit(conditions.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-zinc-800">Branching</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Only show this question when earlier answers match.
          </p>
        </div>
        {conditions.length === 0 && (
          <button
            type="button"
            onClick={addCondition}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:border-zinc-500"
          >
            Add rule
          </button>
        )}
      </div>

      {conditions.length > 0 && (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          {conditions.length > 1 && (
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              Show this question when
              <select
                value={match}
                onChange={(event) =>
                  emit(conditions, event.target.value === "any" ? "any" : "all")
                }
                className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900"
              >
                <option value="all">all</option>
                <option value="any">any</option>
              </select>
              of these are true:
            </label>
          )}

          {conditions.map((condition, index) => {
            const target = byId.get(condition.questionId);
            const targetType = target?.type;
            const operators = targetType ? operatorsForType(targetType) : [];
            const choices =
              target && isChoiceListOptions(target.options)
                ? target.options.choices
                : [];
            const showValue = operatorRequiresValue(condition.operator);
            const useChoiceValue =
              targetType !== undefined && operatorUsesChoiceValue(targetType);
            const numericValue =
              targetType === "SCALE" ||
              targetType === "SLIDER" ||
              targetType === "NPS";

            return (
              <div
                key={index}
                className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start"
              >
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    value={condition.questionId}
                    onChange={(event) => changeTarget(index, event.target.value)}
                    className={inputClass()}
                    aria-label="Question"
                  >
                    {precedingQuestions.map((q) => (
                      <option key={q.id} value={q.id}>
                        Q{q.position}: {q.prompt.trim() || NO_PROMPT_LABEL}
                      </option>
                    ))}
                  </select>

                  <select
                    value={condition.operator}
                    onChange={(event) =>
                      changeOperator(index, event.target.value as BranchOperator)
                    }
                    className={inputClass()}
                    aria-label="Condition"
                  >
                    {operators.map((operator) => (
                      <option key={operator} value={operator}>
                        {BRANCH_OPERATOR_LABELS[operator]}
                      </option>
                    ))}
                  </select>

                  {showValue ? (
                    useChoiceValue ? (
                      <select
                        value={String(condition.value ?? "")}
                        onChange={(event) =>
                          updateCondition(index, { value: event.target.value })
                        }
                        className={inputClass()}
                        aria-label="Value"
                      >
                        <option value="">Select…</option>
                        {choices.map((choice) => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label || choice.value}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={numericValue ? "number" : "text"}
                        value={String(condition.value ?? "")}
                        onChange={(event) =>
                          updateCondition(index, {
                            value: numericValue
                              ? event.target.value === ""
                                ? undefined
                                : Number(event.target.value)
                              : event.target.value,
                          })
                        }
                        className={inputClass()}
                        placeholder="Value"
                        aria-label="Value"
                      />
                    )
                  ) : (
                    <div />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => removeCondition(index)}
                  className="rounded border border-zinc-200 px-3 py-2 text-xs text-zinc-600 hover:border-zinc-400"
                >
                  Remove
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addCondition}
            className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
          >
            Add condition
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function QuestionOptionsEditor({
  type,
  options,
  anonymous,
  onChange,
}: {
  type: QuestionType;
  options: QuestionOptions;
  anonymous: boolean;
  onChange: (options: QuestionOptions) => void;
}) {
  if (type === "SCALE") {
    const scale = options as ScaleOptions;
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Min" htmlFor="scale-min">
          <input
            id="scale-min"
            type="number"
            value={scale.min}
            onChange={(event) =>
              onChange({ ...scale, min: Number(event.target.value) })
            }
            className={inputClass()}
          />
        </Field>
        <Field label="Max" htmlFor="scale-max">
          <input
            id="scale-max"
            type="number"
            value={scale.max}
            onChange={(event) =>
              onChange({ ...scale, max: Number(event.target.value) })
            }
            className={inputClass()}
          />
        </Field>
        <Field label="Min label" htmlFor="scale-min-label">
          <input
            id="scale-min-label"
            value={scale.minLabel ?? ""}
            onChange={(event) =>
              onChange({ ...scale, minLabel: event.target.value })
            }
            className={inputClass()}
            placeholder="Not at all"
          />
        </Field>
        <Field label="Max label" htmlFor="scale-max-label">
          <input
            id="scale-max-label"
            value={scale.maxLabel ?? ""}
            onChange={(event) =>
              onChange({ ...scale, maxLabel: event.target.value })
            }
            className={inputClass()}
            placeholder="Very much"
          />
        </Field>
      </div>
    );
  }

  if (type === "SINGLE_CHOICE" || type === "MULTIPLE_CHOICE") {
    const choice = options as SingleChoiceOptions | MultipleChoiceOptions;
    return (
      <div className="space-y-3">
        {choice.choices.map((item, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={item.label}
              onChange={(event) => {
                const next = [...choice.choices];
                const label = event.target.value;
                next[index] = {
                  ...next[index],
                  label,
                  value:
                    next[index].value.startsWith("option-") ||
                    next[index].value === slugify(next[index].label)
                      ? slugify(label) || next[index].value
                      : next[index].value,
                };
                onChange({ choices: next });
              }}
              className={inputClass()}
              placeholder={`Choice ${index + 1} label`}
            />
            <input
              value={item.value}
              onChange={(event) => {
                const next = [...choice.choices];
                next[index] = { ...next[index], value: event.target.value };
                onChange({ choices: next });
              }}
              className={inputClass()}
              placeholder="value-slug"
            />
            <button
              type="button"
              onClick={() => {
                if (choice.choices.length <= 2) return;
                onChange({
                  choices: choice.choices.filter((_, i) => i !== index),
                });
              }}
              disabled={choice.choices.length <= 2}
              className="rounded border border-zinc-200 px-3 py-2 text-xs text-zinc-600 disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            onChange({
              choices: [
                ...choice.choices,
                {
                  value: `option-${choice.choices.length + 1}`,
                  label: `Option ${choice.choices.length + 1}`,
                },
              ],
            })
          }
          className="text-sm font-medium text-zinc-700 underline-offset-2 hover:underline"
        >
          Add choice
        </button>
        {type === "MULTIPLE_CHOICE" && (
          <div className="grid gap-4 border-t border-zinc-100 pt-4 sm:grid-cols-2">
            <Field label="Min selections" htmlFor="multi-min">
              <input
                id="multi-min"
                type="number"
                min={1}
                value={(choice as MultipleChoiceOptions).minSelections ?? ""}
                onChange={(event) =>
                  onChange({
                    ...choice,
                    minSelections: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
                className={inputClass()}
                placeholder="1"
              />
            </Field>
            <Field label="Max selections" htmlFor="multi-max">
              <input
                id="multi-max"
                type="number"
                min={1}
                value={(choice as MultipleChoiceOptions).maxSelections ?? ""}
                onChange={(event) =>
                  onChange({
                    ...choice,
                    maxSelections: event.target.value
                      ? Number(event.target.value)
                      : undefined,
                  })
                }
                className={inputClass()}
                placeholder="All"
              />
            </Field>
          </div>
        )}
      </div>
    );
  }

  if (type === "SLIDER") {
    const slider = options as SliderOptions;
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Min" htmlFor="slider-min">
          <input
            id="slider-min"
            type="number"
            value={slider.min}
            onChange={(event) =>
              onChange({ ...slider, min: Number(event.target.value) })
            }
            className={inputClass()}
          />
        </Field>
        <Field label="Max" htmlFor="slider-max">
          <input
            id="slider-max"
            type="number"
            value={slider.max}
            onChange={(event) =>
              onChange({ ...slider, max: Number(event.target.value) })
            }
            className={inputClass()}
          />
        </Field>
        <Field label="Step" htmlFor="slider-step">
          <input
            id="slider-step"
            type="number"
            min={0.01}
            step={0.01}
            value={slider.step ?? 1}
            onChange={(event) =>
              onChange({ ...slider, step: Number(event.target.value) })
            }
            className={inputClass()}
          />
        </Field>
        <Field label="Min label" htmlFor="slider-min-label">
          <input
            id="slider-min-label"
            value={slider.minLabel ?? ""}
            onChange={(event) =>
              onChange({ ...slider, minLabel: event.target.value })
            }
            className={inputClass()}
            placeholder="Low"
          />
        </Field>
        <Field label="Max label" htmlFor="slider-max-label">
          <input
            id="slider-max-label"
            value={slider.maxLabel ?? ""}
            onChange={(event) =>
              onChange({ ...slider, maxLabel: event.target.value })
            }
            className={inputClass()}
            placeholder="High"
          />
        </Field>
      </div>
    );
  }

  if (type === "HEATMAP") {
    const heatmap = options as HeatmapOptions;
    return (
      <div className="grid gap-4">
        <Field label="Image URL" htmlFor="heatmap-image" required>
          <input
            id="heatmap-image"
            value={heatmap.imageUrl}
            onChange={(event) =>
              onChange({ ...heatmap, imageUrl: event.target.value })
            }
            className={inputClass()}
            placeholder="https://example.com/image.jpg"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Alt text" htmlFor="heatmap-alt">
            <input
              id="heatmap-alt"
              value={heatmap.alt ?? ""}
              onChange={(event) =>
                onChange({ ...heatmap, alt: event.target.value })
              }
              className={inputClass()}
              placeholder="Describe the image"
            />
          </Field>
          <Field label="Max clicks" htmlFor="heatmap-max-clicks">
            <input
              id="heatmap-max-clicks"
              type="number"
              min={1}
              value={heatmap.maxClicks ?? 1}
              onChange={(event) =>
                onChange({
                  ...heatmap,
                  maxClicks: Number(event.target.value) || 1,
                })
              }
              className={inputClass()}
            />
          </Field>
        </div>
      </div>
    );
  }

  if (type === "ATTACHMENT") {
    const attachment = options as AttachmentOptions;
    const allowedKinds = attachment.allowedKinds ?? ["image", "video", "document"];
    return (
      <div className="grid gap-4">
        <Field
          label="Allowed file types"
          hint="Respondents can upload one file that matches one of the selected categories."
        >
          <div className="flex flex-wrap gap-3">
            {(["image", "video", "document"] as AttachmentKind[]).map((kind) => {
              const checked = allowedKinds.includes(kind);
              return (
                <label
                  key={kind}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...allowedKinds, kind]
                        : allowedKinds.filter((item) => item !== kind);
                      onChange({
                        ...attachment,
                        allowedKinds: next,
                      });
                    }}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  {ATTACHMENT_KIND_LABELS[kind]}
                </label>
              );
            })}
          </div>
        </Field>
        <Field
          label="Max file size (MB)"
          htmlFor="attachment-max-size"
          hint={`Current limit: ${formatFileSize((attachment.maxSizeMb ?? 25) * 1024 * 1024)}`}
        >
          <input
            id="attachment-max-size"
            type="number"
            min={1}
            value={attachment.maxSizeMb ?? 25}
            onChange={(event) =>
              onChange({
                ...attachment,
                maxSizeMb: Math.max(1, Math.round(Number(event.target.value) || 25)),
              })
            }
            className={inputClass()}
          />
        </Field>
      </div>
    );
  }

  if (type === "NPS") {
    const nps = options as NpsOptions;
    const contactFields = nps.contactFields ?? ["name", "email", "company"];
    const closingLinks = nps.closingLinks ?? [];

    return (
      <div className="grid gap-6">
        <Field
          label="Firm name"
          htmlFor="nps-firm-name"
          hint="Used in the default NPS question text. You can still customize the prompt above."
        >
          <input
            id="nps-firm-name"
            value={nps.firmName}
            onChange={(event) =>
              onChange({ ...nps, firmName: event.target.value })
            }
            className={inputClass()}
            placeholder="Blue Trail Digital"
          />
        </Field>

        <Field
          label="Promoter redirect URL"
          htmlFor="nps-promoter-url"
          hint="Respondents who score 10 are sent here after submitting contact info (e.g. your G2 review page)."
        >
          <input
            id="nps-promoter-url"
            type="url"
            value={nps.promoterRedirectUrl ?? ""}
            onChange={(event) =>
              onChange({ ...nps, promoterRedirectUrl: event.target.value })
            }
            className={inputClass()}
            placeholder="https://www.g2.com/products/..."
          />
        </Field>

        <Field
          label="Contact fields for score 10"
          hint={
            anonymous
              ? "Disabled while anonymous responses are enabled for this survey."
              : "Collected before redirecting promoters to leave a review."
          }
        >
          <div className="flex flex-wrap gap-3">
            {(["name", "email", "company", "title"] as NpsContactField[]).map(
              (field) => {
                const checked = contactFields.includes(field);
                return (
                  <label
                    key={field}
                    className={`flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 ${anonymous ? "opacity-50" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={anonymous}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...contactFields, field]
                          : contactFields.filter((item) => item !== field);
                        onChange({ ...nps, contactFields: next });
                      }}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                    {NPS_CONTACT_FIELD_LABELS[field]}
                  </label>
                );
              },
            )}
          </div>
        </Field>

        <Field label="Follow-up prompt (scores 0–9)" htmlFor="nps-follow-up">
          <textarea
            id="nps-follow-up"
            value={nps.followUpPrompt ?? ""}
            onChange={(event) =>
              onChange({ ...nps, followUpPrompt: event.target.value })
            }
            rows={3}
            className={inputClass()}
          />
        </Field>

        <div className="rounded-xl border border-zinc-200 p-4">
          <h4 className="text-sm font-semibold text-zinc-900">
            Closing slide (scores 0–9)
          </h4>
          <p className="mt-1 text-sm text-zinc-500">
            Shown after follow-up feedback is submitted.
          </p>
          <div className="mt-4 grid gap-4">
            <Field label="Logo image URL" htmlFor="nps-closing-logo">
              <input
                id="nps-closing-logo"
                type="url"
                value={nps.closingLogoUrl ?? ""}
                onChange={(event) =>
                  onChange({ ...nps, closingLogoUrl: event.target.value })
                }
                className={inputClass()}
                placeholder="https://..."
              />
            </Field>
            <Field label="Closing title" htmlFor="nps-closing-title">
              <input
                id="nps-closing-title"
                value={nps.closingTitle ?? ""}
                onChange={(event) =>
                  onChange({ ...nps, closingTitle: event.target.value })
                }
                className={inputClass()}
              />
            </Field>
            <Field label="Closing message" htmlFor="nps-closing-body">
              <textarea
                id="nps-closing-body"
                value={nps.closingBody ?? ""}
                onChange={(event) =>
                  onChange({ ...nps, closingBody: event.target.value })
                }
                rows={4}
                className={inputClass()}
              />
            </Field>
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-700">Links</p>
              {closingLinks.map((link, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    value={link.label}
                    onChange={(event) => {
                      const next = [...closingLinks];
                      next[index] = { ...next[index], label: event.target.value };
                      onChange({ ...nps, closingLinks: next });
                    }}
                    className={inputClass()}
                    placeholder="LinkedIn"
                  />
                  <input
                    value={link.url}
                    onChange={(event) => {
                      const next = [...closingLinks];
                      next[index] = { ...next[index], url: event.target.value };
                      onChange({ ...nps, closingLinks: next });
                    }}
                    className={inputClass()}
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = closingLinks.filter((_, i) => i !== index);
                      onChange({ ...nps, closingLinks: next });
                    }}
                    className="rounded border border-zinc-200 px-3 py-2 text-sm text-zinc-600"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next: NpsLink[] = [
                    ...closingLinks,
                    { label: "", url: "" },
                  ];
                  onChange({ ...nps, closingLinks: next });
                }}
                className="text-sm font-medium text-zinc-700 underline"
              >
                Add link
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "CONTACT_INFO") {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">Fields included</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>First and last name</li>
          <li>Company email</li>
          <li>Business name</li>
        </ul>
        {anonymous && (
          <p className="mt-3 text-amber-700">
            Contact information questions are not allowed while anonymous
            responses are enabled.
          </p>
        )}
      </div>
    );
  }

  const text = options as ShortTextOptions;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Placeholder" htmlFor="text-placeholder">
        <input
          id="text-placeholder"
          value={text.placeholder ?? ""}
          onChange={(event) =>
            onChange({ ...text, placeholder: event.target.value })
          }
          className={inputClass()}
          placeholder="Type your answer..."
        />
      </Field>
      <Field label="Max length" htmlFor="text-max-length">
        <input
          id="text-max-length"
          type="number"
          value={text.maxLength ?? ""}
          onChange={(event) =>
            onChange({
              ...text,
              maxLength: event.target.value
                ? Number(event.target.value)
                : undefined,
            })
          }
          className={inputClass()}
          placeholder="500"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="text-sm font-medium text-zinc-800">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

function inputClass(error?: string) {
  return `w-full rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 ${
    error ? "border-red-300" : "border-zinc-300"
  }`;
}
