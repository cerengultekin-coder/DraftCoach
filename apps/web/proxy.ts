import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // API routes, static files ve Next.js internals hariç her şeyi eşle
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
