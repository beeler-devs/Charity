'use client'

import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Users, User, Search, Construction } from 'lucide-react'

export default function PlayPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Play" />

      <main className="flex-1 p-4">
        <Tabs defaultValue="partner" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="partner">Partner</TabsTrigger>
            <TabsTrigger value="fourth">Fourth</TabsTrigger>
            <TabsTrigger value="opponents">Opponents</TabsTrigger>
          </TabsList>

          <TabsContent value="partner" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Find a Partner</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Search for available players in your area who match your skill level
                </p>
                <Badge variant="outline" className="gap-1">
                  <Construction className="h-3 w-3" />
                  Coming Soon
                </Badge>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fourth" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Find a Fourth</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Need a fourth player for doubles? Post your request here
                </p>
                <Badge variant="outline" className="gap-1">
                  <Construction className="h-3 w-3" />
                  Coming Soon
                </Badge>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="opponents" className="mt-4">
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Find Opponents</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Challenge other teams or players to friendly matches
                </p>
                <Badge variant="outline" className="gap-1">
                  <Construction className="h-3 w-3" />
                  Coming Soon
                </Badge>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
