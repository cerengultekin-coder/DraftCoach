import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function pickLocaleFromAcceptLanguage(): Promise<"tr" | "en"> {
  const h = await headers();
  const accept = h.get("accept-language") || "";
  const lowered = accept.toLowerCase();

  if (lowered.includes("tr")) return "tr";
  return "en";
}

export default async function Index() {
  const locale = await pickLocaleFromAcceptLanguage();
  redirect(`/${locale}`);
}