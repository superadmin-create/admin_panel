import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const hasAuthCookie = request.cookies.has("teacherInfo") || 
                          request.cookies.has("next-auth.session-token") ||
                          request.cookies.has("__session");
    const userAgent = request.headers.get("user-agent") || "";
    const isBot = !userAgent || 
                  userAgent.includes("GoogleHC") || 
                  userAgent.includes("kube-probe") ||
                  userAgent.includes("health") ||
                  userAgent.includes("curl");
    
    if (isBot && !hasAuthCookie) {
      return new NextResponse("OK", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
