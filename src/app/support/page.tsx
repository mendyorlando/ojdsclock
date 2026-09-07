export const metadata = { title: "Support - OJDS Clock" };

export default function SupportPage() {
  return (
    <main className="stage-light flex-1 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-2">Support</h1>

        <div className="space-y-6 text-ink text-sm leading-relaxed">
          <p>
            OJDS Clock is the staff time-clock app for Orlando Jewish Day School. If you&apos;re
            having trouble signing in, clocking in or out, or anything else in the app, contact
            your school administrator or reach out directly:
          </p>

          <p>
            <a href="mailto:rabbi@jewishwintergarden.com" className="font-bold underline">
              rabbi@jewishwintergarden.com
            </a>
          </p>

          <p>
            See also our{" "}
            <a href="/privacy" className="font-bold underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
