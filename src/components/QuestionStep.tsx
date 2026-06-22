"use client";

import type { FormQuestion } from "@/lib/types";
import {
  isScaleOptions,
  isShortTextOptions,
  isSingleChoiceOptions,
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

        {question.type === "SINGLE_CHOICE" &&
          isSingleChoiceOptions(question.options) && (
            <SingleChoiceInput
              options={question.options}
              value={typeof value === "string" ? value : undefined}
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
