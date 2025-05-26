
'use client';

import { UserProfileForm } from '@/components/shared/user-profile-form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { CustomUser } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StudentProfilePage() {
  const { user, isLoading: authLoading, updateUserProfile } = useAuth();
  const { toast } = useToast();

  const handleSaveProfile = async (data: { name: string; password?: string; avatar_url?: string }) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to update your profile.", variant: "destructive" });
      return;
    }

    const result = await updateUserProfile({
        name: data.name,
        password: data.password,
        avatar_url: data.avatar_url,
    });

    if (result.success) {
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } else {
      toast({
        title: "Update Failed",
        description: result.error || "Could not update your profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (authLoading && !user) { 
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!user) { 
    return (
        <div className="flex h-full items-center justify-center p-4">
            <div className="card-3d p-6 text-center"> {/* Apply card-3d style */}
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3"/>
              <h2 className="text-xl font-semibold text-foreground">Profile Not Available</h2> {/* Use h2 for semantic consistency with CardTitle */}
              <p className="text-sm text-muted-foreground mt-2">User data not found. Please try logging in again.</p>
            </div>
        </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Title is now part of the new layout's header, so we don't need an h1 here */}
      {/* <h1 className="text-3xl font-bold text-foreground">My Profile</h1> */}
      <UserProfileForm
        user={user}
        onSave={handleSaveProfile}
      />
    </div>
  );
}

    