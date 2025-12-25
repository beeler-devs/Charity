'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useToast } from '@/hooks/use-toast'
import { Loader2, HelpCircle, Plus } from 'lucide-react'
import { VenueDialog } from './venue-dialog'

interface CreateTeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

// League options mapping - will be populated by user later
const leagueOptions: Record<string, string[]> = {
  USTA: [
    'Womens 18 & Over',
    'Womens 40 & Over',
    'Womens 55 & Over',
    'Mens 18 & Over',
    'Mens 40 & Over',
    'Mens 55 & Over',
    'Mixed 18 & Over',
    'Mixed 40 & Over',
    'Mixed 55 & Over',
  ],
  CUP: ['CUP'], // League is always CUP for CUP organization
  UTR: [], // To be populated
}

// Level options for CUP organization
const cupLevelOptions = ['KingCo', 'Challenge', 'Rainier', 'Classic', 'Emerald', 'Evergreen']

const seasons = ['Spring', 'Summer', 'Fall', 'Winter']
const matchTypes = ['Doubles Match', 'Singles Match', 'Mixed Doubles']

// Generate year options (current year + next 3 years)
const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 4 }, (_, i) => currentYear + i)

interface Venue {
  id: string
  name: string
  address: string | null
  google_maps_link: string | null
  region?: string | null
  is_active?: boolean
  team_id?: string | null
  default_court_time?: number | null
}

export function CreateTeamDialog({ open, onOpenChange, onCreated }: CreateTeamDialogProps) {
  // Section 1: General Details
  const [organization, setOrganization] = useState<'USTA' | 'CUP' | 'UTR'>('USTA')
  const [league, setLeague] = useState('')
  const [season, setSeason] = useState('')
  const [year, setYear] = useState<number>(currentYear)
  const [level, setLevel] = useState('')
  const [flight, setFlight] = useState('')
  const [division, setDivision] = useState('')
  
  // Facility
  const [facilityMode, setFacilityMode] = useState<'venue' | 'custom'>('venue')
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined)
  const [facilityName, setFacilityName] = useState('')
  const [venues, setVenues] = useState<Venue[]>([])
  const [showVenueDialog, setShowVenueDialog] = useState(false)
  
  // Section 2: Team & Match Information
  const [name, setName] = useState('')
  const [totalLines, setTotalLines] = useState<number>(3)
  const [maxSetsPerLine, setMaxSetsPerLine] = useState<number>(3)
  const [lineMatchTypes, setLineMatchTypes] = useState<string[]>(['Doubles Match', 'Doubles Match', 'Doubles Match'])
  
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  
  // Temporary team ID for venue creation (will be set after team is created)
  const [tempTeamId, setTempTeamId] = useState('')

  // Load venues when dialog opens
  useEffect(() => {
    if (open) {
      loadVenues()
    }
  }, [open])

  // Update line match types when total lines changes
  useEffect(() => {
    if (totalLines > 0) {
      const currentTypes = [...lineMatchTypes]
      // Pad or trim to match totalLines
      while (currentTypes.length < totalLines) {
        currentTypes.push('Doubles Match')
      }
      setLineMatchTypes(currentTypes.slice(0, totalLines))
    }
  }, [totalLines])

  // Reset league when organization changes, and auto-set for CUP
  useEffect(() => {
    if (organization === 'CUP') {
      setLeague('CUP')
    } else {
      setLeague('')
    }
  }, [organization])

  async function loadVenues() {
    const supabase = createClient()
    
    // Load system-wide active venues
    const { data: systemVenues } = await supabase
      .from('venues')
      .select('*')
      .is('team_id', null)
      .eq('is_active', true)
      .order('region', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    setVenues(systemVenues || [])
  }

  function resetForm() {
    setOrganization('USTA')
    setLeague('')
    setSeason('')
    setYear(currentYear)
    setLevel('')
    setFlight('')
    setDivision('')
    setFacilityMode('venue')
    setSelectedVenueId(undefined)
    setFacilityName('')
    setName('')
    setTotalLines(3)
    setMaxSetsPerLine(3)
    setLineMatchTypes(['Doubles Match', 'Doubles Match', 'Doubles Match'])
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a team',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    // Validation
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Team name is required',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    if (!organization) {
      toast({
        title: 'Error',
        description: 'Organization is required',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    if (!league) {
      toast({
        title: 'Error',
        description: 'League is required',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    if (!season) {
      toast({
        title: 'Error',
        description: 'Season is required',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    if (!level) {
      toast({
        title: 'Error',
        description: 'Level is required',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    // Validate facility
    if (facilityMode === 'venue' && !selectedVenueId) {
      toast({
        title: 'Error',
        description: 'Please select a facility or enter a custom facility name',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    if (facilityMode === 'custom' && !facilityName.trim()) {
      toast({
        title: 'Error',
        description: 'Facility name is required',
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    // Ensure profile exists before creating team
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!existingProfile) {
      // Create profile if it doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
        })

      if (profileError) {
        toast({
          title: 'Error',
          description: `Failed to create profile: ${profileError.message}`,
          variant: 'destructive',
        })
        setLoading(false)
        return
      }
    }

    // Map match type display values to database values
    // The lineMatchTypes array contains display values like "Doubles Match"
    // We need to convert them to database values like "doubles"
    const matchTypeMap: Record<string, string> = {
      'Doubles Match': 'doubles',
      'Singles Match': 'singles',
      'Mixed Doubles': 'mixed',
    }

    const lineMatchTypesDb = lineMatchTypes
      .slice(0, totalLines)
      .map(type => matchTypeMap[type] || 'doubles')

    // Prepare team data
    const teamData: any = {
      name: name.trim(),
      captain_id: user.id,
      organization,
      league,
      year,
      level,
      flight: flight.trim() || null,
      division: division.trim() || null,
      total_lines: totalLines,
      max_sets_per_line: maxSetsPerLine,
      line_match_types: lineMatchTypesDb,
    }

    // Handle facility
    if (facilityMode === 'venue' && selectedVenueId) {
      teamData.facility_id = selectedVenueId
      teamData.facility_name = null
    } else if (facilityMode === 'custom' && facilityName.trim()) {
      teamData.facility_id = null
      teamData.facility_name = facilityName.trim()
    }

    // Also set legacy fields for backward compatibility
    teamData.league_format = organization
    teamData.season = season
    teamData.rating_limit = level ? parseFloat(level) : null

    const { data: newTeam, error } = await supabase
      .from('teams')
      .insert(teamData)
      .select()
      .single()

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      setLoading(false)
      return
    }

    toast({
      title: 'Team created',
      description: `${name} has been created successfully`,
    })
    
    resetForm()
    onCreated()
    setLoading(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Add a new team to manage your roster and matches
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-6 py-4">
              {/* Section 1: General Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">General Details</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="organization">
                      Organization <span className="text-destructive">*</span>
                    </Label>
                    <Select value={organization} onValueChange={(v) => setOrganization(v as 'USTA' | 'CUP' | 'UTR')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USTA">USTA</SelectItem>
                        <SelectItem value="CUP">CUP</SelectItem>
                        <SelectItem value="UTR">UTR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="league">
                      League <span className="text-destructive">*</span>
                    </Label>
                    {organization === 'CUP' ? (
                      <Input
                        id="league"
                        value="CUP"
                        disabled
                        className="bg-muted"
                      />
                    ) : (
                      <Select value={league} onValueChange={setLeague} disabled={!organization}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select league" />
                        </SelectTrigger>
                        <SelectContent>
                          {leagueOptions[organization]?.length > 0 ? (
                            leagueOptions[organization].map((leagueOption) => (
                              <SelectItem key={leagueOption} value={leagueOption}>
                                {leagueOption}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="p-2 text-sm text-muted-foreground">No leagues available</div>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="season">
                      Season <span className="text-destructive">*</span>
                    </Label>
                    <Select value={season} onValueChange={setSeason}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select season" />
                      </SelectTrigger>
                      <SelectContent>
                        {seasons.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="year">
                      Year <span className="text-destructive">*</span>
                    </Label>
                    <Select value={year.toString()} onValueChange={(v) => setYear(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">
                    Level <span className="text-destructive">*</span>
                  </Label>
                  {organization === 'CUP' ? (
                    <Select value={level} onValueChange={setLevel} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {cupLevelOptions.map((cupLevel) => (
                          <SelectItem key={cupLevel} value={cupLevel}>
                            {cupLevel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="level"
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="7.0"
                      placeholder="e.g., 3.5"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      required
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="flight">Flight</Label>
                    <Input
                      id="flight"
                      placeholder="e.g., A, B, 1, 2"
                      value={flight}
                      onChange={(e) => setFlight(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="division">Division</Label>
                    <Input
                      id="division"
                      placeholder="e.g., North, South"
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="facility">
                      Facility Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Select value={facilityMode} onValueChange={(v) => {
                        setFacilityMode(v as 'venue' | 'custom')
                        if (v === 'custom') {
                          setSelectedVenueId(undefined)
                        } else {
                          setFacilityName('')
                        }
                      }}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="venue">Select Venue</SelectItem>
                          <SelectItem value="custom">Enter Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      {facilityMode === 'venue' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowVenueDialog(true)}
                          title="Add New Facility"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          New
                        </Button>
                      )}
                    </div>
                  </div>

                  {facilityMode === 'venue' ? (
                    <Select
                      value={selectedVenueId || undefined}
                      onValueChange={(v) => {
                        setSelectedVenueId(v)
                        const venue = venues.find(ven => ven.id === v)
                        if (venue) {
                          setFacilityName(`${venue.name}${venue.address ? ` - ${venue.address}` : ''}`)
                        }
                      }}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a facility" />
                      </SelectTrigger>
                      <SelectContent>
                        {venues.length > 0 ? (
                          venues.map((venue) => (
                            <SelectItem key={venue.id} value={venue.id}>
                              {venue.name}{venue.address ? ` - ${venue.address}` : ''}
                              {venue.region && ` (${venue.region})`}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground">No venues available</div>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="facility"
                      placeholder="Enter facility name"
                      value={facilityName}
                      onChange={(e) => setFacilityName(e.target.value)}
                      required
                    />
                  )}
                </div>
              </div>

              {/* Section 2: Team & Match Information */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Team & Match Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Team Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g., Spring 4.0 Mixed"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Only shown to your team and can be fun or serious
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="totalLines">
                        Total Number of Lines/Positions <span className="text-destructive">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="inline-flex">
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <p className="text-sm">
                            The number of courts/positions that will be used for matches. Typically 3 for CUP leagues.
                          </p>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Input
                      id="totalLines"
                      type="number"
                      min="1"
                      max="10"
                      value={totalLines}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 3
                        setTotalLines(Math.max(1, Math.min(10, val)))
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="maxSets">
                        Max Sets Played Per Line <span className="text-destructive">*</span>
                      </Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button type="button" className="inline-flex">
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64">
                          <p className="text-sm">
                            The maximum number of sets that will be played per line/court. Typically 3 sets.
                          </p>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Input
                      id="maxSets"
                      type="number"
                      min="1"
                      max="5"
                      value={maxSetsPerLine}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 3
                        setMaxSetsPerLine(Math.max(1, Math.min(5, val)))
                      }}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Match Type per Line <span className="text-destructive">*</span></Label>
                  <div className="space-y-2">
                    {Array.from({ length: totalLines }, (_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Label htmlFor={`line-${i + 1}`} className="w-16 text-sm">
                          Line {i + 1}:
                        </Label>
                        <Select
                          value={lineMatchTypes[i] || 'Doubles Match'}
                          onValueChange={(v) => {
                            const newTypes = [...lineMatchTypes]
                            newTypes[i] = v
                            setLineMatchTypes(newTypes)
                          }}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {matchTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !name || !organization || !league || !season || !level || (facilityMode === 'venue' && !selectedVenueId) || (facilityMode === 'custom' && !facilityName.trim())}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Team
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Venue Dialog */}
      <VenueDialog
        open={showVenueDialog}
        onOpenChange={setShowVenueDialog}
        venue={null}
        teamId={tempTeamId || ''}
        onSaved={() => {
          loadVenues()
        }}
      />
    </>
  )
}
