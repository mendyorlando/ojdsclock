import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { PrintButton } from "@/components/PrintButton";
import { DOOR_TAGS, TAG_LABELS } from "@/lib/tags";

// A printed backup for each door, in case a physical NFC tag ever gets
// damaged or a phone has trouble reading it. Scanning it with a phone
// camera opens the same /c/[tag] link a tag tap would - the app (or the
// website, if the app isn't installed) then verifies the scan happened
// within the school's radius, since a QR code (unlike the NFC tags) can't
// carry a live cryptographic signature.
export default async function QrCodesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/qr-codes");
  if (user.role !== "ADMIN") redirect("/dashboard");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ojdsclock.vercel.app";

  const codes = await Promise.all(
    DOOR_TAGS.map(async (tag) => ({
      tag,
      label: TAG_LABELS[tag],
      url: `${baseUrl}/c/${tag}`,
      svg: await QRCode.toString(`${baseUrl}/c/${tag}`, { type: "svg", margin: 1, width: 260 }),
    })),
  );

  return (
    <div className="stage-light flex-1 flex flex-col">
      <Nav name={user.name} title={user.title} isAdmin={true} active="qr-codes" />

      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 flex-1">
        <div className="mb-6 print:hidden">
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">QR code backup</h1>
          <p className="text-ink-soft text-sm mt-1 max-w-2xl">
            Print these and tape one up at each entrance next to the NFC tag. If a tag is ever
            damaged or a phone has trouble reading it, staff can scan the QR code with their
            camera instead - it works the same way, just checks their location instead of a
            cryptographic tap.
          </p>
          <PrintButton className="mt-4 rounded-full btn-teal-gradient text-white text-xs font-bold px-4 py-2 print:hidden">
            Print
          </PrintButton>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {codes.map((c) => (
            <div
              key={c.tag}
              className="glass-card rounded-2xl p-6 flex flex-col items-center gap-3 print:border print:border-black/20 print:shadow-none"
            >
              <h2 className="font-extrabold text-ink text-lg">{c.label}</h2>
              <div dangerouslySetInnerHTML={{ __html: c.svg }} />
              <p className="text-xs font-semibold text-ink-soft text-center break-all">{c.url}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
