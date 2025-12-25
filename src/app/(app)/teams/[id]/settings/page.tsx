'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { Team } from '@/types/database.types'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Save, Loader2, Plus, Edit, Trash2, MapPin, ExternalLink, HelpCircle } from 'lucide-react'
import { VenueDialog } from '@/components/teams/venue-dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getAllTeamColors, getTeamColorName } from '@/lib/team-colors'
import { cn } from '@/lib/utils'

// League options mapping - same as in create-team-dialog
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

export default function TeamSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isCaptain, setIsCaptain] = useState(false)
  const [venues, setVenues] = useState<Venue[]>([])
  const [showVenueDialog, setShowVenueDialog] = useState(false)
  const [editingVenue, setEditingVenue] = useState<any | null>(null)
  const { toast } = useToast()

  // Form state - legacy fields
  const [name, setName] = useState('')
  const [leagueFormat, setLeagueFormat] = useState<'USTA' | 'CUP' | 'FLEX'>('USTA')
  const [season, setSeason] = useState('')
  const [ratingLimit, setRatingLimit] = useState('')
  const [feePerTeam, setFeePerTeam] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [warmupPolicy, setWarmupPolicy] = useState('')
  const [homePhones, setHomePhones] = useState('')

  // Form state - enhanced team fields
  const [organization, setOrganization] = useState<'USTA' | 'CUP' | 'UTR'>('USTA')
  const [league, setLeague] = useState('')
  const [year, setYear] = useState<number>(currentYear)
  const [level, setLevel] = useState('')
  const [flight, setFlight] = useState('')
  const [division, setDivision] = useState('')
  const [facilityMode, setFacilityMode] = useState<'venue' | 'custom'>('venue')
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined)
  const [facilityName, setFacilityName] = useState('')
  const [totalLines, setTotalLines] = useState<number>(3)
  const [maxSetsPerLine, setMaxSetsPerLine] = useState<number>(3)
  const [lineMatchTypes, setLineMatchTypes] = useState<string[]>(['Doubles Match', 'Doubles Match', 'Doubles Match'])
  const [teamColor, setTeamColor] = useState<string>('')
  const [emailTemplate, setEmailTemplate] = useState<string>('')

  useEffect(() => {
    loadTeam()
  }, [teamId])

  async function loadTeam() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (data) {
      setTeam(data)
      setName(data.name)
      setLeagueFormat(data.league_format || 'USTA')
      setSeason(data.season || '')
      setRatingLimit(data.rating_limit?.toString() || '')
      setFeePerTeam(data.fee_per_team?.toString() || '')
      setVenueAddress(data.venue_address || '')
      setWarmupPolicy(data.warmup_policy || '')
      setHomePhones(data.home_phones || '')

      // Load enhanced team fields (with defaults if not set)
      const org = (data.organization as 'USTA' | 'CUP' | 'UTR') || data.league_format || 'USTA'
      setOrganization(org)
      // Auto-set league to CUP if organization is CUP
      setLeague(data.league || (org === 'CUP' ? 'CUP' : ''))
      setYear(data.year || currentYear)
      setLevel(data.level || data.rating_limit?.toString() || '')
      setFlight(data.flight || '')
      setDivision(data.division || '')
      
      // Handle facility
      if (data.facility_id) {
        setFacilityMode('venue')
        setSelectedVenueId(data.facility_id)
        setFacilityName('')
      } else if (data.facility_name) {
        setFacilityMode('custom')
        setFacilityName(data.facility_name)
        setSelectedVenueId(undefined)
      } else {
        setFacilityMode('venue')
        setSelectedVenueId(undefined)
        setFacilityName('')
      }
      
      setTotalLines(data.total_lines || 3)
      setMaxSetsPerLine(data.max_sets_per_line || 3)
      
      // Load team color (if exists, otherwise use hash-based default)
      setTeamColor((data as any).color || getTeamColorName(teamId))
      
      // Load email template (if exists, otherwise use default)
      const defaultTemplate = `Hi {{opponentCaptains}} –

Below are the details for our {{leagueFormat}} Match on {{matchDate}} {{matchTime}} @{{venue}}.
Please familiarize yourself, and your team, with the following policies and procedures.
We look forward to a great match!

{{teamName}}
{{homePhones}}
____________________________________________________________________________

MATCH DAY
Time: Court time is 75 minutes (including warmup).
Payment: ${{feePerTeam}} per team.
Location: {{venueAddress}}
Warmup Courts: {{warmupPolicy}}

Thank you,
{{teamName}}`
      setEmailTemplate((data as any).opponent_email_template || defaultTemplate)
      
      // Load line match types (convert from database format to display format)
      const matchTypeMap: Record<string, string> = {
        'doubles': 'Doubles Match',
        'singles': 'Singles Match',
        'mixed': 'Mixed Doubles',
      }
      
      if (data.line_match_types && Array.isArray(data.line_match_types)) {
        const displayTypes = data.line_match_types.map((type: string) => matchTypeMap[type] || 'Doubles Match')
        // Pad to match totalLines
        while (displayTypes.length < (data.total_lines || 3)) {
          displayTypes.push('Doubles Match')
        }
        setLineMatchTypes(displayTypes.slice(0, data.total_lines || 3))
      } else {
        // Default to all doubles
        const defaultTypes = Array.from({ length: data.total_lines || 3 }, () => 'Doubles Match')
        setLineMatchTypes(defaultTypes)
      }

      // Check if user is captain or co-captain
      if (user && (data.captain_id === user.id || data.co_captain_id === user.id)) {
        setIsCaptain(true)
        loadVenues()
      }
    }
    setLoading(false)
  }

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

    // Load team-specific venues
    const { data: teamVenues, error } = await supabase
      .from('venues')
      .select('*')
      .eq('team_id', teamId)
      .order('name', { ascending: true })

    if (error) {
      // If table doesn't exist yet, that's okay - user hasn't run migration
      if (!error.message.includes('does not exist')) {
        console.error('Error loading venues:', error)
      }
      setVenues(systemVenues || [])
    } else {
      const allVenues = [
        ...(systemVenues || []),
        ...(teamVenues || [])
      ]
      setVenues(allVenues)
    }
  }

  // Update line match types when total lines changes
  useEffect(() => {
    if (totalLines > 0) {
      setLineMatchTypes(prev => {
        const currentTypes = [...prev]
        // Pad or trim to match totalLines
        while (currentTypes.length < totalLines) {
          currentTypes.push('Doubles Match')
        }
        return currentTypes.slice(0, totalLines)
      })
    }
  }, [totalLines])

  // Auto-set league to CUP when organization is CUP
  useEffect(() => {
    if (organization === 'CUP') {
      setLeague('CUP')
    }
  }, [organization])

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

  async function saveSettings() {
    setSaving(true)

    const supabase = createClient()
    
    // Map match type display values to database values
    const matchTypeMap: Record<string, string> = {
      'Doubles Match': 'doubles',
      'Singles Match': 'singles',
      'Mixed Doubles': 'mixed',
    }

    const lineMatchTypesDb = lineMatchTypes
      .slice(0, totalLines)
      .map(type => matchTypeMap[type] || 'doubles')

    // Prepare update data
    const updateData: any = {
      name,
      league_format: leagueFormat,
      season: season || null,
      rating_limit: ratingLimit ? parseFloat(ratingLimit) : null,
      fee_per_team: feePerTeam ? parseFloat(feePerTeam) : 0,
      venue_address: venueAddress || null,
      warmup_policy: warmupPolicy || null,
      home_phones: homePhones || null,
      // Enhanced team fields
      organization,
      league: league || null,
      year: year || null,
      level: level || null,
      flight: flight.trim() || null,
      division: division.trim() || null,
      total_lines: totalLines,
      max_sets_per_line: maxSetsPerLine,
      line_match_types: lineMatchTypesDb,
      // Team color (requires database migration to add color column)
      color: teamColor || null,
      // Email template for opponent captain
      opponent_email_template: emailTemplate || null,
    }

    // Handle facility
    if (facilityMode === 'venue' && selectedVenueId) {
      updateData.facility_id = selectedVenueId
      updateData.facility_name = null
    } else if (facilityMode === 'custom' && facilityName.trim()) {
      updateData.facility_id = null
      updateData.facility_name = facilityName.trim()
    } else {
      updateData.facility_id = null
      updateData.facility_name = null
    }

    const { error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', teamId)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      setSaving(false)
    } else {
      toast({
        title: 'Settings saved',
        description: 'Team settings have been updated',
      })
      // Navigate to teams page to see updated colors
      router.push('/teams')
    }
  }

  if (loading || !team) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Team Settings" />

      <main className="flex-1 p-4 space-y-4">
        {/* Back to Teams Button */}
        <Link href="/teams">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Teams
          </Button>
        </Link>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>League Format</Label>
              <Select value={leagueFormat} onValueChange={(v) => setLeagueFormat(v as 'USTA' | 'CUP' | 'FLEX')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USTA">USTA</SelectItem>
                  <SelectItem value="CUP">CUP</SelectItem>
                  <SelectItem value="FLEX">FLEX</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="season">Season</Label>
                <Input
                  id="season"
                  placeholder="Spring 2025"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rating">Rating Limit</Label>
                <Input
                  id="rating"
                  type="number"
                  step="0.5"
                  value={ratingLimit}
                  onChange={(e) => setRatingLimit(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Match Details</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fee">Fee Per Team ($)</Label>
              <Input
                id="fee"
                type="number"
                placeholder="25"
                value={feePerTeam}
                onChange={(e) => setFeePerTeam(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue">Venue Address</Label>
              <Textarea
                id="venue"
                placeholder="123 Tennis Court Rd..."
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="warmup">Warmup Policy</Label>
              <Textarea
                id="warmup"
                placeholder="Courts available 30 min before..."
                value={warmupPolicy}
                onChange={(e) => setWarmupPolicy(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phones">Captain Phone(s)</Label>
              <Input
                id="phones"
                placeholder="(555) 123-4567"
                value={homePhones}
                onChange={(e) => setHomePhones(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Team Settings - Only for Captains */}
        {isCaptain && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Enhanced Team Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {/* Section 0: Team Color */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-base font-semibold">Team Color</h3>
                <div className="space-y-2">
                  <Label>Calendar Display Color</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose a color to help identify this team in calendar views
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getAllTeamColors().map((color) => (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => setTeamColor(color.name)}
                        className={cn(
                          "w-10 h-10 rounded-full border-2 transition-all",
                          teamColor === color.name ? "border-foreground scale-110" : "border-muted hover:scale-105",
                          color.bgClass
                        )}
                        title={color.name.charAt(0).toUpperCase() + color.name.slice(1)}
                      />
                    ))}
                  </div>
                  {teamColor && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {teamColor.charAt(0).toUpperCase() + teamColor.slice(1)}
                    </p>
                  )}
                </div>
              </div>

              {/* Email Template Section */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-base font-semibold">Email Template for Opponent Captain</h3>
                <div className="space-y-2">
                  <Label htmlFor="emailTemplate">Welcome Email Template</Label>
                  <p className="text-sm text-muted-foreground">
                    Customize the email template sent to opponent captains. Use placeholders: {'{'}
                    {'{'}opponentCaptains{'}'}, {'{'}{'{'}leagueFormat{'}'}, {'{'}{'{'}matchDate{'}'}, {'{'}{'{'}matchTime{'}'}, {'{'}{'{'}venue{'}'}, {'{'}{'{'}teamName{'}'}, {'{'}{'{'}homePhones{'}'}, {'{'}{'{'}feePerTeam{'}'}, {'{'}{'{'}venueAddress{'}'}, {'{'}{'{'}warmupPolicy{'}'}
                  </p>
                  <Textarea
                    id="emailTemplate"
                    value={emailTemplate}
                    onChange={(e) => setEmailTemplate(e.target.value)}
                    rows={15}
                    className="font-mono text-sm"
                    placeholder="Enter email template..."
                  />
                </div>
              </div>

              {/* Section 1: General Details */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="text-base font-semibold">General Details</h3>
                
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
                    <Label htmlFor="season-enhanced">
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
                  <Label htmlFor="level-enhanced">
                    Level <span className="text-destructive">*</span>
                  </Label>
                  {organization === 'CUP' ? (
                    <Select value={level} onValueChange={setLevel}>
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
                      id="level-enhanced"
                      type="number"
                      step="0.5"
                      min="1.0"
                      max="7.0"
                      placeholder="e.g., 3.5"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="flight-enhanced">Flight</Label>
                    <Input
                      id="flight-enhanced"
                      placeholder="e.g., A, B, 1, 2"
                      value={flight}
                      onChange={(e) => setFlight(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="division-enhanced">Division</Label>
                    <Input
                      id="division-enhanced"
                      placeholder="e.g., North, South"
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="facility-enhanced">
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
                      id="facility-enhanced"
                      placeholder="Enter facility name"
                      value={facilityName}
                      onChange={(e) => setFacilityName(e.target.value)}
                    />
                  )}
                </div>
              </div>

              {/* Section 2: Team & Match Information */}
              <div className="space-y-4 pt-4">
                <h3 className="text-base font-semibold">Team & Match Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="totalLines-enhanced">
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
                      id="totalLines-enhanced"
                      type="number"
                      min="1"
                      max="10"
                      value={totalLines}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 3
                        setTotalLines(Math.max(1, Math.min(10, val)))
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="maxSets-enhanced">
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
                      id="maxSets-enhanced"
                      type="number"
                      min="1"
                      max="5"
                      value={maxSetsPerLine}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 3
                        setMaxSetsPerLine(Math.max(1, Math.min(5, val)))
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Match Type per Line <span className="text-destructive">*</span></Label>
                  <div className="space-y-2">
                    {Array.from({ length: totalLines }, (_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Label htmlFor={`line-enhanced-${i + 1}`} className="w-16 text-sm">
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
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button className="flex-1" onClick={saveSettings} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>

        {/* Venues Management - Only for Captains */}
        {isCaptain && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Tennis Court Locations</CardTitle>
                <Button
                  size="sm"
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
            <CardContent className="p-4 pt-2">
              {venues.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No venues added yet. Click "Add Venue" to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {venues.map((venue) => (
                    <div
                      key={venue.id}
                      className="flex items-start justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">{venue.name}</h4>
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
        )}

        <VenueDialog
          open={showVenueDialog}
          onOpenChange={setShowVenueDialog}
          venue={editingVenue}
          teamId={teamId}
          onSaved={loadVenues}
        />
      </main>
    </div>
  )
}
