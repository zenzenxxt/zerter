'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link'; // Added Link import
import { ArrowRight, Check, Gift, Brain, Video, Lock, PieChart, Sliders, LayoutDashboard, CreditCard, Youtube, Twitter, Facebook, Instagram, Linkedin, Building, BookOpen, Users, BarChart2, Settings, ShieldCheck, ExternalLink, Search, Filter, Download, Upload, Calendar, MessageSquare, AlertCircle, HelpCircle, Eye, EyeOff, Maximize, Minimize, ZoomIn, ZoomOut, UserCheck, UserCog, FileText, Clock, TrendingUp, Activity, Globe, ShoppingCart, DollarSign, Briefcase, MapPin, Phone, Mail, ChevronDown, ChevronUp, ChevronLeft, Menu, X } from 'lucide-react';

function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState("teacher");
  
  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Initialize and manage analytics chart
  useEffect(() => {
    // We're checking if window exists to avoid SSR issues
    if (typeof window !== 'undefined') {
      // Import echarts dynamically
      import('echarts').then((echarts) => {
        if (chartRef.current) {
          const myChart = echarts.init(chartRef.current);
          
          const option = {
            tooltip: {
              trigger: 'axis',
              axisPointer: {
                type: 'shadow'
              }
            },
            grid: {
              left: '3%',
              right: '4%',
              bottom: '3%',
              containLabel: true
            },
            xAxis: {
              type: 'category',
              data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              axisTick: {
                alignWithLabel: true
              }
            },
            yAxis: {
              type: 'value'
            },
            series: [
              {
                name: 'Exam Completion',
                type: 'bar',
                barWidth: '60%',
                data: [92, 88, 95, 91, 89, 93, 90],
                itemStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#6366f1' },
                    { offset: 1, color: '#a855f7' }
                  ])
                }
              }
            ]
          };
          
          myChart.setOption(option);
          
          const handleResize = () => {
            myChart.resize();
          };
          
          window.addEventListener('resize', handleResize);
          
          return () => {
            window.removeEventListener('resize', handleResize);
            myChart.dispose();
          };
        }
      });
    }
  }, []);

  // Handle revealing animations on scroll
  useEffect(() => {
    const handleRevealElements = () => {
      const elements = document.querySelectorAll('.reveal');
      
      elements.forEach((element) => {
        const elementTop = element.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        
        if (elementTop < windowHeight - 100) {
          element.classList.add('revealed');
        }
      });
    };
    
    window.addEventListener('scroll', handleRevealElements);
    // Initial check
    handleRevealElements();
    
    return () => window.removeEventListener('scroll', handleRevealElements);
  }, []);

  // Footer year
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);


  return (
    <div className="min-h-screen bg-white text-gray-800 font-sans">
      {/* Navigation */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'
        }`}
      >
        <div className="container mx-auto flex items-center justify-between px-4">
          <div className="flex items-center">
             <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
              ZenTest
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth?action=login" passHref>
              <button className="px-5 py-2 text-indigo-600 border border-indigo-200 hover:border-indigo-300 rounded-full font-medium transition-all">
                Log In
              </button>
            </Link>
            <Link href="/auth?action=register" passHref>
              <button className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full font-medium shadow-md hover:shadow-lg transition-all">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="pt-28 pb-12 bg-white"> {/* Increased pt for fixed header */}
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center max-w-6xl mx-auto">
            {/* Text Content (Left Side on md+) */}
            <div className="w-full md:w-1/2 md:pr-8 mb-10 md:mb-0">
              <div className="reveal fade-right text-center md:text-left">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                  Secure, Intelligent{" "}
                  <span className="relative inline-block">
                    Online Proctoring.
                    <span className="absolute bottom-2 left-0 w-full h-3 bg-yellow-300 -z-10 opacity-60"></span>
                  </span>
                </h1>
                <p className="text-lg text-gray-700 mb-8 max-w-lg mx-auto md:mx-0">
                  Ensure exam integrity with AI-assisted assessment that combines security, simplicity, and smart analytics for educators and students.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <Link href="/auth?action=register" passHref>
                    <button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-medium shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1">
                      Start Free Trial
                    </button>
                  </Link>
                  <button className="px-8 py-4 border border-indigo-200 hover:border-indigo-300 text-indigo-600 rounded-full font-medium transition-all transform hover:-translate-y-1">
                    Watch Demo <ArrowRight size={16} className="ml-1 inline-block" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Image (Right Side on md+) */}
            <div className="w-full md:w-1/2 mt-10 md:mt-0 flex justify-center md:pl-8">
              <img
                src="https://res.cloudinary.com/dcx5ryha9/image/upload/v1748245996/Group_1_gxtye8.png"
                alt="ZenTest Platform Illustration"
                data-ai-hint="platform illustration"
                className="max-w-full h-auto object-contain" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 reveal fade-up">
            <div className="text-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-all">
              <p className="text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">500+</p>
              <p className="text-gray-600 mt-2">Educational Institutions</p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-all">
              <p className="text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">2M+</p>
              <p className="text-gray-600 mt-2">Exams Conducted</p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-all">
              <p className="text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">99.9%</p>
              <p className="text-gray-600 mt-2">Uptime Reliability</p>
            </div>
            <div className="text-center p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-all">
              <p className="text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">98%</p>
              <p className="text-gray-600 mt-2">Customer Satisfaction</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 reveal fade-up">
            <span className="inline-block px-4 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium mb-4">
              Powerful Features
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need for{' '}
              <span className="relative inline-block">
                Secure Exams
                <span className="absolute bottom-1 left-0 w-full h-2 md:h-3 bg-yellow-300 -z-10 opacity-60"></span>
              </span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              ZenTest combines cutting-edge AI technology with user-friendly interfaces to create the most secure and efficient online examination platform.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden group reveal fade-up">
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <Brain size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">AI Question Generation</h3>
                <p className="text-gray-600 mb-4">
                  Automatically generate diverse question sets based on topics and difficulty levels, saving educators hours of preparation time.
                </p>
                <a href="#" className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium">
                  Learn more <ArrowRight size={16} className="ml-1" />
                </a>
              </div>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden group reveal fade-up">
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 mb-4 group-hover:bg-purple-600 group-hover:text-white transition-all">
                  <Video size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Live Proctoring</h3>
                <p className="text-gray-600 mb-4">
                  Real-time webcam and browser monitoring with AI-powered detection of suspicious behaviors for maximum exam integrity.
                </p>
                <a href="#" className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium">
                  Learn more <ArrowRight size={16} className="ml-1" />
                </a>
              </div>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden group reveal fade-up">
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <Lock size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Safe Exam Browser</h3>
                <p className="text-gray-600 mb-4">
                  Locked-down test environment with SEB integration prevents access to unauthorized resources during exams.
                </p>
                <a href="#" className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium">
                  Learn more <ArrowRight size={16} className="ml-1" />
                </a>
              </div>
            </div>
            
            {/* Feature 4 */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden group reveal fade-up">
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-4 group-hover:bg-green-600 group-hover:text-white transition-all">
                  <PieChart size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Performance Analytics</h3>
                <p className="text-gray-600 mb-4">
                  Comprehensive insights into student performance with detailed scoring breakdowns, time tracking, and flag summaries.
                </p>
                <a href="#" className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium">
                  Learn more <ArrowRight size={16} className="ml-1" />
                </a>
              </div>
            </div>
            
            {/* Feature 5 */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden group reveal fade-up">
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 mb-4 group-hover:bg-pink-600 group-hover:text-white transition-all">
                  <Sliders size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Customizable Settings</h3>
                <p className="text-gray-600 mb-4">
                  Tailor exam environments with flexible controls for question navigation, webcam settings, time limits, and scheduling.
                </p>
                <a href="#" className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium">
                  Learn more <ArrowRight size={16} className="ml-1" />
                </a>
              </div>
            </div>
            
            {/* Feature 6 */}
            <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden group reveal fade-up">
              <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-4 group-hover:bg-amber-600 group-hover:text-white transition-all">
                  <LayoutDashboard size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">Intuitive Dashboards</h3>
                <p className="text-gray-600 mb-4">
                  Role-specific interfaces for administrators, teachers, and students with all the tools they need in one place.
                </p>
                <a href="#" className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium">
                  Learn more <ArrowRight size={16} className="ml-1" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 reveal fade-up">
            <span className="inline-block px-4 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium mb-4">
              Simple Process
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How ZenTest{' '}
              <span className="relative inline-block">
                Works
                <span className="absolute bottom-1 left-0 w-full h-2 md:h-3 bg-yellow-300 -z-10 opacity-60"></span>
              </span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Our platform streamlines the entire examination process from creation to analysis, making it easy for both educators and students.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {/* Step 1 */}
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all relative reveal fade-up group">
              <div className="absolute -top-5 -left-5 w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                1
              </div>
              <h3 className="text-xl font-bold mb-4 mt-4">Create & Configure</h3>
              <p className="text-gray-600 mb-6">
                Educators build exams using AI-assisted question generation or import existing content, then customize security settings.
              </p>
              <div className="relative h-48 md:h-56 lg:h-64 overflow-hidden rounded-lg shadow-md">
                <img
                  src="https://res.cloudinary.com/dcx5ryha9/image/upload/v1748299942/Programmer_tl3sj5.png"
                  alt="Create & Configure"
                  data-ai-hint="teacher computer"
                  className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
            
            {/* Step 2 */}
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all relative reveal fade-up group" style={{ transitionDelay: '0.2s' }}>
              <div className="absolute -top-5 -left-5 w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                2
              </div>
              <h3 className="text-xl font-bold mb-4 mt-4">Take Secure Exams</h3>
              <p className="text-gray-600 mb-6">
                Students access exams through our secure browser with AI proctoring monitoring for suspicious activities.
              </p>
              <div className="relative h-48 md:h-56 lg:h-64 overflow-hidden rounded-lg shadow-md">
                <img
                  src="https://res.cloudinary.com/dcx5ryha9/image/upload/v1748299942/Video_call_dh0iax.png"
                  alt="Take Secure Exams"
                  data-ai-hint="student laptop"
                  className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
            
            {/* Step 3 */}
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all relative reveal fade-up group" style={{ transitionDelay: '0.4s' }}>
              <div className="absolute -top-5 -left-5 w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                3
              </div>
              <h3 className="text-xl font-bold mb-4 mt-4">Review & Analyze</h3>
              <p className="text-gray-600 mb-6">
                Get comprehensive analytics on student performance, time spent, and flagged behaviors with actionable insights.
              </p>
              <div className="relative h-48 md:h-56 lg:h-64 overflow-hidden rounded-lg shadow-md">
                <img
                  src="https://res.cloudinary.com/dcx5ryha9/image/upload/v1748299942/Analytics_lavdvu.png"
                  alt="Review & Analyze"
                  data-ai-hint="analytics chart"
                  className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Preview Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 reveal fade-up">
            <span className="inline-block px-4 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium mb-4">
              Platform Preview
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Experience{' '}
              <span className="relative inline-block">
                ZenTest
                <span className="absolute bottom-1 left-0 w-full h-2 md:h-3 bg-yellow-300 -z-10 opacity-60"></span>
              </span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Explore our intuitive dashboards designed specifically for educators and students.
            </p>
          </div>
          
          <div className="max-w-5xl mx-auto reveal fade-up">
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-gray-100 p-1 rounded-full">
                <button
                  onClick={() => setActiveTab("teacher")}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                    activeTab === "teacher"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Teacher Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("student")}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                    activeTab === "student"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Student Experience
                </button>
                <button
                  onClick={() => setActiveTab("admin")}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                    activeTab === "admin"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Admin Controls
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              {activeTab === "teacher" && (
                <div className="flex flex-col lg:flex-row">
                  <div className="lg:w-1/2 p-0 relative h-72 lg:h-auto">
                    <img
                      src="https://res.cloudinary.com/dcx5ryha9/image/upload/v1748301227/user-panel-business-dashboard_1_ao7aa4.png"
                      alt="Teacher Dashboard"
                      data-ai-hint="teacher interface"
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="lg:w-1/2 p-8">
                    <h3 className="text-2xl font-bold mb-6">Teacher Dashboard</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Create and manage exams with AI assistance</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Monitor live proctoring sessions in real-time</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Review comprehensive performance analytics</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Customize security settings and time limits</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Export results and generate detailed reports</p>
                      </li>
                    </ul>
                    <button className="mt-8 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full font-medium shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1">
                      Request Demo
                    </button>
                  </div>
                </div>
              )}
              
              {activeTab === "student" && (
                <div className="flex flex-col lg:flex-row">
                  <div className="lg:w-2/3 p-0 relative h-72 lg:h-auto">
                    <img
                      src="https://res.cloudinary.com/dcx5ryha9/image/upload/v1748301932/34bcd7979cfd6b6068297ac2db6e88e5_qhvrnb.jpg"
                      alt="Student Experience"
                      data-ai-hint="student exam"
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="lg:w-1/3 p-8">
                    <h3 className="text-2xl font-bold mb-6">Student Experience</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Intuitive exam interface with clear navigation</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Secure browser environment prevents cheating</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Real-time progress tracking and time management</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Access to past exam results and performance</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Technical support available during exams</p>
                      </li>
                    </ul>
                    <button className="mt-8 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full font-medium shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1">
                      Try Demo Exam
                    </button>
                  </div>
                </div>
              )}
              
              {activeTab === "admin" && (
                <div className="flex flex-col lg:flex-row">
                  <div className="lg:w-2/3 p-0 relative h-72 lg:h-auto">
                    <img
                      src="https://res.cloudinary.com/dcx5ryha9/image/upload/v1748301933/f4eea481b478591866a82d2e02a551fa_lixawy.jpg"
                      alt="Admin Controls"
                      data-ai-hint="admin panel"
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div className="lg:w-1/3 p-8">
                    <h3 className="text-2xl font-bold mb-6">Admin Controls</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Manage user accounts and permissions</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Configure institution-wide security policies</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">View system-wide analytics and usage reports</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Integrate with existing school systems</p>
                      </li>
                      <li className="flex items-start">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                          <Check size={14} />
                        </div>
                        <p className="text-gray-600">Audit logs and compliance reporting</p>
                      </li>
                    </ul>
                    <button className="mt-8 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full font-medium shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1">
                      Schedule Admin Demo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Section */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center">
            <div className="lg:w-1/2 mb-10 lg:mb-0 lg:pr-12 reveal fade-right">
              <span className="inline-block px-4 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium mb-4">
                Smart Analytics
              </span>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Data-Driven Insights</h2>
              <p className="text-lg text-gray-600 mb-8">
                ZenTest provides comprehensive analytics to help educators understand student performance and improve educational outcomes.
              </p>
              <ul className="space-y-6">
                <li className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-4 mt-1 shrink-0">
                    <Check size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Performance Tracking</h4>
                    <p className="text-gray-600">Monitor individual and class-wide performance trends over time</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-4 mt-1 shrink-0">
                    <Check size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Question Analysis</h4>
                    <p className="text-gray-600">Identify challenging questions and topics that need additional focus</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-4 mt-1 shrink-0">
                    <Check size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Behavior Patterns</h4>
                    <p className="text-gray-600">Detect patterns in flagged behaviors to improve exam integrity</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-4 mt-1 shrink-0">
                    <Check size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg">Time Management</h4>
                    <p className="text-gray-600">Analyze how students allocate time across different questions</p>
                  </div>
                </li>
              </ul>
              <button className="mt-8 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full font-medium shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1">
                Explore Analytics
              </button>
            </div>
            <div className="lg:w-1/2 reveal fade-left">
              <div className="bg-white p-6 rounded-xl shadow-xl">
                <h3 className="text-xl font-bold mb-4">Weekly Exam Completion Rates</h3>
                <div ref={chartRef} className="w-full h-80 rounded-lg overflow-hidden"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 reveal fade-up">
            <span className="inline-block px-4 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium mb-4">
              Testimonials
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              What Our{' '}
              <span className="relative inline-block">
                Users Say
                <span className="absolute bottom-1 left-0 w-full h-2 md:h-3 bg-yellow-300 -z-10 opacity-60"></span>
              </span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Hear from educators and administrators who have transformed their examination process with ZenTest.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 reveal fade-up">
            {/* Testimonial 1 */}
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all h-full flex flex-col">
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden mr-4 shrink-0">
                  <img 
                    src="https://res.cloudinary.com/dcx5ryha9/image/upload/v1748301933/d05d5c2718816512ceb677de7c75a694_pmyuyz.jpg" 
                    alt="Dr. Rebecca Chen"
                    data-ai-hint="woman portrait"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold">Dr. Rebecca Chen</h4>
                  <p className="text-sm text-gray-500">Professor, Stanford University</p>
                </div>
              </div>
              <div className="flex text-yellow-400 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                  </svg>
                ))}
              </div>
              <p className="text-gray-600 grow">
                "ZenTest has revolutionized how we conduct exams in our department. The AI-powered question generation saves hours of preparation time, and the proctoring features ensure academic integrity without being intrusive."
              </p>
            </div>
            
            {/* Testimonial 2 */}
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all h-full flex flex-col">
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden mr-4 shrink-0">
                  <img 
                    src="https://res.cloudinary.com/dcx5ryha9/image/upload/v1748301933/8e8292b09180e6f1d99d4e7a2d12cc75_annkay.jpg" 
                    alt="James Martinez"
                    data-ai-hint="man portrait"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold">James Martinez</h4>
                  <p className="text-sm text-gray-500">IT Director, Boston Public Schools</p>
                </div>
              </div>
              <div className="flex text-yellow-400 mb-4">
                 {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                  </svg>
                ))}
              </div>
              <p className="text-gray-600 grow">
                "The implementation of ZenTest across our district was seamless. Their team provided excellent support, and the platform integrated perfectly with our existing systems. The analytics have given us unprecedented insights into student performance."
              </p>
            </div>
            
            {/* Testimonial 3 */}
            <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-all h-full flex flex-col">
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden mr-4 shrink-0">
                  <img 
                    src="https://res.cloudinary.com/dcx5ryha9/image/upload/v1748301981/b2971b9bfe36081751e87bcef50d68ea_ut3jus.jpg" 
                    alt="Dr. Sarah Adams"
                    data-ai-hint="woman professional"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-bold">Dr. Sarah Adams</h4>
                  <p className="text-sm text-gray-500">Dean, NYU School of Business</p>
                </div>
              </div>
              <div className="flex text-yellow-400 mb-4">
                 {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                  </svg>
                ))}
              </div>
              <p className="text-gray-600 grow">
                "During the pandemic, ZenTest allowed us to maintain our rigorous examination standards while transitioning to remote learning. The platform's security features gave us confidence in the integrity of our assessments."
              </p>
            </div>
          </div>
          
          <div className="mt-16 text-center reveal fade-up">
            <h3 className="text-2xl font-bold mb-8">Trusted by Leading Institutions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 items-center">
              {[
                { name: "Harvard University", icon: <Building size={48} className="text-gray-400" /> },
                { name: "MIT", icon: <Building size={48} className="text-gray-400" /> }, // Using generic building, consider specific logos
                { name: "NYC Public Schools", icon: <Building size={48} className="text-gray-400" /> },
                { name: "Oxford University", icon: <BookOpen size={48} className="text-gray-400" /> },
                { name: "Pearson Education", icon: <Briefcase size={48} className="text-gray-400" /> },
                { name: "edX", icon: <Globe size={48} className="text-gray-400" /> },
              ].map((institution, index) => (
                <div key={index} className="flex flex-col items-center p-2">
                  {institution.icon}
                  <p className="mt-2 text-gray-600 font-medium text-sm text-center">{institution.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Free Access Section */}
      <section id="pricing" className="py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 reveal fade-up">
            <span className="inline-block px-4 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium mb-4">
              Free Access
            </span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Completely Free for Everyone</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Access all features and tools without any cost. We believe in making education accessible to all.
            </p>
          </div>
          
          <div className="bg-white p-10 rounded-2xl shadow-xl max-w-3xl mx-auto relative overflow-hidden reveal fade-up">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-indigo-500 to-purple-600 text-white px-8 py-2 rounded-bl-lg font-medium">
              Free Forever
            </div>
            
            <div className="flex items-center justify-center mb-8">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                <Gift size={32} />
              </div>
            </div>
            
            <h3 className="text-2xl font-bold text-center mb-8">Everything Included</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                "Unlimited students and exams",
                "Advanced AI question generation",
                "Full proctoring capabilities",
                "Comprehensive analytics",
                "24/7 support access",
                "All integrations included"
              ].map((feature, index) => (
                <div key={index} className="flex items-start">
                  <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3 mt-1 shrink-0">
                    <Check size={14} />
                  </div>
                  <p className="text-gray-600">{feature}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-10 text-center">
              <Link href="/auth?action=register" passHref>
                <button className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-lg rounded-full font-medium shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                  Get Started Now
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-700">
        {/* Decorative background pattern - consider removing if too busy or for performance */}
        <div className="absolute inset-0 z-0 opacity-10"> 
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="white" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#gridPattern)" />
          </svg>
        </div>
        
        <div className="container mx-auto px-4 relative z-10 text-center reveal fade-up">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Ready to Transform Your Examination Process?</h2>
          <p className="text-xl text-indigo-100 max-w-3xl mx-auto mb-10">
            Join hundreds of educational institutions already using ZenTest to create secure, efficient, and insightful assessment experiences.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth?action=register" passHref>
              <button className="px-8 py-4 bg-white text-indigo-600 hover:bg-gray-100 rounded-full font-medium shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1">
                Start Free Trial
              </button>
            </Link>
            <button className="px-8 py-4 border-2 border-white text-white hover:bg-white/10 rounded-full font-medium transition-all transform hover:-translate-y-1">
              Schedule Demo
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="text-2xl font-bold text-white mb-6">ZenTest</div>
              <p className="mb-6 text-sm">
                Secure, intelligent online proctoring and examination platform for educational institutions.
              </p>
              <div className="flex space-x-4">
                <a href="#" aria-label="Twitter" className="text-gray-400 hover:text-white transition-colors"><Twitter size={20}/></a>
                <a href="#" aria-label="LinkedIn" className="text-gray-400 hover:text-white transition-colors"><Linkedin size={20}/></a>
                <a href="#" aria-label="Facebook" className="text-gray-400 hover:text-white transition-colors"><Facebook size={20}/></a>
                <a href="#" aria-label="Instagram" className="text-gray-400 hover:text-white transition-colors"><Instagram size={20}/></a>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-6">Product</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Updates</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-6">Resources</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Guides</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Community</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-6">Company</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Partners</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Legal</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center text-sm">
            <div className="mb-4 md:mb-0">
              <p>&copy; {currentYear ?? new Date().getFullYear()} ZenTest. All rights reserved.</p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll reveal styles */}
      <style jsx>{`
        .reveal {
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.8s ease-in-out;
        }
        
        .reveal.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        
        .fade-up {
          transform: translateY(20px);
        }
        
        .fade-down {
          transform: translateY(-20px);
        }
        
        .fade-left {
          transform: translateX(20px);
        }
        
        .fade-right {
          transform: translateX(-20px);
        }
      `}</style>
    </div>
  );
}

export default App;
