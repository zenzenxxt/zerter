
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/types/supabase'; // Assuming you will generate this

// Renamed for clarity and made synchronous
export function createSupabaseClientForNextMiddleware(
  req: NextRequest,
  res: NextResponse
) {
  // createServerClient is synchronous
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // Only operate on the response for setting cookies in middleware
          res.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          // To remove a cookie, use res.cookies.delete
          res.cookies.delete(name, options);
        },
      },
    }
  );
}

