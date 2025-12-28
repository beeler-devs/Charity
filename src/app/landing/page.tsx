'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TennisNavLogo } from '@/components/shared/tennisnav-logo'
import {
  Users,
  Calendar,
  MessageSquare,
  Trophy,
  CheckCircle,
  BarChart3,
  Zap,
  Smartphone,
  Clock,
  Target,
  Bell,
  Sparkles,
  ArrowRight,
  PlayCircle,
  FileText,
  UserCheck,
  CalendarCheck,
  Mail,
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-white to-lime-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <TennisNavLogo />
            <div className="flex items-center gap-4">
              <Link href="/auth/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/auth/signup">
                <Button className="bg-green-600 hover:bg-green-700 text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            The Complete Tennis
            <span className="text-green-600"> Team Management</span> Platform
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Streamline your team operations, coordinate matches, manage availability, and keep your players connected—all in one powerful app.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white text-lg px-8">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Manage Your Team
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Powerful features designed for captains, players, and tennis enthusiasts
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Team Management */}
          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Team & Roster Management</CardTitle>
              <CardDescription>
                Build and manage your team roster with ease. Import players, track contact info, and organize your squad.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  CSV roster import
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Player profiles & contact info
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Multi-team support
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Match Management */}
          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <Trophy className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Match Coordination</CardTitle>
              <CardDescription>
                Schedule matches, build lineups, track scores, and manage your season with powerful tools.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Drag-and-drop lineup builder
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  AI-powered lineup suggestions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Match day checklist
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Availability */}
          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <CalendarCheck className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Availability Tracking</CardTitle>
              <CardDescription>
                Know who's available when. Players respond quickly, and captains see responses in real-time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Visual availability grid
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Master availability defaults
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Real-time updates
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Calendar */}
          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Unified Calendar</CardTitle>
              <CardDescription>
                See all your matches, events, and activities in one place. Week and month views available.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Week & month views
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Recurring events support
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Personal activities
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Messaging */}
          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Team Communication</CardTitle>
              <CardDescription>
                Keep your team connected with team chats and direct messages. Real-time messaging built in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Team chat channels
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Direct messaging
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Message notifications
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="border-2 hover:border-green-500 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>Match History & Stats</CardTitle>
              <CardDescription>
                Track your performance with detailed statistics, match history, and win/loss records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Individual statistics
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Team win/loss records
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Match history tracking
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Special Features */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Built for Modern Tennis Teams
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Advanced features that make team management effortless
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* AI Lineup Wizard */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-green-500 to-lime-500 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">AI Lineup Wizard</h3>
                <p className="text-gray-600 mb-4">
                  Get intelligent lineup suggestions powered by AI. Optimize your pairings based on player availability, skill levels, and historical performance.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Smart pairing recommendations
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Automatic lineup generation
                  </li>
                </ul>
              </div>
            </div>

            {/* Rules Guru */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-green-500 to-lime-500 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Rules Guru AI</h3>
                <p className="text-gray-600 mb-4">
                  Get instant answers to tennis rules questions. Powered by GPT-4, our AI assistant knows USTA regulations, Friend at Court, and more.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    USTA rules database
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Quick rule lookups
                  </li>
                </ul>
              </div>
            </div>

            {/* PWA */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-green-500 to-lime-500 flex items-center justify-center">
                  <Smartphone className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Progressive Web App</h3>
                <p className="text-gray-600 mb-4">
                  Install TennisNav on your phone like a native app. Works offline, sends push notifications, and provides a seamless mobile experience.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Install on home screen
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Offline support
                  </li>
                </ul>
              </div>
            </div>

            {/* Email Integration */}
            <div className="flex gap-6">
              <div className="flex-shrink-0">
                <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-green-500 to-lime-500 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Automated Emails</h3>
                <p className="text-gray-600 mb-4">
                  Keep everyone informed with automated email notifications. Lineup announcements, match reminders, and event invitations sent automatically.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Lineup notifications
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Event invitations
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Teams Choose TennisNav
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <Zap className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Save Time</h3>
                <p className="text-gray-600">
                  Automate repetitive tasks like lineup building, availability tracking, and email notifications. Focus on what matters—playing tennis.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Users className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Better Communication</h3>
                <p className="text-gray-600">
                  Keep your entire team in the loop with real-time messaging, automated notifications, and centralized information.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Target className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Data-Driven Decisions</h3>
                <p className="text-gray-600">
                  Make informed lineup choices with AI suggestions, player statistics, and historical performance data.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <Clock className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Never Miss a Match</h3>
                <p className="text-gray-600">
                  Match day checklists, automated reminders, and calendar integration ensure you're always prepared.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-green-600 to-lime-500 py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Team Management?
          </h2>
          <p className="text-xl text-green-50 mb-8 max-w-2xl mx-auto">
            Join teams already using TennisNav to streamline their operations and improve communication.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" className="bg-white text-green-600 hover:bg-gray-100 text-lg px-8">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 text-lg px-8">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <TennisNavLogo className="mb-4" />
              <p className="text-sm">The complete tennis team management platform</p>
            </div>
            <div className="flex gap-6">
              <Link href="/auth/login" className="text-sm hover:text-white transition-colors">
                Sign In
              </Link>
              <Link href="/auth/signup" className="text-sm hover:text-white transition-colors">
                Sign Up
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} TennisNav. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

