
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Loader2, LogIn, LogOut, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import logoAssetDark from '../../../logo.png'; // Assuming this is the dark text logo for light backgrounds
// Removed import for logoAssetWhite as it was causing "Module not found"
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import React from 'react';


const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';

export function AppHeader() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const isAuthenticated = !!user;
  const pathname = usePathname();

  const getDashboardRoute = () => {
    if (!user || !user.role) { 
        console.warn("[AppHeader] User role missing, defaulting dashboard route.");
        return STUDENT_DASHBOARD_ROUTE; 
    }
    return user.role === 'teacher' ? TEACHER_DASHBOARD_ROUTE : STUDENT_DASHBOARD_ROUTE;
  };
  
  // Simplified logo display: always use logoAssetDark for the global AppHeader.
  // Theme-specific logo switching can be handled by CSS or within specific layout components if needed.
  const logoToDisplay = logoAssetDark;
  
  // Hide header on student and teacher dashboard layouts as they have their own internal headers now.
  const isDashboardPath = pathname.startsWith('/student/dashboard') || pathname.startsWith('/teacher/dashboard');
  if (isDashboardPath && typeof window !== 'undefined') { 
    return null;
  }


  return (
    <header className={cn(
        "sticky top-0 z-50 w-full border-b border-border/30 bg-background/80 backdrop-blur-md shadow-sm",
      )}>
      <div className="container flex h-20 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Image src={logoToDisplay} alt="Zentest Logo" width={150} height={40} priority className="h-10 sm:h-12 w-auto" />
        </Link>
        <nav className="flex items-center space-x-1 sm:space-x-2">
          {authLoading ? ( 
             <div className="p-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
             </div>
          ) : isAuthenticated && user ? (
            <>
              <Button variant="ghost" asChild className="text-xs sm:text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary px-2 sm:px-3 py-1.5 rounded-md">
                <Link href={getDashboardRoute()}>
                 <LayoutDashboard className="mr-1.5 h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={signOut}
                className="text-xs sm:text-sm font-medium border-border/70 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive px-2 sm:px-3 py-1.5 rounded-md"
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                 Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="text-xs sm:text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary px-2 sm:px-3 py-1.5 rounded-md">
                <Link href="/auth?action=login">
                  <LogIn className="mr-1.5 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild className="btn-primary-solid text-xs sm:text-sm px-3 sm:px-4 py-1.5 rounded-md">
                <Link href="/auth?action=register">
                  <UserPlus className="mr-1.5 h-4 w-4" /> Register
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
