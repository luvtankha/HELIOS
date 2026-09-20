import { NextResponse } from "next/server";

export function middleware() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  )
    return new NextResponse(null, { status: 404 });
  return NextResponse.next();
}

export const config = {
  matcher: ["/sih-demo/:path*", "/doctor/sih-demo/:path*"],
};
