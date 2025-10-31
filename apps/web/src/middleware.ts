import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Handle admin routes - require authenticated user
  if (pathname.startsWith('/admin')) {
    const sessionCookie = req.cookies.get('a_session_biso');
    
    if (!sessionCookie?.value) {
      // No session at all, redirect to login
      return NextResponse.redirect(new URL(`/auth/login?redirectTo=${encodeURIComponent(pathname)}`, req.url));
    }
    
    // For admin routes, we'll do the authentication check in the layout component
    // This avoids making API calls in middleware which can be slow
    // The admin layout will handle the redirect if user is not authenticated
  }

  // Handle auth routes - allow anonymous users to access auth pages
  if (pathname.startsWith('/auth')) {
    // Don't redirect users away from auth pages if they have anonymous sessions
    // The auth pages themselves will handle the logic for already authenticated users
  }

  // Handle public routes - ensure anonymous session exists
  const isPublicRoute = !pathname.startsWith('/admin') && 
                       !pathname.startsWith('/auth') && 
                       !pathname.startsWith('/api') &&
                       !pathname.startsWith('/_next') &&
                       !pathname.startsWith('/favicon');

                       /*
  if (isPublicRoute) {
    const sessionCookie = req.cookies.get('a_session_biso');
    
    // If no session exists, create anonymous session
    if (!sessionCookie?.value) {
      // Redirect to anonymous auth API to set session, then back to original URL
      const anonymousUrl = new URL('/api/auth/anonymous', req.url);
      anonymousUrl.searchParams.set('redirect', pathname + req.nextUrl.search);
      
      return NextResponse.redirect(anonymousUrl);
    }
  }
*/
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};