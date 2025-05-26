
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpenCheck, Brain, ArrowRight, PlusCircle, Info, Users, Activity, FileCheck2, BarChart3, ShieldCheck, AlertTriangle as FlagIcon } from "lucide-react"; // Added ShieldCheck, FlagIcon
import { useAuth } from "@/contexts/AuthContext"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress"; // Added Progress import

// Stats card component - Updated to match new design
const StatCard = ({ title, value, icon, description, buttonText, buttonLink, buttonVariant = "primary", children }: { title: string, value: string | number | React.ReactNode, icon: React.ReactNode, description?: string, buttonText?: string, buttonLink?: string, buttonVariant?: "primary" | "secondary" | "destructive" | "outline", children?: React.ReactNode }) => (
  <div className="card-3d p-6 flex flex-col"> {/* Added flex flex-col */}
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-xl font-semibold text-slate-700">{title}</h3>
      {icon}
    </div>
    {typeof value === 'string' || typeof value === 'number' ? (
      <p className="text-5xl font-bold text-slate-800">{value}</p>
    ) : (
      <div className="text-2xl font-bold text-slate-800">{value}</div> // Adjusted size for "All Systems Operational"
    )}
    {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
    {children && <div className="mt-4 flex-grow">{children}</div>} {/* For system status list */}
    {buttonText && buttonLink && (
      <Button 
        asChild 
        className={`mt-auto w-full font-medium py-2.5 px-4 rounded-lg transition-all duration-300 ease-in-out shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
          buttonVariant === 'primary' ? 'bg-blue-500 hover:bg-blue-600 text-white' : 
          buttonVariant === 'destructive' ? 'bg-red-500 hover:bg-red-600 text-white' :
          'bg-slate-200 hover:bg-slate-300 text-slate-700'
        }`}
      >
        <Link href={buttonLink}>{buttonText}</Link>
      </Button>
    )}
  </div>
);


export default function TeacherOverviewPage() {
  const { user } = useAuth(); 

  return (
    <div className="space-y-8 w-full">
      {/* "Create New Exam" button section removed from here */}
      
      {/* Updated StatCards to 3 items and new content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <StatCard 
            title="Active Exams" 
            value="0" // Placeholder, real data would come from API
            icon={<Activity className="text-blue-500 text-2xl" strokeWidth={1.5}/>} 
            description="Currently in progress (Placeholder)"
            buttonText="View Exams"
            buttonLink="/teacher/dashboard/exams"
            buttonVariant="primary"
        />
        <StatCard 
            title="Recent Flag Events" 
            value="0" // Placeholder
            icon={<FlagIcon className="text-red-500 text-2xl" strokeWidth={1.5}/>} 
            description="In the last 24 hours (Placeholder)"
            buttonText="Review Flags (Soon)"
            buttonLink="#" 
            buttonVariant="destructive"
        />
        <StatCard 
            title="System Status" 
            value="All Systems Operational" 
            icon={<ShieldCheck className="text-green-500 text-2xl" strokeWidth={1.5}/>}
        >
            <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                    <span className="text-slate-600">AI Proctoring</span>
                    <span className="text-green-500 font-medium">Online</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-slate-600">Recording Service</span>
                    <span className="text-green-500 font-medium">Online</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-slate-600">Database</span>
                    <span className="text-green-500 font-medium">Online</span>
                </div>
            </div>
        </StatCard>
      </div>
      
      <Alert className="card-3d border-primary/20 bg-blue-50 dark:bg-blue-500/10">
        <Info className="h-5 w-5 text-primary" />
        <AlertTitle className="font-semibold text-primary/90">Dashboard Overview Note</AlertTitle>
        <AlertDescription className="text-primary/80">
          The statistics on this overview page are placeholders. Detailed, real-time analytics are available on individual exam result pages.
        </AlertDescription>
      </Alert>
      
      <div className="grid gap-8 md:grid-cols-2">
        <div className="card-3d p-6">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center gap-2.5 text-xl font-semibold text-slate-700">
              <BookOpenCheck className="h-5 w-5 text-blue-500" strokeWidth={1.5}/>
              Manage Exams
            </CardTitle>
            <CardDescription className="pt-1 text-sm text-slate-500">Create, update, and monitor your exams. Share unique codes with students.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Button asChild className="w-full text-sm py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium shadow-md hover:shadow-lg">
              <Link href="/teacher/dashboard/exams">
                Go to Exams <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </div>

        <div className="card-3d p-6">
          <CardHeader className="p-0 mb-4">
            <CardTitle className="flex items-center gap-2.5 text-xl font-semibold text-slate-700">
              <Brain className="h-5 w-5 text-blue-500" strokeWidth={1.5}/>
              AI Question Assistant
            </CardTitle>
            <CardDescription className="pt-1 text-sm text-slate-500">Generate diverse exam questions based on topics and difficulty.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Button asChild className="w-full text-sm py-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium shadow-md hover:shadow-lg" variant="outline">
              <Link href="/teacher/dashboard/ai-assistant">
                Use AI Assistant <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </div>
      </div>
    </div>
  );
}
