
'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, BookOpenCheck, Brain, BarChart3, Settings, UserCircle, LogOut, ChevronDown, AlertTriangle, Camera } from 'lucide-react';
import React, { ReactNode, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SidebarElements, type NavItem } from '@/components/shared/dashboard-sidebar';
import logoAssetDark from '../../../../../logo.png';

const teacherNavItems: NavItem[] = [
  { href: '/teacher/dashboard/overview', label: 'Overview', icon: LayoutDashboard, group: 'MAIN' },
  { href: '/teacher/dashboard/exams', label: 'Manage Exams', icon: BookOpenCheck, group: 'MAIN' },
  { href: '/teacher/dashboard/ai-assistant', label: 'AI Assistant', icon: Brain, group: 'MAIN' },
  { href: '/teacher/dashboard/results', label: 'Student Results', icon: BarChart3, group: 'MAIN' },
  // Profile and Settings will be in the SidebarFooter or a separate group if needed
];

const AUTH_ROUTE = '/auth';

export default function TeacherDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, isLoading: authLoading, authError, signOut, showSignOutDialog, setShowSignOutDialog } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (authLoading || !hasMounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading teacher session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <Card className="p-6 card-3d text-center">
          <CardHeader>
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
            <CardTitle className="text-xl text-foreground">Session Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {authError ? authError : "Your session may have expired or is invalid."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Please try logging in again.</p>
            <Button onClick={() => router.replace(AUTH_ROUTE)} className="mt-4 btn-primary-solid w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role !== 'teacher') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4">
        <Card className="p-6 card-3d text-center">
          <CardHeader>
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
            <CardTitle className="text-xl text-foreground">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Your role ({user.role || 'Unknown'}) does not permit access to this teacher dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const showFullHeader = pathname === '/teacher/dashboard/overview' || pathname === '/teacher/dashboard';

  return (
    <SidebarProvider defaultOpen={true}>
        <div className="relative flex flex-1 flex-col overflow-hidden group/design-root">
            <div className="flex flex-row flex-1 overflow-y-hidden">
                <SidebarElements 
                    navItems={teacherNavItems}
                    userRoleDashboard="teacher"
                    user={user}
                    signOut={() => { signOut(); setShowSignOutDialog(false); }}
                    authLoading={authLoading}
                    className="sidebar-bg"
                />
                 <SidebarInset>
                    <main className="flex-1 p-8 lg:p-12 bg-slate-50 overflow-y-auto">
                    {showFullHeader && (
                        <header className={cn(
                            "flex items-center mb-12", 
                            showFullHeader ? "justify-between" : "justify-end"
                        )}>
                        {showFullHeader && (
                            <div>
                            <h2 className="text-slate-800 tracking-tight text-3xl font-bold">Welcome, {user.name || 'Teacher'}!</h2>
                            <p className="text-slate-500 text-base mt-1">Your ProctorPrep dashboard.</p>
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-200 transition-colors">
                                <Avatar className="w-10 h-10 border-2 border-primary shadow-sm">
                                    <AvatarImage src={user.avatar_url || undefined} alt={user.name || 'User'} />
                                    <AvatarFallback className="bg-muted text-muted-foreground">
                                    {(user.name || "T").charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 hidden md:inline">{user.name}</span>
                                <ChevronDown className="text-slate-400 group-hover:text-blue-600 h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 bg-white rounded-xl shadow-xl py-1 z-50 mt-2">
                                <DropdownMenuItem asChild>
                                <Link href="/teacher/dashboard/profile" className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-blue-600 cursor-pointer">Profile</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                <Link href="/teacher/dashboard/settings" className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-blue-600 cursor-pointer">Settings</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setShowSignOutDialog(true)} className="block px-4 py-2 text-sm text-red-500 hover:bg-red-50 hover:text-red-600 cursor-pointer">Logout</DropdownMenuItem>
                            </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        </header>
                    )}
                    <div className={cn(!showFullHeader && "pt-0")}>
                        {children}
                    </div>
                    </main>
                </SidebarInset>
            </div>
        </div>
    </SidebarProvider>
  );
}
