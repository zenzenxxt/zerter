
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Palette, ShieldQuestion } from "lucide-react";

export default function StudentSettingsPage() {
  return (
    <div className="space-y-6">
      {/* Title is now part of the new layout's header */}
      {/* <h1 className="text-3xl font-bold">Settings</h1> */}
      <div className="card-3d"> {/* Applied card-3d style */}
        <CardHeader className="p-6">
          <CardTitle className="text-xl font-semibold text-slate-700">Account Settings</CardTitle>
          <CardDescription className="text-sm text-slate-500">Manage your account preferences and settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 text-slate-700"><Bell className="h-5 w-5 text-blue-500" /> Notifications</h3>
            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50/50">
              <div>
                <Label htmlFor="email-notifications" className="font-semibold text-slate-600">Email Notifications</Label>
                <p className="text-sm text-slate-500">Receive email updates about exam schedules and results.</p>
              </div>
              <Switch id="email-notifications" defaultChecked />
            </div>
             <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50/50">
              <div>
                <Label htmlFor="push-notifications" className="font-semibold text-slate-600">Push Notifications (App)</Label>
                <p className="text-sm text-slate-500">Get real-time alerts on your device (if app is available).</p>
              </div>
              <Switch id="push-notifications" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 text-slate-700"><Palette className="h-5 w-5 text-blue-500" /> Appearance</h3>
             <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50/50">
              <div>
                <Label htmlFor="dark-mode" className="font-semibold text-slate-600">Dark Mode</Label>
                <p className="text-sm text-slate-500">Toggle between light and dark themes for the dashboard.</p>
              </div>
              <Switch id="dark-mode" disabled/> 
            </div>
          </div>

           <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 text-slate-700"><ShieldQuestion className="h-5 w-5 text-blue-500" /> Security & Privacy</h3>
            <div className="p-4 border border-slate-200 rounded-lg space-y-3 bg-slate-50/50">
              <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">Change Password</Button>
              <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">View Privacy Policy</Button>
              <Button variant="destructive" disabled className="opacity-50">Delete Account (Not Implemented)</Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled className="bg-blue-500 hover:bg-blue-600 text-white opacity-50">Save Settings (Not Implemented)</Button>
          </div>
        </CardContent>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Settings | Student Dashboard | ZenTest', // Updated app name
};

    