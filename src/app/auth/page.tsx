
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Lock, User, Eye, EyeOff, GraduationCap, UserCheck, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import type { CustomUser } from '@/types/supabase';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Use states for individual fields to easily integrate with useAuth
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<CustomUser['role'] | 'student' | 'teacher'>('student'); // Default to student

  const { user, signIn, signUp, isLoading: authContextLoading, authError: contextAuthError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const resetFormFields = useCallback(() => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setRole('student');
    setShowPassword(false);
    setLocalError(null);
  }, []);

  useEffect(() => {
    // Reset fields when switching between login/register
    resetFormFields();
  }, [isLogin, resetFormFields]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError("Email and password are required.");
      setIsSubmitting(false);
      return;
    }

    let result: { success: boolean; error?: string; user?: CustomUser | null };

    if (isLogin) {
      result = await signIn(email.trim(), password);
    } else {
      if (!name.trim()) {
        setLocalError("Full name is required for registration.");
        setIsSubmitting(false);
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match.");
        setIsSubmitting(false);
        return;
      }
      if (password.length < 6) {
        setLocalError("Password must be at least 6 characters.");
        setIsSubmitting(false);
        return;
      }
      if (!role) {
        setLocalError("Please select a role."); // Should not happen with default
        setIsSubmitting(false);
        return;
      }
      result = await signUp(email.trim(), password, name.trim(), role as CustomUser['role']);
    }

    if (result.success && result.user) {
      toast({
        title: isLogin ? "Login Successful!" : "Registration Successful!",
        description: "Redirecting to your dashboard...",
      });
      // AuthContext handles redirection
    } else {
      setLocalError(result.error || `An unknown error occurred during ${isLogin ? 'login' : 'registration'}.`);
      // Toast is removed here as the error is displayed in an Alert
    }
    setIsSubmitting(false);
  };

  const currentLoadingState = authContextLoading || isSubmitting;
  const currentError = localError || contextAuthError;

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-slate-50"> {/* Ensure body background for entire page */}
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-32 h-32 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-xl animate-float"
          style={{
            top: "10%",
            left: "5%",
            transform: `translate(${mousePosition.x * 0.02}px, ${mousePosition.y * 0.02}px)`,
            animationDelay: "0s",
          }}
        />
        <div
          className="absolute w-24 h-24 bg-gradient-to-r from-cyan-400/30 to-blue-400/30 rounded-full blur-lg animate-float"
          style={{
            top: "60%",
            left: "15%",
            transform: `translate(${mousePosition.x * 0.03}px, ${mousePosition.y * 0.03}px)`,
            animationDelay: "2s",
          }}
        />
        <div
          className="absolute w-16 h-16 bg-gradient-to-r from-purple-400/25 to-pink-400/25 rounded-full blur-md animate-float"
          style={{
            top: "80%",
            right: "10%",
            transform: `translate(${mousePosition.x * 0.025}px, ${mousePosition.y * 0.025}px)`,
            animationDelay: "4s",
          }}
        />
        <div className="absolute top-20 right-20 w-20 h-20 animate-spin-slow">
          <div className="w-full h-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 transform rotate-45 rounded-lg backdrop-blur-sm border border-white/10" />
        </div>
        <div className="absolute bottom-32 left-32 w-16 h-16 animate-bounce-slow">
          <div className="w-full h-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 transform rotate-12 rounded-full backdrop-blur-sm border border-white/10" />
        </div>
      </div>

      {/* Left Side - Enhanced Blue Section */}
      <div className="flex-1 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-700 relative overflow-hidden flex-col justify-center px-12 lg:px-16 hidden md:flex">
        <div className="absolute inset-0">
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full border border-blue-400/30 -translate-x-1/2 translate-y-1/2 animate-pulse-slow" />
          <div className="absolute bottom-20 left-20 w-64 h-64 rounded-full border border-blue-400/20 animate-spin-very-slow" />
          <div className="absolute top-32 left-1/4 w-32 h-32 rounded-full bg-gradient-to-r from-cyan-400/10 to-blue-400/10 blur-xl animate-float" />
        </div>
        <div
          className="relative z-10 text-white max-w-lg transform transition-all duration-300 hover:scale-105"
          style={{
            transform: `perspective(1000px) rotateY(${mousePosition.x * 0.02 - 1}deg) rotateX(${mousePosition.y * 0.02 - 1}deg)`,
          }}
        >
          <h1 className="text-5xl lg:text-6xl font-bold mb-6 text-white">ProctorPrep</h1>
          <p className="text-xl lg:text-2xl leading-relaxed text-blue-100">
            The all-in-one AI-powered platform for secure, seamless, and stress-free online exams.
          </p>
        </div>
      </div>

      {/* Right Side - Form Section */}
      <div className="flex-1 bg-white flex items-center justify-center px-6 sm:px-8 lg:px-12 py-8 md:py-0">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              {isLogin ? "Hello Again!" : "Welcome!"}
            </h2>
            <p className="text-gray-600 text-lg">{isLogin ? "Welcome Back" : "Create your account"}</p>
          </div>

          {currentError && (
            <Alert variant="destructive" className="mb-4 bg-red-50 border-red-200 text-red-700">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <AlertTitle className="font-semibold">Authentication Error</AlertTitle>
              <AlertDescription>{currentError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div className="space-y-2 animate-slide-in">
                <Label htmlFor="name" className="sr-only">
                  Full Name
                </Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 transition-colors group-focus-within:text-blue-500" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-12 py-4 text-lg border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="sr-only">
                Email Address
              </Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 transition-colors group-focus-within:text-blue-500" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 py-4 text-lg border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">
                Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 transition-colors group-focus-within:text-blue-500" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 pr-12 py-4 text-lg border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-110"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2 animate-slide-in">
                <Label htmlFor="confirmPassword" className="sr-only">
                  Confirm Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 transition-colors group-focus-within:text-blue-500" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-12 py-4 text-lg border-gray-200 rounded-xl focus:border-blue-500 focus:ring-blue-500"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-3 animate-slide-in">
                <Label className="text-sm font-medium text-gray-700">Select Role</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("student")}
                    className={`flex items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                      role === "student"
                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <GraduationCap className="h-5 w-5 mr-2" />
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("teacher")}
                    className={`flex items-center justify-center p-4 rounded-xl border-2 transition-all duration-200 ${
                      role === "teacher"
                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <UserCheck className="h-5 w-5 mr-2" />
                    Teacher
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 text-lg font-semibold rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl transform active:scale-95"
              disabled={currentLoadingState}
            >
              {currentLoadingState ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                isLogin ? "Login" : "Sign Up"
              )}
              {currentLoadingState && (isLogin ? 'Logging in...' : 'Signing up...')}
            </Button>

            {isLogin && (
              <div className="text-center">
                <button
                  type="button"
                  className="text-gray-500 hover:text-gray-700 text-sm transition-all duration-200 hover:scale-105"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <div className="text-center pt-4">
              <p className="text-gray-600">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    // resetFormFields(); // Already called by useEffect [isLogin]
                  }}
                  className="text-blue-600 hover:text-blue-700 font-semibold transition-all duration-200 hover:scale-105"
                >
                  {isLogin ? "Sign Up" : "Login"}
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes spin-very-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        
        .animate-spin-very-slow {
          animation: spin-very-slow 30s linear infinite;
        }
        
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 4s ease-in-out infinite;
        }
        
        .animate-slide-in {
          animation: slide-in 0.5s ease-out;
        }
        
        .shadow-3xl {
          box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  );
}
