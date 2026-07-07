import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public paths — no auth required
  const publicPaths = ['/', '/giris', '/kayit', '/sifremi-unuttum', '/sss'];
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith('/api/public')
  );

  // Static assets and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return supabaseResponse;
  }

  // Not authenticated — redirect to login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/giris';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user trying to access login/register — redirect based on status
  if (user && (pathname === '/giris' || pathname === '/kayit')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', user.id)
      .single();

    if (profile) {
      const url = request.nextUrl.clone();
      if (profile.status === 'pending_documents' || profile.status === 'rejected') {
        url.pathname = '/belgeler';
      } else if (profile.status === 'pending_review') {
        url.pathname = '/beklemede';
      } else if (profile.status === 'approved') {
        url.pathname = getRoleDashboard(profile.role);
      } else {
        url.pathname = '/';
      }
      return NextResponse.redirect(url);
    }
  }

  // Authenticated user — route based on status and role
  if (user && !isPublicPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('status, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      // Profile doesn't exist yet — allow creating
      return supabaseResponse;
    }

    // User needs to upload documents
    if (
      (profile.status === 'pending_documents' || profile.status === 'rejected') &&
      pathname !== '/belgeler'
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/belgeler';
      return NextResponse.redirect(url);
    }

    // User waiting for approval
    if (profile.status === 'pending_review' && pathname !== '/beklemede') {
      const url = request.nextUrl.clone();
      url.pathname = '/beklemede';
      return NextResponse.redirect(url);
    }

    // User suspended
    if (profile.status === 'suspended') {
      const url = request.nextUrl.clone();
      url.pathname = '/giris';
      return NextResponse.redirect(url);
    }

    // Approved user — enforce role-based access
    if (profile.status === 'approved') {
      const allowedPrefixes = getRoleAllowedPrefixes(profile.role);
      const isAllowed = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));

      if (!isAllowed && pathname !== '/belgeler' && pathname !== '/beklemede') {
        const url = request.nextUrl.clone();
        url.pathname = getRoleDashboard(profile.role);
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

function getRoleDashboard(role: string): string {
  switch (role) {
    case 'super_admin':
      return '/admin';
    case 'system_admin':
      return '/sistem';
    case 'site_manager':
      return '/yonetici';
    case 'lawyer':
      return '/avukat';
    default:
      return '/yonetici';
  }
}

function getRoleAllowedPrefixes(role: string): string[] {
  switch (role) {
    case 'super_admin':
      return ['/admin'];
    case 'system_admin':
      return ['/sistem'];
    case 'site_manager':
      return ['/yonetici'];
    case 'lawyer':
      return ['/avukat'];
    default:
      return ['/yonetici'];
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
