'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Mail } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        router.push('/home')
        router.refresh()
      }
    } catch (err) {
      toast({
        title: 'Configuration Error',
        description: err instanceof Error ? err.message : 'Failed to initialize Supabase client. Please check your environment variables.',
        variant: 'destructive',
      })
    }

    setLoading(false)
  }

  async function handleMagicLink() {
    if (!email) {
      toast({
        title: 'Email required',
        description: 'Please enter your email address',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        setMagicLinkSent(true)
        toast({
          title: 'Magic link sent',
          description: 'Check your email for the login link',
        })
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      
      // Check if it's a network/fetch error
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        toast({
          title: 'Connection Error',
          description: 'Unable to connect to Supabase. Please check: 1) Your Supabase project is active, 2) The URL in .env.local is correct, 3) Your internet connection.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Configuration Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    }

    setLoading(false)
  }

  if (magicLinkSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We sent a magic link to {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Click the link in the email to sign in to your account.
            </p>
          </CardContent>
          <CardFooter className="flex-col gap-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMagicLinkSent(false)}
            >
              Back to login
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to TennisLife</CardTitle>
          <CardDescription>
            Sign in to manage your tennis teams
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleEmailLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleMagicLink}
              disabled={loading}
            >
              <Mail className="mr-2 h-4 w-4" />
              Send Magic Link
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/auth/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
