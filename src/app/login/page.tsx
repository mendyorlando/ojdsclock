import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

type SearchParams = { next?: string; error?: string };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = params.next || "/dashboard";

  const user = await getCurrentUser();
  if (user) redirect(next);

  const error = params.error;

  return (
    <main className="stage-dark flex-1 flex items-center justify-center px-6 py-16">
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <Image
            src="/logo-mark.png"
            alt="Orlando Jewish Day School"
            width={96}
            height={96}
            priority
            className="inline-block mb-4 drop-shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
          />
          <h1 className="text-2xl font-extrabold text-white tracking-tight text-balance">
            Orlando Jewish Day School
          </h1>
          <p className="text-teal-100/60 text-sm mt-1.5">Sign in to clock in or out</p>
        </div>

        <LoginForm next={next} error={error} />
      </div>
    </main>
  );
}
