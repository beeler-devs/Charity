'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Team } from '@/types/database.types'

// Define Match type locally since it's not exported from database.types
type Match = {
  id: string
  team_id: string
  date: string
  time: string
  opponent_name: string
  venue?: string | null
  venue_address?: string | null
  opponent_captain_name?: string | null
  opponent_captain_email?: string | null
  opponent_captain_phone?: string | null
  opponent_captain_name2?: string | null
  opponent_captain_email2?: string | null
  opponent_captain_phone2?: string | null
  is_home: boolean
  warm_up_status?: 'booked' | 'none_yet' | 'no_warmup' | null
  warm_up_time?: string | null
  warm_up_court?: string | null
  checklist_status?: Record<string, boolean> | null
  duration?: number | null
  [key: string]: any
}
import { formatDate, formatTime, getWarmupMessage, cn, formatCourtLabel } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle,
  Circle,
  Mail,
  ClipboardList,
  Thermometer,
  Trophy,
  Edit,
  Save,
  XCircle,
  Loader2,
  Timer,
  Trash2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  X,
  ArrowLeft
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScoreEntryDialog } from '@/components/matches/score-entry-dialog'
import { MatchResultBadge } from '@/components/matches/match-result-badge'
import { formatScoreDisplay } from '@/lib/score-utils'
import { VenueDialog } from '@/components/teams/venue-dialog'

interface ChecklistItem {
  days: number
  task: string
  completed: boolean
}

export default function MatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const teamId = params.id as string
  const matchId = params.matchId as string
  const [match, setMatch] = useState<Match | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [isCaptain, setIsCaptain] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editedMatch, setEditedMatch] = useState<Partial<Match>>({})
  const [saving, setSaving] = useState(false)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false)
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false)
  const [courtScores, setCourtScores] = useState<any[]>([])
  const [lineups, setLineups] = useState<any[]>([])
  const [showLineup, setShowLineup] = useState(false)
  const [availabilitySummary, setAvailabilitySummary] = useState<{
    available: number
    maybe: number
    unavailable: number
    total: number
  }>({ available: 0, maybe: 0, unavailable: 0, total: 0 })
  const [availabilityDetails, setAvailabilityDetails] = useState<{
    available: Array<{ id: string; name: string }>
    maybe: Array<{ id: string; name: string }>
    unavailable: Array<{ id: string; name: string }>
  }>({ available: [], maybe: [], unavailable: [] })
  const [expandedAvailability, setExpandedAvailability] = useState<{
    available: boolean
    maybe: boolean
    unavailable: boolean
  }>({ available: false, maybe: false, unavailable: false })
  const { toast } = useToast()

  const [warmupStatus, setWarmupStatus] = useState<'booked' | 'none_yet' | 'no_warmup'>('none_yet')
  const [warmupTime, setWarmupTime] = useState('')
  const [warmupCourt, setWarmupCourt] = useState('')
  const [warmupLocationMode, setWarmupLocationMode] = useState<'venue' | 'custom'>('custom')
  const [selectedWarmupVenueId, setSelectedWarmupVenueId] = useState<string | null>(null)
  const [warmupVenues, setWarmupVenues] = useState<Array<{ id: string; name: string; address: string | null; team_id: string | null }>>([])
  const [showWarmupVenueDialog, setShowWarmupVenueDialog] = useState(false)
  const [teamFacilityName, setTeamFacilityName] = useState<string | null>(null)
  const [teamFacilityAddress, setTeamFacilityAddress] = useState<string | null>(null)
  const [lineMatchTypes, setLineMatchTypes] = useState<string[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { days: 14, task: 'Order balls', completed: false },
    { days: 10, task: 'Email opponent captain', completed: false },
    { days: 7, task: 'Book warm-up court', completed: false },
    { days: 4, task: 'Post lineup', completed: false },
  ])

  useEffect(() => {
    loadMatchData()
  }, [matchId])

  async function loadWarmupVenues(existingCourtValue?: string) {
    const supabase = createClient()
    
    // Load system venues and team-specific venues
    const { data: systemVenues } = await supabase
      .from('venues')
      .select('id, name, address, team_id')
      .eq('is_active', true)
      .is('team_id', null)
      .order('name')

    const { data: teamVenues } = await supabase
      .from('venues')
      .select('id, name, address, team_id')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('name')

    const allVenues = [
      ...(systemVenues || []),
      ...(teamVenues || [])
    ]

    setWarmupVenues(allVenues)

    // If existingCourtValue exists, try to match it to a venue
    const courtValue = existingCourtValue || warmupCourt
    if (courtValue) {
      const matchedVenue = allVenues.find(v => {
        const venueDisplay = v.address ? `${v.name} - ${v.address}` : v.name
        return venueDisplay === courtValue || courtValue.includes(v.name)
      })
      if (matchedVenue) {
        setWarmupLocationMode('venue')
        setSelectedWarmupVenueId(matchedVenue.id)
      } else {
        setWarmupLocationMode('custom')
        setSelectedWarmupVenueId(null)
      }
    } else {
      setWarmupLocationMode('custom')
      setSelectedWarmupVenueId(null)
    }
  }

  async function loadMatchData() {
    const supabase = createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchData) {
      setMatch(matchData)
      setEditedMatch({
        opponent_name: matchData.opponent_name,
        date: matchData.date,
        time: matchData.time,
        duration: (matchData as any).duration || null,
        venue: matchData.venue,
        venue_address: matchData.venue_address,
        opponent_captain_name: matchData.opponent_captain_name,
        opponent_captain_email: matchData.opponent_captain_email,
        opponent_captain_phone: (matchData as any).opponent_captain_phone || null,
        opponent_captain_name2: (matchData as any).opponent_captain_name2 || null,
        opponent_captain_email2: (matchData as any).opponent_captain_email2 || null,
        opponent_captain_phone2: (matchData as any).opponent_captain_phone2 || null,
        is_home: matchData.is_home,
      } as any)
      setWarmupStatus(matchData.warm_up_status)
      setWarmupTime(matchData.warm_up_time || '')
      const courtValue = matchData.warm_up_court || ''
      setWarmupCourt(courtValue)
      
      // Load venues and determine location mode
      await loadWarmupVenues(courtValue)

      if (matchData.checklist_status) {
        const status = matchData.checklist_status as Record<string, boolean>
        setChecklist(prev =>
          prev.map(item => ({
            ...item,
            completed: status[`${item.days}d`] || false,
          }))
        )
      }
    }

    const { data: teamData } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (teamData) {
      setTeam(teamData)
      
      // Load and format line_match_types
      const matchTypeMap: Record<string, string> = {
        'doubles': 'Doubles Match',
        'singles': 'Singles Match',
        'mixed': 'Mixed Doubles',
      }
      let matchTypes: string[] = []
      if (teamData.line_match_types && Array.isArray(teamData.line_match_types)) {
        matchTypes = teamData.line_match_types.map((type: string) => matchTypeMap[type] || 'Doubles Match')
        const lines = teamData.total_lines || 3
        while (matchTypes.length < lines) {
          matchTypes.push('Doubles Match')
        }
        matchTypes = matchTypes.slice(0, lines)
      } else {
        const lines = teamData.total_lines || 3
        matchTypes = Array.from({ length: lines }, () => 'Doubles Match')
      }
      setLineMatchTypes(matchTypes)
      
      // Load team facility
      if (teamData.facility_id) {
        // Load venue details if facility_id is set
        const { data: venueData } = await supabase
          .from('venues')
          .select('name, address')
          .eq('id', teamData.facility_id)
          .single()

        if (venueData) {
          setTeamFacilityName(venueData.name)
          setTeamFacilityAddress(venueData.address || null)
        }
      } else if (teamData.facility_name) {
        // Use facility_name directly
        setTeamFacilityName(teamData.facility_name)
        setTeamFacilityAddress(null)
      }
      
      // Check if current user is captain or co-captain
      const isUserCaptain = user && (teamData.captain_id === user.id || teamData.co_captain_id === user.id)
      if (isUserCaptain) {
        setIsCaptain(true)
      }
      
      // Load court-by-court scores if available (pass captain status)
      await loadCourtScores(isUserCaptain || false)
      await loadLineups(isUserCaptain || false)
    }

    await loadAvailabilitySummary()
    // Warmup venues will be loaded after warmupCourt is set

    setLoading(false)

    // Auto-enter edit mode for captains when match loads
    if (matchData && teamData && user && (teamData.captain_id === user.id || teamData.co_captain_id === user.id)) {
      setIsEditing(true)
    }
  }

  async function loadLineups(isUserCaptain: boolean = false) {
    const supabase = createClient()
    
    // Load lineups - captains see all, players only see published
    let lineupsQuery = supabase
      .from('lineups')
      .select(`
        id,
        court_slot,
        player1:roster_members!lineups_player1_id_fkey(full_name),
        player2:roster_members!lineups_player2_id_fkey(full_name)
      `)
      .eq('match_id', matchId)
    
    // If user is not a captain, filter to only published lineups
    if (!isUserCaptain) {
      lineupsQuery = lineupsQuery.eq('is_published', true)
    }
    
    const { data: lineupsData } = await lineupsQuery.order('court_slot', { ascending: true })

    if (lineupsData) {
      setLineups(lineupsData)
    }
  }

  async function loadAvailabilitySummary() {
    const supabase = createClient()
    
    // Load all roster members for the team with names
    const { data: rosterMembers } = await supabase
      .from('roster_members')
      .select('id, full_name')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('full_name')

    if (!rosterMembers || rosterMembers.length === 0) {
      setAvailabilitySummary({ available: 0, maybe: 0, unavailable: 0, total: 0 })
      setAvailabilityDetails({ available: [], maybe: [], unavailable: [] })
      return
    }

    const rosterMemberIds = rosterMembers.map(rm => rm.id)
    const rosterMap = new Map(rosterMembers.map(rm => [rm.id, rm.full_name]))

    // Load availability for this match
    const { data: availability } = await supabase
      .from('availability')
      .select('status, roster_member_id')
      .eq('match_id', matchId)
      .in('roster_member_id', rosterMemberIds)

    const availablePlayers: Array<{ id: string; name: string }> = []
    const maybePlayers: Array<{ id: string; name: string }> = []
    const unavailablePlayers: Array<{ id: string; name: string }> = []
    const respondedIds = new Set<string>()
    const processedPlayerIds = new Set<string>() // Track players we've already added

    if (availability) {
      availability.forEach(avail => {
        // Skip if we've already processed this player (handle duplicate records)
        if (processedPlayerIds.has(avail.roster_member_id)) {
          return
        }
        
        // Only process if this player is in our roster
        if (!rosterMap.has(avail.roster_member_id)) {
          return
        }
        
        const playerName = rosterMap.get(avail.roster_member_id) || 'Unknown'
        const playerInfo = { id: avail.roster_member_id, name: playerName }
        respondedIds.add(avail.roster_member_id)
        processedPlayerIds.add(avail.roster_member_id)
        
        if (avail.status === 'available') {
          availablePlayers.push(playerInfo)
        } else if (avail.status === 'maybe' || avail.status === 'last_resort') {
          maybePlayers.push(playerInfo)
        } else {
          unavailablePlayers.push(playerInfo)
        }
      })
    }

    // Add players without availability responses as unavailable
    rosterMembers.forEach(rm => {
      if (!respondedIds.has(rm.id)) {
        unavailablePlayers.push({ id: rm.id, name: rm.full_name })
      }
    })

    setAvailabilitySummary({
      available: availablePlayers.length,
      maybe: maybePlayers.length,
      unavailable: unavailablePlayers.length,
      total: rosterMembers.length
    })

    setAvailabilityDetails({
      available: availablePlayers.sort((a, b) => a.name.localeCompare(b.name)),
      maybe: maybePlayers.sort((a, b) => a.name.localeCompare(b.name)),
      unavailable: unavailablePlayers.sort((a, b) => a.name.localeCompare(b.name))
    })
  }

  async function loadCourtScores(isUserCaptain: boolean = false) {
    const supabase = createClient()
    
    // Load lineups - captains see all, players only see published
    let lineupsQuery = supabase
      .from('lineups')
      .select(`
        id,
        court_slot,
        player1:roster_members!lineups_player1_id_fkey(full_name),
        player2:roster_members!lineups_player2_id_fkey(full_name)
      `)
      .eq('match_id', matchId)
    
    // If user is not a captain, filter to only published lineups
    if (!isUserCaptain) {
      lineupsQuery = lineupsQuery.eq('is_published', true)
    }
    
    const { data: lineups } = await lineupsQuery.order('court_slot', { ascending: true })

    if (!lineups || lineups.length === 0) return

    // Get scores for these lineups
    const lineupIds = lineups.map(l => l.id)
    const { data: scores } = await supabase
      .from('match_scores')
      .select('*')
      .in('lineup_id', lineupIds)
      .order('lineup_id')
      .order('set_number')

    if (scores && scores.length > 0) {
      // Group scores by lineup
      const scoresByLineup = new Map()
      scores.forEach(score => {
        const existing = scoresByLineup.get(score.lineup_id) || []
        scoresByLineup.set(score.lineup_id, [...existing, score])
      })

      // Combine lineups with their scores
      const courtsWithScores = lineups.map(lineup => ({
        court_slot: lineup.court_slot,
        player1: lineup.player1,
        player2: lineup.player2,
        scores: scoresByLineup.get(lineup.id) || [],
      }))

      setCourtScores(courtsWithScores)
    }
  }

  async function updateWarmup() {
    const supabase = createClient()

    // Determine court value based on location mode
    let courtValue: string | null = null
    if (warmupStatus === 'booked') {
      if (warmupLocationMode === 'venue' && selectedWarmupVenueId) {
        const venue = warmupVenues.find(v => v.id === selectedWarmupVenueId)
        if (venue) {
          courtValue = venue.address ? `${venue.name} - ${venue.address}` : venue.name
        }
      } else {
        courtValue = warmupCourt || null
      }
    }

    const { error } = await supabase
      .from('matches')
      .update({
        warm_up_status: warmupStatus,
        warm_up_time: warmupStatus === 'booked' ? warmupTime : null,
        warm_up_court: courtValue,
      })
      .eq('id', matchId)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Warm-up updated',
        description: 'Warm-up details have been saved',
      })
    }
  }

  async function toggleChecklistItem(index: number) {
    const newChecklist = [...checklist]
    newChecklist[index].completed = !newChecklist[index].completed

    const status: Record<string, boolean> = {}
    newChecklist.forEach(item => {
      status[`${item.days}d`] = item.completed
    })

    const supabase = createClient()
    await supabase
      .from('matches')
      .update({ checklist_status: status })
      .eq('id', matchId)

    setChecklist(newChecklist)
  }

  function getEmailLink() {
    if (!match || !team) return '#'

    const subject = encodeURIComponent(
      `${team.league_format} Match – ${formatDate(match.date)} ${formatTime(match.time)} @ ${match.venue || 'TBD'}`
    )

    const body = encodeURIComponent(`Hi –

Below are the details for our ${team.league_format} Match on ${formatDate(match.date)} ${formatTime(match.time)} @${match.venue || 'TBD'}.
Please familiarize yourself, and your team, with the following policies and procedures.
We look forward to a great match!

____________________________________________________________________________

MATCH DAY
Time: Court time is 75 minutes (including warmup).
Payment: $${team.fee_per_team} per team.
Location: ${team.venue_address || match.venue || 'TBD'}
Warmup Courts: ${team.warmup_policy || 'TBD'}

Thank you`)

    return `mailto:${match.opponent_captain_email || ''}?subject=${subject}&body=${body}`
  }

  function canEnterScores(): boolean {
    if (!isCaptain || !match) return false
    
    // Can only enter scores on or after match date
    const matchDate = new Date(match.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    matchDate.setHours(0, 0, 0, 0)
    
    return matchDate <= today
  }

  function handleStartEdit() {
    if (match) {
      // Default venue to team facility if home match and venue is empty
      let venue = match.venue
      let venueAddress = match.venue_address
      
      if (match.is_home && !venue && teamFacilityName) {
        venue = teamFacilityName
        venueAddress = teamFacilityAddress || null
      }
      
      setEditedMatch({
        opponent_name: match.opponent_name,
        date: match.date,
        time: match.time,
        duration: (match as any).duration || null,
        venue: venue,
        venue_address: venueAddress,
        opponent_captain_name: match.opponent_captain_name,
        opponent_captain_email: match.opponent_captain_email,
        is_home: match.is_home,
      })
      setIsEditing(true)
    }
  }

  // Update venue when is_home changes to true
  useEffect(() => {
    if (isEditing && editedMatch.is_home && !editedMatch.venue && teamFacilityName) {
      setEditedMatch(prev => ({
        ...prev,
        venue: teamFacilityName,
        venue_address: teamFacilityAddress || null,
      }))
    } else if (isEditing && !editedMatch.is_home && editedMatch.venue === teamFacilityName) {
      // Clear venue when switching to away match if it was the team facility
      setEditedMatch(prev => ({
        ...prev,
        venue: '',
        venue_address: null,
      }))
    }
  }, [editedMatch.is_home, isEditing, teamFacilityName, teamFacilityAddress])

  function handleCancelEdit() {
    // Reset form to original values
    if (match) {
      setEditedMatch({
        opponent_name: match.opponent_name,
        date: match.date,
        time: match.time,
        duration: (match as any).duration || null,
        venue: match.venue,
        venue_address: match.venue_address,
        opponent_captain_name: match.opponent_captain_name,
        opponent_captain_email: match.opponent_captain_email,
        is_home: match.is_home,
      })
    }
    setIsEditing(false)
    // Navigate back to previous page (calendar, teams page, etc.)
    router.back()
  }

  async function handleSaveChanges() {
    if (!match) return

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('matches')
      .update({
        opponent_name: editedMatch.opponent_name,
        date: editedMatch.date,
        time: editedMatch.time,
        duration: editedMatch.duration ? parseInt(editedMatch.duration.toString()) : null,
        venue: editedMatch.venue || null,
        venue_address: editedMatch.venue_address || null,
        opponent_captain_name: editedMatch.opponent_captain_name || null,
        opponent_captain_email: editedMatch.opponent_captain_email || null,
        opponent_captain_phone: (editedMatch as any).opponent_captain_phone || null,
        opponent_captain_name2: (editedMatch as any).opponent_captain_name2 || null,
        opponent_captain_email2: (editedMatch as any).opponent_captain_email2 || null,
        opponent_captain_phone2: (editedMatch as any).opponent_captain_phone2 || null,
        is_home: editedMatch.is_home ?? true,
      })
      .eq('id', match.id)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      setSaving(false)
    } else {
      toast({
        title: 'Match updated',
        description: 'The match has been updated successfully',
      })
      setIsEditing(false)
      setSaving(false)
      loadMatchData()
    }
  }

  async function handleDeleteConfirm() {
    const supabase = createClient()

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
      setShowDeleteAlert(false)
    } else {
      toast({
        title: 'Match deleted',
        description: 'The match has been deleted successfully',
      })
      setShowDeleteAlert(false)
      // Navigate back to previous page (calendar, teams page, etc.)
      router.back()
    }
  }

  if (loading || !match) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Match Details" />

      <main className="flex-1 p-4 space-y-4">
        {/* Back Button */}
        <div className="mb-2">
          <Button variant="ghost" onClick={() => router.back()} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        {/* Match Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              {isEditing ? (
                <Input
                  value={editedMatch.opponent_name || ''}
                  onChange={(e) => setEditedMatch({ ...editedMatch, opponent_name: e.target.value })}
                  className="text-lg font-semibold"
                  placeholder="Opponent name"
                />
              ) : (
                <h2 className="text-lg font-semibold">vs {match.opponent_name}</h2>
              )}
              {!isEditing && (
                <div className="flex items-center gap-2">
                  <MatchResultBadge 
                    result={match.match_result as 'win' | 'loss' | 'tie' | 'pending'}
                    scoreSummary={match.score_summary || undefined}
                  />
                  <Badge variant={match.is_home ? 'default' : 'outline'}>
                    {match.is_home ? 'Home' : 'Away'}
                  </Badge>
                </div>
              )}
              {isEditing && (
                <Select
                  value={editedMatch.is_home ? 'home' : 'away'}
                  onValueChange={(value) => setEditedMatch({ ...editedMatch, is_home: value === 'home' })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="away">Away</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <Input
                    type="date"
                    value={editedMatch.date || ''}
                    onChange={(e) => setEditedMatch({ ...editedMatch, date: e.target.value })}
                    className="flex-1"
                  />
                ) : (
                  formatDate(match.date, 'EEEE, MMMM d, yyyy')
                )}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <Input
                    type="time"
                    value={editedMatch.time || ''}
                    onChange={(e) => setEditedMatch({ ...editedMatch, time: e.target.value })}
                    className="flex-1"
                  />
                ) : (
                  formatTime(match.time)
                )}
              </div>
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <Input
                    type="number"
                    placeholder="Duration (minutes)"
                    value={editedMatch.duration?.toString() || ''}
                    onChange={(e) => setEditedMatch({ ...editedMatch, duration: e.target.value ? parseInt(e.target.value) : null })}
                    className="flex-1"
                    min="0"
                  />
                ) : (
                  (match as any).duration ? (
                    <span>
                      {(() => {
                        const hours = Math.floor((match as any).duration / 60)
                        const minutes = (match as any).duration % 60
                        if (hours > 0 && minutes > 0) {
                          return `${hours}h ${minutes}m`
                        } else if (hours > 0) {
                          return `${hours}h`
                        } else {
                          return `${minutes}m`
                        }
                      })()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No duration set</span>
                  )
                )}
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <Input
                    value={editedMatch.venue || ''}
                    onChange={(e) => setEditedMatch({ ...editedMatch, venue: e.target.value })}
                    className="flex-1"
                    placeholder="Venue"
                  />
                ) : (
                  match.venue || <span className="text-muted-foreground">No venue</span>
                )}
              </div>
              {isEditing && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={editedMatch.venue_address || ''}
                    onChange={(e) => setEditedMatch({ ...editedMatch, venue_address: e.target.value })}
                    className="flex-1"
                    placeholder="Venue address"
                  />
                </div>
              )}
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground w-20">Captain 1:</span>
                      <Input
                        value={editedMatch.opponent_captain_name || ''}
                        onChange={(e) => setEditedMatch({ ...editedMatch, opponent_captain_name: e.target.value })}
                        className="flex-1"
                        placeholder="Name"
                      />
                      <Input
                        type="email"
                        value={editedMatch.opponent_captain_email || ''}
                        onChange={(e) => setEditedMatch({ ...editedMatch, opponent_captain_email: e.target.value })}
                        className="flex-1"
                        placeholder="Email"
                      />
                      <Input
                        type="tel"
                        value={(editedMatch as any).opponent_captain_phone || ''}
                        onChange={(e) => setEditedMatch({ ...editedMatch, opponent_captain_phone: e.target.value } as any)}
                        className="flex-1"
                        placeholder="Phone"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground w-20">Captain 2:</span>
                      <Input
                        value={(editedMatch as any).opponent_captain_name2 || ''}
                        onChange={(e) => setEditedMatch({ ...editedMatch, opponent_captain_name2: e.target.value } as any)}
                        className="flex-1"
                        placeholder="Name"
                      />
                      <Input
                        type="email"
                        value={(editedMatch as any).opponent_captain_email2 || ''}
                        onChange={(e) => setEditedMatch({ ...editedMatch, opponent_captain_email2: e.target.value } as any)}
                        className="flex-1"
                        placeholder="Email"
                      />
                      <Input
                        type="tel"
                        value={(editedMatch as any).opponent_captain_phone2 || ''}
                        onChange={(e) => setEditedMatch({ ...editedMatch, opponent_captain_phone2: e.target.value } as any)}
                        className="flex-1"
                        placeholder="Phone"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {(match.opponent_captain_name || match.opponent_captain_email || (match as any).opponent_captain_phone) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground font-medium">Captain 1:</span>
                      {match.opponent_captain_name && <span>{match.opponent_captain_name}</span>}
                      {match.opponent_captain_email && <span className="text-muted-foreground">• {match.opponent_captain_email}</span>}
                      {(match as any).opponent_captain_phone && <span className="text-muted-foreground">• {(match as any).opponent_captain_phone}</span>}
                    </div>
                  )}
                  {((match as any).opponent_captain_name2 || (match as any).opponent_captain_email2 || (match as any).opponent_captain_phone2) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground font-medium">Captain 2:</span>
                      {(match as any).opponent_captain_name2 && <span>{(match as any).opponent_captain_name2}</span>}
                      {(match as any).opponent_captain_email2 && <span className="text-muted-foreground">• {(match as any).opponent_captain_email2}</span>}
                      {(match as any).opponent_captain_phone2 && <span className="text-muted-foreground">• {(match as any).opponent_captain_phone2}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
            {isEditing && (
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  onClick={handleSaveChanges}
                  disabled={saving || !editedMatch.opponent_name || !editedMatch.date || !editedMatch.time}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                {isCaptain && (
                  <Button
                    onClick={() => setShowDeleteAlert(true)}
                    variant="destructive"
                    disabled={saving}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Availability Summary */}
        {availabilitySummary.total > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Availability</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              {/* Availability types in a row */}
              <div className="flex items-start gap-4 flex-wrap">
                {/* Available */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setExpandedAvailability(prev => ({ ...prev, available: !prev.available }))}
                    className="flex items-center gap-1 text-sm hover:bg-accent/50 rounded-md p-1.5 -m-1.5 transition-colors w-full"
                  >
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="font-medium">{availabilitySummary.available}</span>
                    <span className="text-muted-foreground">Available</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform ml-auto flex-shrink-0", expandedAvailability.available && "rotate-180")} />
                  </button>
                  {expandedAvailability.available && availabilityDetails.available.length > 0 && (
                    <div className="pl-5 pt-1.5 space-y-1">
                      {availabilityDetails.available.map((player) => (
                        <div key={player.id} className="text-xs text-muted-foreground">
                          {player.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tentative */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setExpandedAvailability(prev => ({ ...prev, maybe: !prev.maybe }))}
                    className="flex items-center gap-1 text-sm hover:bg-accent/50 rounded-md p-1.5 -m-1.5 transition-colors w-full"
                  >
                    <HelpCircle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                    <span className="font-medium">{availabilitySummary.maybe}</span>
                    <span className="text-muted-foreground">Tentative</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform ml-auto flex-shrink-0", expandedAvailability.maybe && "rotate-180")} />
                  </button>
                  {expandedAvailability.maybe && availabilityDetails.maybe.length > 0 && (
                    <div className="pl-5 pt-1.5 space-y-1">
                      {availabilityDetails.maybe.map((player) => (
                        <div key={player.id} className="text-xs text-muted-foreground">
                          {player.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unavailable */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => setExpandedAvailability(prev => ({ ...prev, unavailable: !prev.unavailable }))}
                    className="flex items-center gap-1 text-sm hover:bg-accent/50 rounded-md p-1.5 -m-1.5 transition-colors w-full"
                  >
                    <X className="h-4 w-4 text-red-600 flex-shrink-0" />
                    <span className="font-medium">{availabilitySummary.unavailable}</span>
                    <span className="text-muted-foreground">Unavailable</span>
                    <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform ml-auto flex-shrink-0", expandedAvailability.unavailable && "rotate-180")} />
                  </button>
                  {expandedAvailability.unavailable && availabilityDetails.unavailable.length > 0 && (
                    <div className="pl-5 pt-1.5 space-y-1">
                      {availabilityDetails.unavailable.map((player) => (
                        <div key={player.id} className="text-xs text-muted-foreground">
                          {player.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t text-xs text-muted-foreground text-center">
                {availabilitySummary.total} total players
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lineup View */}
        {lineups.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Lineup</CardTitle>
                <Link href={`/teams/${teamId}/matches/${matchId}/lineup`}>
                  <Button variant="outline" size="sm">
                    <ClipboardList className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="space-y-3">
                {lineups.map((lineup) => (
                  <div key={lineup.id} className="border-b last:border-b-0 pb-2 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {formatCourtLabel(lineup.court_slot, undefined, lineMatchTypes)}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {lineup.player1?.full_name || 'TBD'}
                      {lineup.player2 && ` & ${lineup.player2.full_name}`}
                      {!lineup.player1 && !lineup.player2 && 'No players assigned'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          {lineups.length === 0 && (
            <Link href={`/teams/${teamId}/matches/${matchId}/lineup`}>
              <Button variant="outline" className="w-full">
                <ClipboardList className="h-4 w-4 mr-2" />
                Lineup
              </Button>
            </Link>
          )}
          <Link href={`/teams/${teamId}/availability`}>
            <Button variant="outline" className="w-full">
              <Users className="h-4 w-4 mr-2" />
              Availability
            </Button>
          </Link>
        </div>

        {/* Score Entry (Captains Only) */}
        {canEnterScores() && (
          <div className="space-y-2">
            <Link href={`/teams/${teamId}/matches/${matchId}/enter-scores`} className="block">
              <Button className="w-full" variant="default">
                <Trophy className="h-4 w-4 mr-2" />
                Enter Scores (Full Interface)
              </Button>
            </Link>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => setScoreDialogOpen(true)}
            >
              <Trophy className="h-4 w-4 mr-2" />
              {match.match_result === 'pending' ? 'Quick Score Entry' : 'Edit Scores'}
            </Button>
          </div>
        )}

        {/* Court-by-Court Scores */}
        {courtScores.length > 0 && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Court-by-Court Results</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <div className="space-y-3">
                {courtScores.map((court) => (
                  <div key={court.court_slot} className="border-b last:border-b-0 pb-3 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold">
                        {formatCourtLabel(court.court_slot, undefined, lineMatchTypes)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatScoreDisplay(court.scores)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {court.player1?.full_name} + {court.player2?.full_name}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warm-Up Wizard */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Warm-Up Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            <Select
              value={warmupStatus}
              onValueChange={(v) => setWarmupStatus(v as 'booked' | 'none_yet' | 'no_warmup')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="none_yet">None Yet</SelectItem>
                <SelectItem value="no_warmup">No Warm-Up</SelectItem>
              </SelectContent>
            </Select>

            {warmupStatus === 'booked' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Time</Label>
                  <Input
                    type="time"
                    value={warmupTime}
                    onChange={(e) => setWarmupTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Court #</Label>
                  <Input
                    placeholder="1"
                    value={warmupCourt}
                    onChange={(e) => setWarmupCourt(e.target.value)}
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {getWarmupMessage(warmupStatus, warmupTime, warmupCourt)}
            </p>

            <Button size="sm" onClick={updateWarmup}>
              Save Warm-Up
            </Button>
          </CardContent>
        </Card>

        {/* Venue Dialog for Warmup */}
        <VenueDialog
          open={showWarmupVenueDialog}
          onOpenChange={setShowWarmupVenueDialog}
          venue={null}
          teamId={teamId}
          onSaved={async () => {
            await loadWarmupVenues()
            setShowWarmupVenueDialog(false)
          }}
        />

        {/* Match Day Checklist */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm">Match Day Checklist</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="space-y-3">
              {checklist.map((item, index) => (
                <div
                  key={item.days}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleChecklistItem(index)}
                      className="focus:outline-none"
                    >
                      {item.completed ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div>
                      <p className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.task}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.days} days before
                      </p>
                    </div>
                  </div>
                  {item.task === 'Email opponent captain' && !item.completed && (
                    <a href={getEmailLink()}>
                      <Button variant="ghost" size="sm">
                        <Mail className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Score Entry Dialog */}
      {team && (
        <ScoreEntryDialog
          open={scoreDialogOpen}
          onOpenChange={setScoreDialogOpen}
          matchId={matchId}
          teamId={teamId}
          leagueFormat={(team.league_format as 'CUP' | 'USTA' | 'FLEX') || 'USTA'}
          onScoresSaved={() => {
            loadMatchData()
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Match?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the match vs <strong>{match?.opponent_name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
