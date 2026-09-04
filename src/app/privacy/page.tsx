export const metadata = { title: "Privacy Policy - OJDS Clock" };

export default function PrivacyPage() {
  return (
    <main className="stage-light flex-1 px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-extrabold text-ink tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-ink-soft text-sm mb-8">Last updated September 2026</p>

        <div className="space-y-6 text-ink text-sm leading-relaxed">
          <p>
            OJDS Clock is an internal staff time-clock application for Orlando Jewish Day School
            (&ldquo;OJDS&rdquo;), used only by OJDS employees and administrators. It is not available
            to the general public and does not collect information from anyone outside OJDS staff.
          </p>

          <section>
            <h2 className="font-extrabold text-ink mb-2">What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your name, username, and a securely hashed password, used to sign you in.</li>
              <li>
                Clock-in and clock-out timestamps, and which entrance tag was used, used to
                calculate your hours worked.
              </li>
              <li>
                A device identifier for the phone you sign in on, used to keep your account locked
                to that device for security (an administrator can reset this if you get a new
                phone).
              </li>
              <li>
                If you enable the optional &ldquo;clock-out reminder&rdquo; feature, your phone&apos;s
                location is used only to detect when you leave the school building, so we can remind
                you to clock out. This location data is not stored or tracked beyond that
                on-device check.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-extrabold text-ink mb-2">How we use it</h2>
            <p>
              This information is used only to operate the time-clock system itself - calculating
              hours for payroll, and letting administrators manage staff device approvals and hour
              corrections. We do not use it for advertising, and we do not sell or share it with
              any third party for their own purposes.
            </p>
          </section>

          <section>
            <h2 className="font-extrabold text-ink mb-2">Where it&apos;s stored</h2>
            <p>
              Data is stored in a hosted database (Supabase) and the app is hosted on Vercel - both
              act only as infrastructure providers for OJDS and do not access your data for their
              own purposes.
            </p>
          </section>

          <section>
            <h2 className="font-extrabold text-ink mb-2">Contact</h2>
            <p>
              Questions about this policy or your data can be directed to your school
              administrator.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
