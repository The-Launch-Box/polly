"use client";

import { useState } from "react";

export type WebhookInput = {
  id: string;
  name: string;
  url: string;
  includeAnswers: boolean;
  secret: string | null;
};

type WebhookDraft = {
  key: string;
  id?: string;
  name: string;
  url: string;
  includeAnswers: boolean;
  secret: string;
  secretVisible: boolean;
  isSaving: boolean;
  fieldErrors: Record<string, string>;
  error: string | null;
};

function createDraftFromExisting(webhook: WebhookInput): WebhookDraft {
  return {
    key: webhook.id,
    id: webhook.id,
    name: webhook.name,
    url: webhook.url,
    includeAnswers: webhook.includeAnswers,
    secret: webhook.secret ?? "",
    secretVisible: false,
    isSaving: false,
    fieldErrors: {},
    error: null,
  };
}

function createNewDraft(): WebhookDraft {
  return {
    key: crypto.randomUUID(),
    name: "",
    url: "",
    includeAnswers: false,
    secret: "",
    secretVisible: false,
    isSaving: false,
    fieldErrors: {},
    error: null,
  };
}

function generateSecret(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type WebhookSectionProps = {
  formSlug: string;
  initialWebhooks: WebhookInput[];
};

export function WebhookSection({ formSlug, initialWebhooks }: WebhookSectionProps) {
  const [webhooks, setWebhooks] = useState<WebhookDraft[]>(() =>
    initialWebhooks.map(createDraftFromExisting),
  );

  function addWebhook() {
    setWebhooks((current) => [...current, createNewDraft()]);
  }

  function updateWebhook(key: string, patch: Partial<WebhookDraft>) {
    setWebhooks((current) =>
      current.map((wh) => (wh.key === key ? { ...wh, ...patch } : wh)),
    );
  }

  async function saveWebhook(key: string) {
    const wh = webhooks.find((w) => w.key === key);
    if (!wh) return;

    updateWebhook(key, { isSaving: true, fieldErrors: {}, error: null });

    const body = {
      name: wh.name,
      url: wh.url,
      includeAnswers: wh.includeAnswers,
      secret: wh.secret || null,
    };

    try {
      const endpoint = wh.id
        ? `/api/admin/forms/${formSlug}/webhooks/${wh.id}`
        : `/api/admin/forms/${formSlug}/webhooks`;
      const method = wh.id ? "PATCH" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });

      const rawBody = await response.text();
      let data: { id?: string; error?: string; errors?: Record<string, string> } = {};
      if (rawBody) {
        try {
          data = JSON.parse(rawBody) as typeof data;
        } catch {
          updateWebhook(key, {
            isSaving: false,
            error: `Server returned ${response.status} without a JSON response.`,
          });
          return;
        }
      }

      if (!response.ok) {
        updateWebhook(key, {
          isSaving: false,
          fieldErrors: data.errors ?? {},
          error: data.error ?? "Could not save webhook.",
        });
        return;
      }

      if (!wh.id && data.id) {
        setWebhooks((current) =>
          current.map((w) =>
            w.key === key
              ? { ...w, id: data.id, isSaving: false, error: null }
              : w,
          ),
        );
      } else {
        updateWebhook(key, { isSaving: false, error: null });
      }
    } catch (err) {
      updateWebhook(key, {
        isSaving: false,
        error: err instanceof Error ? err.message : "Could not save webhook.",
      });
    }
  }

  async function deleteWebhook(key: string) {
    const wh = webhooks.find((w) => w.key === key);
    if (!wh) return;

    if (!wh.id) {
      setWebhooks((current) => current.filter((w) => w.key !== key));
      return;
    }

    updateWebhook(key, { isSaving: true, error: null });

    try {
      const response = await fetch(
        `/api/admin/forms/${formSlug}/webhooks/${wh.id}`,
        { method: "DELETE", credentials: "same-origin" },
      );

      if (!response.ok && response.status !== 204) {
        const rawBody = await response.text();
        let data: { error?: string } = {};
        if (rawBody) {
          try {
            data = JSON.parse(rawBody) as typeof data;
          } catch {}
        }
        updateWebhook(key, {
          isSaving: false,
          error: data.error ?? "Could not delete webhook.",
        });
        return;
      }

      setWebhooks((current) => current.filter((w) => w.key !== key));
    } catch (err) {
      updateWebhook(key, {
        isSaving: false,
        error: err instanceof Error ? err.message : "Could not delete webhook.",
      });
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Webhooks</h2>
          <p className="text-sm text-zinc-500">
            Receive a POST request when a new response is submitted.
          </p>
        </div>
        <button
          type="button"
          onClick={addWebhook}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-500"
        >
          Add webhook
        </button>
      </div>

      {webhooks.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
          No webhooks configured. Add one to receive notifications when responses
          come in.
        </div>
      )}

      {webhooks.map((wh) => (
        <WebhookEditor
          key={wh.key}
          webhook={wh}
          onUpdate={(patch) => updateWebhook(wh.key, patch)}
          onSave={() => saveWebhook(wh.key)}
          onDelete={() => deleteWebhook(wh.key)}
          onGenerateSecret={() =>
            updateWebhook(wh.key, {
              secret: generateSecret(),
              secretVisible: true,
            })
          }
        />
      ))}
    </section>
  );
}

function WebhookEditor({
  webhook,
  onUpdate,
  onSave,
  onDelete,
  onGenerateSecret,
}: {
  webhook: WebhookDraft;
  onUpdate: (patch: Partial<WebhookDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  onGenerateSecret: () => void;
}) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {webhook.id ? "Webhook" : "New webhook"}
        </p>
        <button
          type="button"
          onClick={onDelete}
          disabled={webhook.isSaving}
          className="rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-600 transition hover:border-zinc-400 disabled:opacity-40"
        >
          Delete
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          htmlFor={`webhook-name-${webhook.key}`}
          error={webhook.fieldErrors.name}
          required
        >
          <input
            id={`webhook-name-${webhook.key}`}
            value={webhook.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className={inputClass(webhook.fieldErrors.name)}
            placeholder="Slack notifications"
          />
        </Field>

        <Field
          label="URL"
          htmlFor={`webhook-url-${webhook.key}`}
          error={webhook.fieldErrors.url}
          required
        >
          <input
            id={`webhook-url-${webhook.key}`}
            value={webhook.url}
            onChange={(e) => onUpdate({ url: e.target.value })}
            className={inputClass(webhook.fieldErrors.url)}
            placeholder="https://example.com/webhook"
          />
        </Field>
      </div>

      <div className="mt-4">
        <label className="flex items-center gap-3 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={webhook.includeAnswers}
            onChange={(e) => onUpdate({ includeAnswers: e.target.checked })}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Include form answers in payload
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Answers are only included for HTTPS endpoints.
        </p>
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <Field
          label="Secret"
          htmlFor={`webhook-secret-${webhook.key}`}
          hint='Sent as the "x-secret" header with each request.'
        >
          <div className="flex items-center gap-2">
            <input
              id={`webhook-secret-${webhook.key}`}
              type={webhook.secretVisible ? "text" : "password"}
              value={webhook.secret}
              onChange={(e) => onUpdate({ secret: e.target.value })}
              className={`flex-1 rounded-lg border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 ${
                webhook.fieldErrors.secret ? "border-red-300" : "border-zinc-300"
              }`}
              placeholder="Optional"
            />
            <button
              type="button"
              onClick={() => onUpdate({ secretVisible: !webhook.secretVisible })}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-zinc-500"
            >
              {webhook.secretVisible ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={onGenerateSecret}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-600 transition hover:border-zinc-500"
            >
              Generate
            </button>
          </div>
        </Field>
      </div>

      {webhook.error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {webhook.error}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={webhook.isSaving}
          onClick={onSave}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {webhook.isSaving
            ? webhook.id
              ? "Saving…"
              : "Creating…"
            : webhook.id
              ? "Save webhook"
              : "Create webhook"}
        </button>
      </div>
    </article>
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
