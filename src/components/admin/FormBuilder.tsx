"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QuestionType } from "@prisma/client";
import {
  defaultOptionsForType,
  slugify,
  type FormInput,
  type FormQuestionInput,
} from "@/lib/form-create";
import { formatFileSize } from "@/lib/attachments-shared";
import { DEFAULT_THEME_ID } from "@/lib/company-themes";
import { ThemePicker } from "@/components/admin/ThemePicker";
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
} from "@/lib/types";

type QuestionDraft = FormQuestionInput & { key: string };

function createQuestionDraft(type: QuestionType = QuestionType.SCALE): QuestionDraft {
  return {
    key: crypto.randomUUID(),
    order: 0,
    type,
    prompt: "",
    required: true,
    options: defaultOptionsForType(type),
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
  };
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  [QuestionType.SCALE]: "Scale (1–5)",
  [QuestionType.SINGLE_CHOICE]: "Single choice",
  [QuestionType.MULTIPLE_CHOICE]: "Multiple choice",
  [QuestionType.SHORT_TEXT]: "Short text",
  [QuestionType.SLIDER]: "Slider",
  [QuestionType.HEATMAP]: "Heatmap",
  [QuestionType.ATTACHMENT]: "Attachment",
};

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
};

export function FormBuilder({
  mode = "create",
  originalSlug,
  initialData,
  submissionCount = 0,
}: FormBuilderProps) {
  const isEdit = mode === "edit";
  const router = useRouter();
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [themeId, setThemeId] = useState(initialData?.themeId ?? DEFAULT_THEME_ID);
  const [questions, setQuestions] = useState<QuestionDraft[]>(() =>
    initialData?.questions.length
      ? initialData.questions.map(createQuestionDraftFromExisting)
      : [createQuestionDraft()],
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      current.map((question) =>
        question.key === key
          ? {
              ...question,
              type,
              options: defaultOptionsForType(type),
            }
          : question,
      ),
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
      questions: questions.map((question, index) => ({
        ...(question.id ? { id: question.id } : {}),
        order: index + 1,
        type: question.type,
        prompt: question.prompt,
        required: question.required,
        options: question.options,
      })),
    };

    try {
      const response = await fetch(
        isEdit ? `/api/admin/forms/${originalSlug}` : "/api/admin/forms",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = (await response.json()) as {
        error?: string;
        errors?: Record<string, string>;
        slug?: string;
      };

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
    } catch {
      setError(
        isEdit
          ? "Could not save changes. Please try again."
          : "Could not create form. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
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

        <div className="mt-6 space-y-4">
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
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500"
          >
            Add question
          </button>
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
            errors={fieldErrors}
            onChange={(patch) => updateQuestion(question.key, patch)}
            onTypeChange={(type) => changeQuestionType(question.key, type)}
            onRemove={() => removeQuestion(question.key)}
            onMove={(direction) => moveQuestion(question.key, direction)}
          />
        ))}
      </section>

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
    </form>
  );
}

function QuestionEditor({
  index,
  question,
  total,
  errors,
  onChange,
  onTypeChange,
  onRemove,
  onMove,
}: {
  index: number;
  question: QuestionDraft;
  total: number;
  errors: Record<string, string>;
  onChange: (patch: Partial<QuestionDraft>) => void;
  onTypeChange: (type: QuestionType) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const prefix = `questions.${index}`;
  const promptError = errors[`${prefix}.prompt`];
  const optionsError = errors[`${prefix}.options`];

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Question {index + 1}
        </p>
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

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor={`type-${question.key}`}>
          <select
            id={`type-${question.key}`}
            value={question.type}
            onChange={(event) =>
              onTypeChange(event.target.value as QuestionType)
            }
            className={inputClass()}
          >
            {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
          onChange={(options) => onChange({ options })}
        />
        {optionsError && (
          <p className="mt-2 text-sm text-red-600">{optionsError}</p>
        )}
      </div>
    </article>
  );
}

function QuestionOptionsEditor({
  type,
  options,
  onChange,
}: {
  type: QuestionType;
  options: QuestionOptions;
  onChange: (options: QuestionOptions) => void;
}) {
  if (type === QuestionType.SCALE) {
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

  if (type === QuestionType.SINGLE_CHOICE || type === QuestionType.MULTIPLE_CHOICE) {
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
        {type === QuestionType.MULTIPLE_CHOICE && (
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

  if (type === QuestionType.SLIDER) {
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

  if (type === QuestionType.HEATMAP) {
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

  if (type === QuestionType.ATTACHMENT) {
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
                maxSizeMb: Number(event.target.value) || 25,
              })
            }
            className={inputClass()}
          />
        </Field>
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
