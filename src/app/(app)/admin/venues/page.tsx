'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useIsSystemAdmin } from '@/hooks/use-is-system-admin'
import { VenueDialog } from '@/components/teams/venue-dialog'
import { Plus, Edit, Trash2, MapPin, ExternalLink, Loader2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

interface Venue {
  id: string
  name: string
  address: string | null
  google_maps_link: string | null
  region: string | null
  is_active: boolean
  team_id: string | null
}

export default function AdminVenuesPage() {
  const router = useRouter()
  const { isAdmin, loading: adminLoading } = useIsSystemAdmin()
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [showVenueDialog, setShowVenueDialog] = useState(false)
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null)
  const [filterRegion, setFilterRegion] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const { toast } = useToast()

  useEffect(() => {
    if (!adminLoading) {
      if (!isAdmin) {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to access this page',
          variant: 'destructive',
        })
        router.push('/home')
        return
      }
      loadVenues()
    }
  }, [isAdmin, adminLoading, router, toast])

  async function loadVenues() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .order('region', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    if (error) {
      console.error('Error loading venues:', error)
      toast({
        title: 'Error',
        description: 'Failed to load venues',
        variant: 'destructive',
      })
      setVenues([])
    } else {
      setVenues(data || [])
    }
    setLoading(false)
  }

  async function handleDeleteVenue(venueId: string) {
    const supabase = createClient()
    const { error } = await supabase
      .from('venues')
      .delete()
      .eq('id', venueId)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Venue deleted',
        description: 'The venue has been removed',
      })
      loadVenues()
    }
  }

  async function handleToggleActive(venueId: string, currentStatus: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('venues')
      .update({ is_active: !currentStatus })
      .eq('id', venueId)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Venue updated',
        description: `Venue ${!currentStatus ? 'activated' : 'deactivated'}`,
      })
      loadVenues()
    }
  }

  // Get unique regions for filter
  const regions = Array.from(new Set(venues.map(v => v.region).filter(Boolean))) as string[]

  // Filter venues
  const filteredVenues = venues.filter(venue => {
    const matchesRegion = filterRegion === 'all' || venue.region === filterRegion || (!venue.region && filterRegion === 'unassigned')
    const matchesSearch = !searchTerm || 
      venue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venue.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      venue.region?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesRegion && matchesSearch
  })

  if (adminLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return null // Will redirect
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="System Admin - Venues" />

      <main className="flex-1 p-4 space-y-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Manage Tennis Court Locations</CardTitle>
              <Button
                onClick={() => {
                  setEditingVenue(null)
                  setShowVenueDialog(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Venue
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="region">Filter by Region</Label>
                <Select value={filterRegion} onValueChange={setFilterRegion}>
                  <SelectTrigger id="region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {regions.map(region => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search by name, address, or region..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Venues List */}
            {filteredVenues.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                {venues.length === 0 
                  ? 'No venues added yet. Click "Add Venue" to get started.'
                  : 'No venues match your filters.'}
              </p>
            ) : (
              <div className="space-y-3">
                {filteredVenues.map((venue) => (
                  <div
                    key={venue.id}
                    className={`flex items-start justify-between p-4 border rounded-lg ${
                      !venue.is_active ? 'opacity-60 bg-muted' : ''
                    }`}
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">{venue.name}</h4>
                        {venue.region && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            {venue.region}
                          </span>
                        )}
                        {!venue.is_active && (
                          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                        {venue.team_id && (
                          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded">
                            Team-specific
                          </span>
                        )}
                      </div>
                      {venue.address && (
                        <p className="text-sm text-muted-foreground pl-6">
                          {venue.address}
                        </p>
                      )}
                      {venue.google_maps_link && (
                        <a
                          href={venue.google_maps_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1 pl-6"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View on Google Maps
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(venue.id, venue.is_active)}
                      >
                        {venue.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingVenue(venue)
                          setShowVenueDialog(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteVenue(venue.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <VenueDialog
          open={showVenueDialog}
          onOpenChange={setShowVenueDialog}
          venue={editingVenue}
          teamId="" // Empty for system-level venues
          onSaved={loadVenues}
        />
      </main>
    </div>
  )
}


