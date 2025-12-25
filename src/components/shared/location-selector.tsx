'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { VenueDialog } from '@/components/teams/venue-dialog'

interface Venue {
  id: string
  name: string
  address: string | null
  region?: string | null
  team_id?: string | null
  default_court_time?: number | null
}

interface LocationSelectorProps {
  locationMode: 'venue' | 'custom'
  onLocationModeChange: (mode: 'venue' | 'custom') => void
  selectedVenueId: string | undefined
  onVenueChange: (venueId: string | undefined) => void
  customLocation: string
  onCustomLocationChange: (location: string) => void
  teamId?: string | null // Optional team ID for team-specific venues
  canCreateVenue?: boolean // Whether user can create new venues (default: false)
  onVenueSelected?: (venue: Venue | null) => void // Callback when venue is selected
}

export function LocationSelector({
  locationMode,
  onLocationModeChange,
  selectedVenueId,
  onVenueChange,
  customLocation,
  onCustomLocationChange,
  teamId,
  canCreateVenue = false,
  onVenueSelected,
}: LocationSelectorProps) {
  const [venues, setVenues] = useState<Venue[]>([])
  const [loadingVenues, setLoadingVenues] = useState(false)
  const [showVenueDialog, setShowVenueDialog] = useState(false)

  useEffect(() => {
    if (locationMode === 'venue') {
      loadVenues()
    }
  }, [locationMode, teamId])

  async function loadVenues() {
    setLoadingVenues(true)
    const supabase = createClient()
    
    try {
      // Load system-wide active venues (available to all authenticated users)
      const { data: systemVenues } = await supabase
        .from('venues')
        .select('*')
        .is('team_id', null)
        .eq('is_active', true)
        .order('region', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true })

      // Load team-specific venues if teamId is provided
      let teamVenues: Venue[] = []
      if (teamId) {
        const { data } = await supabase
          .from('venues')
          .select('*')
          .eq('team_id', teamId)
          .order('name', { ascending: true })
        teamVenues = data || []
      }

      const allVenues = [
        ...(systemVenues || []),
        ...teamVenues
      ]

      setVenues(allVenues)
    } catch (error) {
      console.error('Error loading venues:', error)
      setVenues([])
    } finally {
      setLoadingVenues(false)
    }
  }

  function handleVenueChange(venueId: string) {
    onVenueChange(venueId)
    const venue = venues.find(v => v.id === venueId)
    if (venue) {
      // Set location text to venue name, optionally include address
      const locationText = venue.address 
        ? `${venue.name} - ${venue.address}` 
        : venue.name
      onCustomLocationChange(locationText)
      onVenueSelected?.(venue)
    }
  }

  function handleLocationModeChange(mode: 'venue' | 'custom') {
    onLocationModeChange(mode)
    if (mode === 'custom') {
      onVenueChange(undefined)
    } else {
      onCustomLocationChange('')
    }
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="location">Location</Label>
          <div className="flex items-center gap-2">
            <Select value={locationMode} onValueChange={handleLocationModeChange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="venue">Select Venue</SelectItem>
                <SelectItem value="custom">Custom Location</SelectItem>
              </SelectContent>
            </Select>
            {locationMode === 'venue' && canCreateVenue && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowVenueDialog(true)}
                title="Create a new venue"
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            )}
          </div>
        </div>

        {locationMode === 'venue' ? (
          <Select
            value={selectedVenueId || undefined}
            onValueChange={handleVenueChange}
            disabled={loadingVenues}
          >
            <SelectTrigger id="location">
              <SelectValue placeholder={loadingVenues ? "Loading venues..." : "Select a venue..."} />
            </SelectTrigger>
            <SelectContent>
              {venues.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                  No venues available
                </div>
              ) : (
                <>
                  {venues.filter(v => !v.team_id).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        System Venues
                      </div>
                      {venues
                        .filter(v => !v.team_id)
                        .map((venue) => (
                          <SelectItem key={venue.id} value={venue.id}>
                            {venue.name}
                            {venue.region && ` (${venue.region})`}
                          </SelectItem>
                        ))}
                    </>
                  )}
                  {teamId && venues.filter(v => v.team_id === teamId).length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Team Venues
                      </div>
                      {venues
                        .filter(v => v.team_id === teamId)
                        .map((venue) => (
                          <SelectItem key={venue.id} value={venue.id}>
                            {venue.name}
                          </SelectItem>
                        ))}
                    </>
                  )}
                </>
              )}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="location"
            placeholder="Court name, restaurant, etc."
            value={customLocation}
            onChange={(e) => onCustomLocationChange(e.target.value)}
          />
        )}
      </div>

      {canCreateVenue && (
        <VenueDialog
          open={showVenueDialog}
          onOpenChange={setShowVenueDialog}
          venue={null}
          teamId={teamId || ''}
          onSaved={() => {
            setShowVenueDialog(false)
            loadVenues()
          }}
        />
      )}
    </>
  )
}

