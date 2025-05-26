
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Palette, ShieldQuestion, UploadCloud } from "lucide-react";

export default function TeacherSettingsPage() {
  return (
    <div className="space-y-6">
      {/* <h1 className="text-3xl font-bold text-slate-800">Settings</h1> */}
      <div className="card-3d">
        <CardHeader className="p-6">
          <CardTitle className="text-xl font-semibold text-slate-700">Platform Settings</CardTitle>
          <CardDescription className="text-sm text-slate-500">Manage your teaching preferences and platform settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 text-slate-700"><Bell className="h-5 w-5 text-blue-500" /> Notification Preferences</h3>
            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50/50">
              <div>
                <Label htmlFor="exam-submission-notifications" className="font-semibold text-slate-600">Exam Submission Alerts</Label>
                <p className="text-sm text-slate-500">Notify me when a student submits an exam.</p>
              </div>
              <Switch id="exam-submission-notifications" defaultChecked />
            </div>
             <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50/50">
              <div>
                <Label htmlFor="new-student-join-notifications" className="font-semibold text-slate-600">New Student Registrations</Label>
                <p className="text-sm text-slate-500">Alert me when a new student registers for one of my courses (if applicable).</p>
              </div>
              <Switch id="new-student-join-notifications" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 text-slate-700"><UploadCloud className="h-5 w-5 text-blue-500" /> Default Upload Settings</h3>
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/50">
                <Label htmlFor="default-csv-format" className="font-semibold text-slate-600">Default CSV Format for Questions</Label>
                <p className="text-sm text-slate-500 mb-2">Define your preferred CSV column order (e.g., question,option1,option2,answer).</p>
                <Button variant="outline" disabled className="border-slate-300 text-slate-700 opacity-50">Set CSV Format</Button>
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 text-slate-700"><Palette className="h-5 w-5 text-blue-500" /> Appearance</h3>
             <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50/50">
              <div>
                <Label htmlFor="dark-mode-teacher" className="font-semibold text-slate-600">Dark Mode</Label>
                <p className="text-sm text-slate-500">Toggle dashboard theme.</p>
              </div>
              <Switch id="dark-mode-teacher" disabled />
            </div>
          </div>

           <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2 text-slate-700"><ShieldQuestion className="h-5 w-5 text-blue-500" /> Security & Data</h3>
            <div className="p-4 border border-slate-200 rounded-lg space-y-3 bg-slate-50/50">
              <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">Change Password</Button>
              <Button variant="outline" disabled className="border-slate-300 text-slate-700 opacity-50">Export My Data (Not Implemented)</Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled className="bg-blue-500 hover:bg-blue-600 text-white opacity-50">Save All Settings (Not Implemented)</Button>
          </div>
        </CardContent>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Settings | Teacher Dashboard | ProctorPrep',
};
