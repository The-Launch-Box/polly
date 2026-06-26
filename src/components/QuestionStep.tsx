"use client";

import type { FormQuestion, HeatmapPoint } from "@/lib/types";
import {
  isChoiceListOptions,
  isHeatmapOptions,
  isHeatmapPoint,
  isScaleOptions,
  isShortTextOptions,
  isSliderOptions,
} from "@/lib/types";

type QuestionStepProps = {
  question: FormQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
};

export function QuestionStep({ question, value, onChange }: QuestionStepProps) {
  return (
    <div>
      <h2 className="text-2xl font-semibold leading-snug text-zinc-900 sm:text-3xl">
        {question.prompt}
      </h2>
      {!question.required && (
        <p className="mt-2 text-sm text-zinc-500">Optional</p>
      )}

      <div className="mt-8">
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
      </div>
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
              className={`flex h-12 w-12 items-center justify-center rounded-xl border text-base font-medium transition ${
                selected
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
              }`}
              aria-pressed={selected}
            >
              {scaleValue}
            </button>
          );
        })}
      </div>
      {(options.minLabel || options.maxLabel) && (
        <div className="mt-3 flex justify-between text-xs text-zinc-500">
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
      <div className="mb-4 text-center text-3xl font-semibold text-zinc-900">
        {value}
      </div>
      <input
        type="range"
        min={options.min}
        max={options.max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900"
      />
      {(options.minLabel || options.maxLabel) && (
        <div className="mt-3 flex justify-between text-xs text-zinc-500">
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
            className={`flex w-full items-center rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
              selected
                ? "border-zinc-900 bg-zinc-50 text-zinc-900"
                : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
            }`}
            aria-pressed={selected}
          >
            <span
              className={`mr-3 flex h-4 w-4 items-center justify-center rounded-full border ${
                selected ? "border-zinc-900" : "border-zinc-400"
              }`}
            >
              {selected && <span className="h-2 w-2 rounded-full bg-zinc-900" />}
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
            className={`flex w-full items-center rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
              selected
                ? "border-zinc-900 bg-zinc-50 text-zinc-900"
                : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500"
            }`}
            aria-pressed={selected}
          >
            <span
              className={`mr-3 flex h-4 w-4 items-center justify-center rounded border ${
                selected ? "border-zinc-900 bg-zinc-900" : "border-zinc-400"
              }`}
            >
              {selected && <span className="text-[10px] text-white">✓</span>}
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
      className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900"
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
      <p className="mb-3 text-sm text-zinc-500">
        Click on the image to mark your answer
        {maxClicks > 1 ? ` (up to ${maxClicks} clicks)` : ""}.
      </p>
      <div
        className="relative cursor-crosshair overflow-hidden rounded-xl border border-zinc-300"
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
        <p className="mt-2 text-xs text-zinc-500">
          {points
            .map((point) => `(${point.x}%, ${point.y}%)`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
