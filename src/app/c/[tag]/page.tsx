import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { TapClient } from "@/components/TapClient";

export default async function ClockTapPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ picc_data?: string; cmac?: string }>;
}) {
  const { tag } = await params;
  const { picc_data: piccData, cmac } = await searchParams;
  const user = await getCurrentUser();

  const query = piccData && cmac ? `?picc_data=${piccData}&cmac=${cmac}` : "";

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/c/${tag}${query}`)}`);
  }
  if (user.role === "ADMIN") {
    redirect("/admin");
  }

  return (
    <main className="stage-dark flex-1 flex items-center justify-center px-6 py-16">
      <div className="relative z-10 w-full max-w-sm">
        <TapClient tag={tag} firstName={user.name.split(" ")[0]} piccData={piccData} cmac={cmac} />
      </div>
    </main>
  );
}
