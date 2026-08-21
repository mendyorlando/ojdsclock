import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TapClient } from "@/components/TapClient";

export default async function ClockTapPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/c/${tag}`)}`);
  }
  if (user.role === "ADMIN") {
    redirect("/admin");
  }

  return (
    <main className="stage-dark flex-1 flex items-center justify-center px-6 py-16">
      <div className="relative z-10 w-full max-w-sm">
        <TapClient tag={tag} firstName={user.name.split(" ")[0]} />
      </div>
    </main>
  );
}
