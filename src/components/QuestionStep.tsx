"use client";

import { useState } from "react";
import { formatFileSize, getAcceptAttribute } from "@/lib/attachments-shared";
import {
  emptyContactInfoAnswer,
  isContactInfoAnswer,
} from "@/lib/contact-info";
import type {
  ContactInfoAnswer,
  ContactInfoOptions,
  FormQuestion,
  HeatmapPoint,
  PointAllocationAnswer,
  PointAllocationOptions,
  SectionOptions,
  TitleCardOptions,
} from "@/lib/types";
import {
  emptyPointAllocationAnswer,
  isAttachmentAnswer,
  isAttachmentOptions,
  isChoiceListOptions,
  isHeatmapOptions,
  isHeatmapPoint,
  isPointAllocationAnswer,
  isPointAllocationOptions,
  isScaleOptions,
  isShortTextOptions,
  isSliderOptions,
  pointAllocationTotal,
} from "@/lib/types";
import { isSectionType, isTitleCardType } from "@/lib/question-types";
import { MarkdownContent } from "@/components/MarkdownContent";

type QuestionStepProps = {
  question: FormQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Compact stacked layout for multi-question section pages. */
  layout?: "page" | "stacked";
};

export function QuestionStep({
  question,
  value,
  onChange,
  layout = "page",
}: QuestionStepProps) {
  if (isSectionType(question.type)) {
    const description =
      question.options &&
      typeof question.options === "object" &&
      "description" in question.options
        ? String((question.options as SectionOptions).description ?? "")
        : "";

    return (
      <div className="py-4">
        <p
          className="text-sm font-medium uppercase tracking-wide"
          style={{ color: "var(--theme-text-muted)" }}
        >
          Section
        </p>
        <h2
          className="mt-3 text-3xl font-semibold leading-snug sm:text-4xl"
          style={{ color: "var(--theme-text)" }}
        >
          {question.prompt}
        </h2>
        {description.trim() ? (
          <div className="mt-4 text-base leading-relaxed sm:text-lg">
            <MarkdownContent content={description} themed />
          </div>
        ) : null}
      </div>
    );
  }

  if (isTitleCardType(question.type)) {
    const options = (question.options ?? {}) as TitleCardOptions;
    const description = options.description?.trim() ?? "";
    const links = options.links ?? [];

    return (
      <div className="py-4 text-center">
        <h2
          className="text-3xl font-semibold leading-snug sm:text-4xl"
          style={{ color: "var(--theme-text)" }}
        >
          {question.prompt}
        </h2>
        {description ? (
          <p
            className="mx-auto mt-4 max-w-lg text-base leading-relaxed sm:text-lg"
            style={{ color: "var(--theme-text-muted)" }}
          >
            {description}
          </p>
        ) : null}
        {links.length > 0 ? (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {links.map((link) => (
              <a
                key={`${link.label}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:opacity-90"
                style={{
                  backgroundColor: "var(--theme-primary)",
                  color: "var(--theme-primary-foreground)",
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const stacked = layout === "stacked";

  return (
    <div>
      <h2
        className={
          stacked
            ? "text-xl font-semibold leading-snug sm:text-2xl"
            : "text-2xl font-semibold leading-snug sm:text-3xl"
        }
        style={{ color: "var(--theme-text)" }}
      >
        {question.prompt}
      </h2>
      {!question.required && (
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--theme-text-muted)" }}
        >
          Optional
        </p>
      )}

      <div className={stacked ? "mt-5" : "mt-8"}>
        {question.type === "SCALE" && isScaleOptions(question.options) && (
          <ScaleInput
            options={question.options}
            value={typeof value === "number" ? value : undefined}
            onChange={onChange}
          />
        )}

        {question.type === "SLIDER" && isSliderOptions(question.options) && (
          <SliderInput
            options={question.options}
            value={typeof value === "number" ? value : question.options.min}
            onChange={onChange}
          />
        )}

        {question.type === "SINGLE_CHOICE" &&
          isChoiceListOptions(question.options) && (
            <SingleChoiceInput
              options={question.options}
              value={typeof value === "string" ? value : undefined}
              onChange={onChange}
            />
          )}

        {question.type === "MULTIPLE_CHOICE" &&
          isChoiceListOptions(question.options) && (
            <MultipleChoiceInput
              options={question.options}
              value={Array.isArray(value) ? value.filter((v) => typeof v === "string") : []}
              onChange={onChange}
            />
          )}

        {question.type === "SHORT_TEXT" && (
          <ShortTextInput
            options={isShortTextOptions(question.options) ? question.options : null}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
          />
        )}

        {question.type === "HEATMAP" && isHeatmapOptions(question.options) && (
          <HeatmapInput
            options={question.options}
            value={value}
            onChange={onChange}
          />
        )}

        {question.type === "ATTACHMENT" && (
          <AttachmentInput
            options={isAttachmentOptions(question.options) ? question.options : null}
            value={value}
            onChange={onChange}
          />
        )}

        {question.type === "CONTACT_INFO" && (
          <ContactInfoInput
            options={question.options as ContactInfoOptions | null}
            value={isContactInfoAnswer(value) ? value : emptyContactInfoAnswer()}
            onChange={onChange}
          />
        )}

        {question.type === "POINT_ALLOCATION" &&
          isPointAllocationOptions(question.options) && (
            <PointAllocationInput
              options={question.options}
              value={
                isPointAllocationAnswer(value)
                  ? value
                  : emptyPointAllocationAnswer(question.options)
              }
              onChange={onChange}
            />
          )}
      </div>
    </div>
  );
}

function PointAllocationInput({
  options,
  value,
  onChange,
}: {
  options: PointAllocationOptions;
  value: PointAllocationAnswer;
  onChange: (value: PointAllocationAnswer) => void;
}) {
  const allocated = pointAllocationTotal(value);
  const remaining = options.totalPoints - allocated;

  function setPoints(outcomeValue: string, nextPoints: number) {
    const clamped = Math.max(0, Math.min(options.totalPoints, nextPoints));
    const withoutCurrent = allocated - (value[outcomeValue] ?? 0);
    const maxAllowed = options.totalPoints - withoutCurrent;
    const points = Math.min(clamped, maxAllowed);

    onChange({
      ...value,
      [outcomeValue]: points,
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm leading-relaxed sm:text-base" style={{ color: "var(--theme-text-muted)" }}>
        Distribute {options.totalPoints} point{options.totalPoints === 1 ? "" : "s"}{" "}
        across the outcomes that matter most. More points = higher priority.
      </p>

      <div
        className="flex items-baseline justify-between gap-4 rounded-xl border px-4 py-3"
        style={{
          borderColor: "var(--theme-border, #d4d4d8)",
          backgroundColor: "var(--theme-surface, transparent)",
        }}
      >
        <span className="text-sm font-medium" style={{ color: "var(--theme-text-muted)" }}>
          Points remaining
        </span>
        <span
          className="text-2xl font-semibold tabular-nums"
          style={{
            color: remaining === 0 ? "var(--theme-primary)" : "var(--theme-text)",
          }}
        >
          {remaining}
        </span>
      </div>

      <ul className="space-y-3">
        {options.outcomes.map((outcome) => {
          const points = value[outcome.value] ?? 0;
          return (
            <li
              key={outcome.value}
              className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
              style={{ borderColor: "var(--theme-border, #d4d4d8)" }}
            >
              <span
                className="min-w-0 flex-1 text-sm font-medium sm:text-base"
                style={{ color: "var(--theme-text)" }}
              >
                {outcome.label}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPoints(outcome.value, points - 1)}
                  disabled={points <= 0}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg leading-none transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: "var(--theme-border, #d4d4d8)",
                    color: "var(--theme-text)",
                  }}
                  aria-label={`Decrease points for ${outcome.label}`}
                >
                  −
                </button>
                <span
                  className="w-8 text-center text-base font-semibold tabular-nums"
                  style={{ color: "var(--theme-text)" }}
                >
                  {points}
                </span>
                <button
                  type="button"
                  onClick={() => setPoints(outcome.value, points + 1)}
                  disabled={remaining <= 0}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg leading-none transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: "var(--theme-border, #d4d4d8)",
                    color: "var(--theme-text)",
                  }}
                  aria-label={`Increase points for ${outcome.label}`}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScaleInput({
  options,
  value,
  onChange,
}: {
  options: { min: number; max: number; minLabel?: string; maxLabel?: string };
  value?: number;
  onChange: (value: number) => void;
}) {
  const values = Array.from(
    { length: options.max - options.min + 1 },
    (_, index) => options.min + index,
  );

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {values.map((scaleValue) => {
          const selected = value === scaleValue;
          return (
            <button
              key={scaleValue}
              type="button"
              onClick={() => onChange(scaleValue)}
              className="flex h-12 w-12 items-center justify-center rounded-xl border text-base font-medium transition"
              style={
                selected
                  ? {
                      borderColor: "var(--theme-primary)",
                      backgroundColor: "var(--theme-primary)",
                      color: "var(--theme-primary-foreground)",
                    }
                  : {
                      borderColor: "var(--theme-border)",
                      backgroundColor: "var(--theme-surface)",
                      color: "var(--theme-text)",
                    }
              }
              aria-pressed={selected}
            >
              {scaleValue}
            </button>
          );
        })}
      </div>
      {(options.minLabel || options.maxLabel) && (
        <div
          className="mt-3 flex justify-between text-xs"
          style={{ color: "var(--theme-text-muted)" }}
        >
          <span>{options.minLabel}</span>
          <span>{options.maxLabel}</span>
        </div>
      )}
    </div>
  );
}

function SliderInput({
  options,
  value,
  onChange,
}: {
  options: {
    min: number;
    max: number;
    step?: number;
    minLabel?: string;
    maxLabel?: string;
  };
  value: number;
  onChange: (value: number) => void;
}) {
  const step = options.step ?? 1;

  return (
    <div>
      <div
        className="mb-4 text-center text-3xl font-semibold"
        style={{ color: "var(--theme-text)" }}
      >
        {value}
      </div>
      <input
        type="range"
        min={options.min}
        max={options.max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{
          backgroundColor: "var(--theme-progress-track)",
          accentColor: "var(--theme-primary)",
        }}
      />
      {(options.minLabel || options.maxLabel) && (
        <div
          className="mt-3 flex justify-between text-xs"
          style={{ color: "var(--theme-text-muted)" }}
        >
          <span>{options.minLabel ?? options.min}</span>
          <span>{options.maxLabel ?? options.max}</span>
        </div>
      )}
    </div>
  );
}

function SingleChoiceInput({
  options,
  value,
  onChange,
}: {
  options: { choices: { value: string; label: string }[] };
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.choices.map((choice) => {
        const selected = value === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => onChange(choice.value)}
            className="flex w-full items-center rounded-xl border px-4 py-3 text-left text-sm font-medium transition"
            style={
              selected
                ? {
                    borderColor: "var(--theme-primary)",
                    backgroundColor: "var(--theme-surface)",
                    color: "var(--theme-text)",
                  }
                : {
                    borderColor: "var(--theme-border)",
                    backgroundColor: "var(--theme-surface)",
                    color: "var(--theme-text)",
                  }
            }
            aria-pressed={selected}
          >
            <span
              className="mr-3 flex h-4 w-4 items-center justify-center rounded-full border"
              style={
                selected
                  ? { borderColor: "var(--theme-primary)" }
                  : { borderColor: "var(--theme-border)" }
              }
            >
              {selected && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: "var(--theme-primary)" }}
                />
              )}
            </span>
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

function MultipleChoiceInput({
  options,
  value,
  onChange,
}: {
  options: { choices: { value: string; label: string }[] };
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(choiceValue: string) {
    if (value.includes(choiceValue)) {
      onChange(value.filter((item) => item !== choiceValue));
      return;
    }
    onChange([...value, choiceValue]);
  }

  return (
    <div className="space-y-2">
      {options.choices.map((choice) => {
        const selected = value.includes(choice.value);
        return (
          <button
            key={choice.value}
            type="button"
            onClick={() => toggle(choice.value)}
            className="flex w-full items-center rounded-xl border px-4 py-3 text-left text-sm font-medium transition"
            style={
              selected
                ? {
                    borderColor: "var(--theme-primary)",
                    backgroundColor: "var(--theme-surface)",
                    color: "var(--theme-text)",
                  }
                : {
                    borderColor: "var(--theme-border)",
                    backgroundColor: "var(--theme-surface)",
                    color: "var(--theme-text)",
                  }
            }
            aria-pressed={selected}
          >
            <span
              className="mr-3 flex h-4 w-4 items-center justify-center rounded border"
              style={
                selected
                  ? {
                      borderColor: "var(--theme-primary)",
                      backgroundColor: "var(--theme-primary)",
                    }
                  : { borderColor: "var(--theme-border)" }
              }
            >
              {selected && (
                <span
                  className="text-[10px]"
                  style={{ color: "var(--theme-primary-foreground)" }}
                >
                  ✓
                </span>
              )}
            </span>
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

function ShortTextInput({
  options,
  value,
  onChange,
}: {
  options: { placeholder?: string; maxLength?: number } | null;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={options?.placeholder ?? "Type your answer..."}
      maxLength={options?.maxLength}
      rows={4}
      className="w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition placeholder:opacity-60"
      style={{
        borderColor: "var(--theme-border)",
        backgroundColor: "var(--theme-surface)",
        color: "var(--theme-text)",
      }}
    />
  );
}

function HeatmapInput({
  options,
  value,
  onChange,
}: {
  options: { imageUrl: string; alt?: string; maxClicks?: number };
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const maxClicks = options.maxClicks ?? 1;
  const points: HeatmapPoint[] = (() => {
    if (maxClicks === 1) {
      return isHeatmapPoint(value) ? [value] : [];
    }
    return Array.isArray(value) ? value.filter(isHeatmapPoint) : [];
  })();

  function handleImageClick(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const point: HeatmapPoint = {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    };

    if (maxClicks === 1) {
      onChange(point);
      return;
    }

    if (points.length >= maxClicks) {
      onChange([...points.slice(1), point]);
      return;
    }

    onChange([...points, point]);
  }

  return (
    <div>
      <p
        className="mb-3 text-sm"
        style={{ color: "var(--theme-text-muted)" }}
      >
        Click on the image to mark your answer
        {maxClicks > 1 ? ` (up to ${maxClicks} clicks)` : ""}.
      </p>
      <div
        className="relative cursor-crosshair overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--theme-border)" }}
        onClick={handleImageClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={options.alt ?? "Clickable heatmap image"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={options.imageUrl}
          alt={options.alt ?? ""}
          className="block w-full select-none"
          draggable={false}
        />
        {points.map((point, index) => (
          <span
            key={`${point.x}-${point.y}-${index}`}
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-red-500 shadow"
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          />
        ))}
      </div>
      {points.length > 0 && (
        <p
          className="mt-2 text-xs"
          style={{ color: "var(--theme-text-muted)" }}
        >
          {points
            .map((point) => `(${point.x}%, ${point.y}%)`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function AttachmentInput({
  options,
  value,
  onChange,
}: {
  options: { allowedKinds?: Array<"image" | "video" | "document">; maxSizeMb?: number } | null;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const selectedFile = value instanceof File ? value : null;
  const savedAttachment = isAttachmentAnswer(value) ? value : null;

  return (
    <div className="space-y-3">
      <label
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition hover:opacity-90"
        style={{
          borderColor: "var(--theme-border)",
          backgroundColor: "var(--theme-surface)",
          color: "var(--theme-text)",
        }}
      >
        <input
          type="file"
          accept={getAcceptAttribute(options)}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onChange(file);
          }}
        />
        <span className="text-sm font-medium">Choose a file</span>
        <span
          className="mt-1 text-xs"
          style={{ color: "var(--theme-text-muted)" }}
        >
          Images, videos, and documents are supported based on this question&apos;s settings.
        </span>
      </label>

      {selectedFile && (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--theme-border)",
            backgroundColor: "var(--theme-surface)",
            color: "var(--theme-text)",
          }}
        >
          <p className="font-medium">{selectedFile.name}</p>
          <p
            className="mt-1 text-xs"
            style={{ color: "var(--theme-text-muted)" }}
          >
            {selectedFile.type || "Unknown type"} · {formatFileSize(selectedFile.size)}
          </p>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="mt-3 text-xs font-medium underline underline-offset-2"
            style={{ color: "var(--theme-text-muted)" }}
          >
            Remove file
          </button>
        </div>
      )}

      {savedAttachment && (
        <p
          className="text-xs"
          style={{ color: "var(--theme-text-muted)" }}
        >
          Uploaded: {savedAttachment.filename}
        </p>
      )}
    </div>
  );
}

function ContactInfoInput({
  options,
  value,
  onChange,
}: {
  options: ContactInfoOptions | null;
  value: ContactInfoAnswer;
  onChange: (value: ContactInfoAnswer) => void;
}) {
  const inputStyle = {
    borderColor: "var(--theme-border)",
    backgroundColor: "var(--theme-surface)",
    color: "var(--theme-text)",
  };

  const companyMode = options?.companyMode ?? "free";
  const companies = options?.companies ?? [];
  const isDropdown = companyMode === "dropdown" && companies.length > 0;

  const [selectValue, setSelectValue] = useState<string>(() => {
    if (!isDropdown || value.businessName === "") return "";
    if (companies.includes(value.businessName)) return value.businessName;
    return "__other__";
  });

  const isOtherSelected = selectValue === "__other__";

  function updateField(field: keyof ContactInfoAnswer, fieldValue: string) {
    onChange({ ...value, [field]: fieldValue });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span
            className="mb-1 block text-sm font-medium"
            style={{ color: "var(--theme-text)" }}
          >
            First name
          </span>
          <input
            type="text"
            autoComplete="given-name"
            value={value.firstName}
            onChange={(event) => updateField("firstName", event.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <span
            className="mb-1 block text-sm font-medium"
            style={{ color: "var(--theme-text)" }}
          >
            Last name
          </span>
          <input
            type="text"
            autoComplete="family-name"
            value={value.lastName}
            onChange={(event) => updateField("lastName", event.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
            style={inputStyle}
          />
        </label>
      </div>
      <label className="block">
        <span
          className="mb-1 block text-sm font-medium"
          style={{ color: "var(--theme-text)" }}
        >
          Company email
        </span>
        <input
          type="email"
          autoComplete="email"
          value={value.email}
          onChange={(event) => updateField("email", event.target.value)}
          className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
          style={inputStyle}
        />
      </label>
      <div className="block">
        <span
          className="mb-1 block text-sm font-medium"
          style={{ color: "var(--theme-text)" }}
        >
          Business name
        </span>
        {isDropdown ? (
          <div className="space-y-2">
            <select
              value={selectValue}
              onChange={(event) => {
                const v = event.target.value;
                setSelectValue(v);
                if (v !== "__other__") updateField("businessName", v);
                else updateField("businessName", "");
              }}
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
              style={inputStyle}
            >
              <option value="" disabled>Select your company...</option>
              {companies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
              <option value="__other__">Other</option>
            </select>
            {isOtherSelected && (
              <input
                type="text"
                autoComplete="organization"
                value={value.businessName}
                onChange={(event) => updateField("businessName", event.target.value)}
                placeholder="Enter your company name"
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
                style={inputStyle}
              />
            )}
          </div>
        ) : (
          <input
            type="text"
            autoComplete="organization"
            value={value.businessName}
            onChange={(event) => updateField("businessName", event.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2"
            style={inputStyle}
          />
        )}
      </div>
    </div>
  );
}
