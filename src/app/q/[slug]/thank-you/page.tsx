import Link from "next/link";

type ThankYouPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ThankYouPage({ params }: ThankYouPageProps) {
  const { slug } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          ✓
        </div>
        <h1 className="text-2xl font-semibold text-zinc-900">Thank you!</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Your response has been recorded.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={`/q/${slug}`}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            Submit another response
          </Link>
          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 transition hover:text-zinc-800"
          >
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
