import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin?callbackUrl=/admin/submissions");
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-2 text-sm">
          <div className="flex items-center gap-4">
            <span className="font-medium text-zinc-900">Admin</span>
            <Link
              href="/admin/forms"
              className="text-zinc-500 transition hover:text-zinc-800"
            >
              Surveys
            </Link>
            <Link
              href="/admin/submissions"
              className="text-zinc-500 transition hover:text-zinc-800"
            >
              Submissions
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {session.user.email && (
              <span className="hidden text-zinc-500 sm:inline">
                {session.user.email}
              </span>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="text-zinc-500 transition hover:text-zinc-800"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
