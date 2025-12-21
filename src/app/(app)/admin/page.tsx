'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useIsSystemAdmin } from '@/hooks/use-is-system-admin'
import { MapPin, Loader2, Settings, Users } from 'lucide-react'

export default function AdminDashboardPage() {
  const router = useRouter()
  const { isAdmin, loading } = useIsSystemAdmin()

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/home')
    }
  }, [isAdmin, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="System Admin" />

      <main className="flex-1 p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Admin Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Manage system-wide settings and configurations
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Link href="/admin/venues">
                <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Manage Venues
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Add, edit, and manage tennis court locations for all teams
                    </p>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/admin/users">
                <Card className="hover:bg-accent transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Manage Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      View all users, edit profiles, manage system admin roles
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

