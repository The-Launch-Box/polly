import Link from "next/link";
import { FormBuilder } from "@/components/admin/FormBuilder";

export default function NewFormPage() {
  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Create survey</h1>
            <p className="text-sm text-zinc-500">
              Build a new one-question-at-a-time quiz for your team.
            </p>
          </div>
          <Link
            href="/admin/forms"
            className="text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            All surveys
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <FormBuilder />
      </div>
    </>
  );
}
