import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "./actions";

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

        <form action={loginAction} className="glass-dark rounded-[2rem] p-7 space-y-4">
          <input type="hidden" name="next" value={next} />

          {error && (
            <p className="text-sm font-semibold text-orange-200 bg-orange-500/15 rounded-xl px-3.5 py-2.5">
              {error === "missing"
                ? "Enter your username and password."
                : "That username or password isn't right."}
            </p>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-teal-100/50 mb-1.5">
              Username
            </label>
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="off"
              autoFocus
              className="field-dark w-full rounded-xl px-4 py-3 text-sm font-semibold"
              placeholder="rklein"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-teal-100/50 mb-1.5">
              Password
            </label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              className="field-dark w-full rounded-xl px-4 py-3 text-sm font-semibold"
              placeholder="Password"
            />
          </div>

          <button
            type="submit"
            className="btn-gradient w-full rounded-xl py-3.5 text-sm font-bold text-white mt-2 cursor-pointer"
          >
            Sign in
          </button>

          <p className="text-center text-xs text-teal-100/40 pt-1">
            Stays signed in on this phone, so the next tap clocks you right in.
          </p>
        </form>
      </div>
    </main>
  );
}
