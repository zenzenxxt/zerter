
'use client'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit3, History, UserCircle, ArrowRight, ShieldAlert, Info, FileText, Activity, BarChart2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext"; 
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Stats card component - applying card-3d style
const StatCard = ({ title, value, icon, description, buttonText, buttonLink, buttonVariant = "primary" }: { title: string, value: string | number, icon: React.ReactNode, description?: string, buttonText?: string, buttonLink?: string, buttonVariant?: "primary" | "secondary" | "destructive" | "outline" }) => (
  <div className="card-3d p-6"> {/* Applied card-3d and padding here */}
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-xl font-semibold text-slate-700">{title}</h3>
      {icon}
    </div>
    <p className="text-5xl font-bold text-slate-800">{value}</p>
    {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
    {buttonText && buttonLink && (
      <Button 
        asChild 
        className={`mt-6 w-full font-medium py-2.5 px-4 rounded-lg transition-all duration-300 ease-in-out shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
          buttonVariant === 'primary' ? 'bg-blue-500 hover:bg-blue-600 text-white' : 
          buttonVariant === 'destructive' ? 'bg-red-500 hover:bg-red-600 text-white' :
          'bg-slate-200 hover:bg-slate-300 text-slate-700' // Default/secondary
        }`}
      >
        <Link href={buttonLink}>{buttonText}</Link>
      </Button>
    )}
  </div>
);


export default function StudentOverviewPage() {
  const { user } = useAuth(); 

  return (
    <div className="space-y-8 w-full"> {/* Increased space-y for new card design */}
      {/* Removed the original welcome header as it's now part of StudentDashboardLayout */}
      
      {/* Placeholder Stats Cards - Adjusted to new design's example cards if applicable or keep existing logic */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"> {/* Increased gap */}
        <StatCard 
            title="Join an Exam" 
            value={<Edit3 className="h-12 w-12 text-blue-500" />} 
            description="Ready for your next assessment?" 
            buttonText="Go to Join Exam"
            buttonLink="/student/dashboard/join-exam"
            buttonVariant="primary"
            icon={<Edit3 className="text-blue-500 text-2xl" />}
        />
        <StatCard 
            title="Exam History" 
            value={<History className="h-12 w-12 text-green-500" />} 
            description="Review your past exam attempts."
            buttonText="Check History"
            buttonLink="/student/dashboard/exam-history"
            buttonVariant="secondary" // Example variant
            icon={<History className="text-green-500 text-2xl" />}
        />
        <StatCard 
            title="My Profile" 
            value={<UserCircle className="h-12 w-12 text-purple-500" />} 
            description="Keep your information current."
            buttonText="Edit Profile"
            buttonLink="/student/dashboard/profile"
            buttonVariant="secondary" // Example variant
            icon={<UserCircle className="text-purple-500 text-2xl" />}
        />
      </div>

      {/* Informational Alert with new styling if needed, or use existing ShadCN alert */}
      <Alert className="card-3d border-primary/20 bg-blue-50 dark:bg-blue-500/10 mt-4">
        <Info className="h-5 w-5 text-primary" />
        <AlertTitle className="font-semibold text-primary/90">Student Dashboard Note</AlertTitle>
        <AlertDescription className="text-primary/80">
          Functionalities like exam statistics will populate as you complete exams.
        </AlertDescription>
      </Alert>

      {/* Other cards from the original overview page can be styled with card-3d */}
      {/* Example of adapting existing content structure if needed */}
       <div className="card-3d p-6">
        <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center text-xl font-semibold text-slate-700">
                <ShieldAlert className="h-5 w-5 text-primary mr-2" />
                Important Notice
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            <p className="text-sm text-slate-600">
                All exams must be taken using the <strong>Safe Exam Browser (SEB)</strong> or as instructed by your teacher. Ensure you have any required software installed and configured correctly before attempting to join an exam.
            </p>
        </CardContent>
      </div>

      {/* Placeholder for future content that might use the analytics card style */}
      {/* This section demonstrates how the "Exam Analytics Overview" card might look if it were part of student dash */}
      {/*
      <div className="md:col-span-2 lg:col-span-3 card-3d p-6 mt-4">
        <h3 class="text-xl font-semibold text-slate-700 mb-6">My Progress Overview (Example)</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="bg-slate-100/70 p-4 rounded-xl shadow-inner">
                <h4 class="text-lg font-medium text-slate-600 mb-2">Average Score</h4>
                <p class="text-3xl font-bold text-blue-600 mt-2">N/A</p>
                <p class="text-xs text-slate-500">Across all taken exams.</p>
            </div>
            <div class="bg-slate-100/70 p-4 rounded-xl shadow-inner">
                <h4 class="text-lg font-medium text-slate-600 mb-2">Exams Taken</h4>
                <p class="text-3xl font-bold text-green-600">0</p>
                <p class="text-xs text-slate-500">Total exams completed.</p>
            </div>
        </div>
      </div>
      */}

    </div>
  );
}

    