'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Match, Team } from '@/types/database.types'
import { formatDate, formatTime, getWarmupMessage } from '@/lib/utils'
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
  Thermometer
} from 'lucide-react'

interface ChecklistItem {
  days: number
  task: string
  completed: boolean
}

export default function MatchDetailPage() {
  const params = useParams()
  const teamId = params.id as string
  const matchId = params.matchId as string
  const [match, setMatch] = useState<Match | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [warmupStatus, setWarmupStatus] = useState<'booked' | 'none_yet' | 'no_warmup'>('none_yet')
  const [warmupTime, setWarmupTime] = useState('')
  const [warmupCourt, setWarmupCourt] = useState('')
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { days: 14, task: 'Order balls', completed: false },
    { days: 10, task: 'Email opponent captain', completed: false },
    { days: 7, task: 'Book warm-up court', completed: false },
    { days: 4, task: 'Post lineup', completed: false },
  ])

  useEffect(() => {
    loadMatchData()
  }, [matchId])

  async function loadMatchData() {
    const supabase = createClient()

    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchData) {
      setMatch(matchData)
      setWarmupStatus(matchData.warm_up_status)
      setWarmupTime(matchData.warm_up_time || '')
      setWarmupCourt(matchData.warm_up_court || '')

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
    }

    setLoading(false)
  }

  async function updateWarmup() {
    const supabase = createClient()

    const { error } = await supabase
      .from('matches')
      .update({
        warm_up_status: warmupStatus,
        warm_up_time: warmupStatus === 'booked' ? warmupTime : null,
        warm_up_court: warmupStatus === 'booked' ? warmupCourt : null,
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
        {/* Match Info */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">vs {match.opponent_name}</h2>
              <Badge variant={match.is_home ? 'default' : 'outline'}>
                {match.is_home ? 'Home' : 'Away'}
              </Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {formatDate(match.date, 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {formatTime(match.time)}
              </div>
              {match.venue && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {match.venue}
                </div>
              )}
              {match.opponent_captain_name && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Captain: {match.opponent_captain_name}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/teams/${teamId}/matches/${matchId}/lineup`}>
            <Button variant="outline" className="w-full">
              <ClipboardList className="h-4 w-4 mr-2" />
              Lineup
            </Button>
          </Link>
          <Link href={`/teams/${teamId}/availability`}>
            <Button variant="outline" className="w-full">
              <Users className="h-4 w-4 mr-2" />
              Availability
            </Button>
          </Link>
        </div>

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
    </div>
  )
}
