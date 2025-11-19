'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { RosterMember, Match, Lineup, Availability } from '@/types/database.types'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Wand2,
  Send,
  AlertTriangle,
  GripVertical,
  User,
  Loader2
} from 'lucide-react'
import { LineupWizardDialog } from '@/components/teams/lineup-wizard-dialog'

interface CourtSlot {
  courtNumber: number
  player1: RosterMember | null
  player2: RosterMember | null
  lineupId?: string
}

interface PlayerWithAvailability extends RosterMember {
  availability?: 'available' | 'unavailable' | 'maybe' | 'late'
}

function SortablePlayer({
  player,
  onRemove,
}: {
  player: PlayerWithAvailability
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const getAvailabilityColor = (status?: string) => {
    switch (status) {
      case 'available':
        return 'border-l-green-500'
      case 'unavailable':
        return 'border-l-red-500'
      case 'maybe':
        return 'border-l-yellow-500'
      case 'late':
        return 'border-l-orange-500'
      default:
        return 'border-l-gray-300'
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 bg-background rounded border-l-4',
        getAvailabilityColor(player.availability),
        isDragging && 'opacity-50'
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{player.full_name}</p>
        {player.ntrp_rating && (
          <p className="text-xs text-muted-foreground">{player.ntrp_rating}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={onRemove}
      >
        ×
      </Button>
    </div>
  )
}

export default function LineupBuilderPage() {
  const params = useParams()
  const teamId = params.id as string
  const matchId = params.matchId as string
  const [match, setMatch] = useState<Match | null>(null)
  const [ratingLimit, setRatingLimit] = useState<number | null>(null)
  const [courts, setCourts] = useState<CourtSlot[]>([
    { courtNumber: 1, player1: null, player2: null },
    { courtNumber: 2, player1: null, player2: null },
    { courtNumber: 3, player1: null, player2: null },
  ])
  const [availablePlayers, setAvailablePlayers] = useState<PlayerWithAvailability[]>([])
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    loadLineupData()
  }, [teamId, matchId])

  async function loadLineupData() {
    const supabase = createClient()

    // Load match
    const { data: matchData } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (matchData) {
      setMatch(matchData)
    }

    // Load team for rating limit
    const { data: teamData } = await supabase
      .from('teams')
      .select('rating_limit')
      .eq('id', teamId)
      .single()

    if (teamData) {
      setRatingLimit(teamData.rating_limit)
    }

    // Load roster
    const { data: roster } = await supabase
      .from('roster_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true)

    // Load availability
    const { data: availabilityData } = await supabase
      .from('availability')
      .select('*')
      .eq('match_id', matchId)

    // Load existing lineup
    const { data: lineupData } = await supabase
      .from('lineups')
      .select('*')
      .eq('match_id', matchId)
      .order('court_slot')

    // Map availability to players
    const playersWithAvail: PlayerWithAvailability[] = (roster || []).map(player => ({
      ...player,
      availability: availabilityData?.find(a => a.roster_member_id === player.id)?.status,
    }))

    // Build courts from existing lineup
    const assignedPlayerIds = new Set<string>()
    const newCourts: CourtSlot[] = [1, 2, 3].map(num => {
      const lineup = lineupData?.find(l => l.court_slot === num)
      const player1 = lineup?.player1_id
        ? playersWithAvail.find(p => p.id === lineup.player1_id) || null
        : null
      const player2 = lineup?.player2_id
        ? playersWithAvail.find(p => p.id === lineup.player2_id) || null
        : null

      if (player1) assignedPlayerIds.add(player1.id)
      if (player2) assignedPlayerIds.add(player2.id)

      return {
        courtNumber: num,
        player1,
        player2,
        lineupId: lineup?.id,
      }
    })

    setCourts(newCourts)
    setAvailablePlayers(playersWithAvail.filter(p => !assignedPlayerIds.has(p.id)))
    setLoading(false)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const playerId = active.id as string
    const player = availablePlayers.find(p => p.id === playerId)
    if (!player) return

    // Check if dropped on a court slot
    const overId = over.id as string
    if (overId.startsWith('court-')) {
      const [, courtNum, slot] = overId.split('-')
      const courtIndex = parseInt(courtNum) - 1

      setCourts(prev => {
        const newCourts = [...prev]
        if (slot === 'p1') {
          newCourts[courtIndex] = { ...newCourts[courtIndex], player1: player }
        } else {
          newCourts[courtIndex] = { ...newCourts[courtIndex], player2: player }
        }
        return newCourts
      })

      setAvailablePlayers(prev => prev.filter(p => p.id !== playerId))
    }
  }

  function removeFromCourt(courtIndex: number, slot: 'player1' | 'player2') {
    const player = courts[courtIndex][slot]
    if (!player) return

    setCourts(prev => {
      const newCourts = [...prev]
      newCourts[courtIndex] = { ...newCourts[courtIndex], [slot]: null }
      return newCourts
    })

    setAvailablePlayers(prev => [...prev, player])
  }

  function getCombinedRating(court: CourtSlot): number {
    return (court.player1?.ntrp_rating || 0) + (court.player2?.ntrp_rating || 0)
  }

  function isOverLimit(court: CourtSlot): boolean {
    if (!ratingLimit) return false
    return getCombinedRating(court) > ratingLimit
  }

  async function saveLineup() {
    const supabase = createClient()

    for (const court of courts) {
      if (court.lineupId) {
        await supabase
          .from('lineups')
          .update({
            player1_id: court.player1?.id || null,
            player2_id: court.player2?.id || null,
          })
          .eq('id', court.lineupId)
      } else if (court.player1 || court.player2) {
        await supabase.from('lineups').insert({
          match_id: matchId,
          court_slot: court.courtNumber,
          player1_id: court.player1?.id || null,
          player2_id: court.player2?.id || null,
        })
      }
    }

    toast({
      title: 'Lineup saved',
      description: 'Your lineup has been saved',
    })
  }

  async function publishLineup() {
    setPublishing(true)
    const supabase = createClient()

    // Save and mark as published
    for (const court of courts) {
      if (court.player1 || court.player2) {
        if (court.lineupId) {
          await supabase
            .from('lineups')
            .update({
              player1_id: court.player1?.id || null,
              player2_id: court.player2?.id || null,
              is_published: true,
            })
            .eq('id', court.lineupId)
        } else {
          await supabase.from('lineups').insert({
            match_id: matchId,
            court_slot: court.courtNumber,
            player1_id: court.player1?.id || null,
            player2_id: court.player2?.id || null,
            is_published: true,
          })
        }
      }
    }

    // Trigger email sending via API
    await fetch('/api/email/publish-lineup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId, teamId }),
    })

    toast({
      title: 'Lineup published',
      description: 'Players have been notified via email',
    })

    setPublishing(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col min-h-screen">
        <Header title="Lineup Builder" />

        <main className="flex-1 p-4 space-y-4">
          {/* Match Info */}
          {match && (
            <Card>
              <CardContent className="p-3">
                <p className="font-medium">vs {match.opponent_name}</p>
                <p className="text-sm text-muted-foreground">
                  {ratingLimit && `Rating Limit: ${ratingLimit}`}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Courts */}
          <div className="space-y-3">
            {courts.map((court, index) => (
              <Card key={court.courtNumber} className={cn(isOverLimit(court) && 'border-red-500')}>
                <CardHeader className="p-3 pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Court {court.courtNumber}</CardTitle>
                    {court.player1 && court.player2 && (
                      <div className="flex items-center gap-2">
                        <Badge variant={isOverLimit(court) ? 'destructive' : 'secondary'}>
                          {getCombinedRating(court).toFixed(1)}
                        </Badge>
                        {isOverLimit(court) && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-3 pt-0 space-y-2">
                  {/* Player 1 Slot */}
                  <div
                    id={`court-${court.courtNumber}-p1`}
                    className={cn(
                      'min-h-[48px] rounded border-2 border-dashed',
                      court.player1 ? 'border-transparent' : 'border-muted-foreground/20'
                    )}
                  >
                    {court.player1 ? (
                      <SortablePlayer
                        player={court.player1}
                        onRemove={() => removeFromCourt(index, 'player1')}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-12 text-sm text-muted-foreground">
                        <User className="h-4 w-4 mr-2" />
                        Player 1
                      </div>
                    )}
                  </div>

                  {/* Player 2 Slot */}
                  <div
                    id={`court-${court.courtNumber}-p2`}
                    className={cn(
                      'min-h-[48px] rounded border-2 border-dashed',
                      court.player2 ? 'border-transparent' : 'border-muted-foreground/20'
                    )}
                  >
                    {court.player2 ? (
                      <SortablePlayer
                        player={court.player2}
                        onRemove={() => removeFromCourt(index, 'player2')}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-12 text-sm text-muted-foreground">
                        <User className="h-4 w-4 mr-2" />
                        Player 2
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Available Players */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm">Available Players ({availablePlayers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <SortableContext
                items={availablePlayers.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availablePlayers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      All players assigned
                    </p>
                  ) : (
                    availablePlayers.map(player => (
                      <SortablePlayer
                        key={player.id}
                        player={player}
                        onRemove={() => {}}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setShowWizard(true)}>
              <Wand2 className="h-4 w-4 mr-2" />
              Wizard
            </Button>
            <Button variant="outline" className="flex-1" onClick={saveLineup}>
              Save
            </Button>
            <Button className="flex-1" onClick={publishLineup} disabled={publishing}>
              {publishing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Publish
            </Button>
          </div>
        </main>
      </div>

      <LineupWizardDialog
        open={showWizard}
        onOpenChange={setShowWizard}
        teamId={teamId}
        availablePlayers={availablePlayers}
        onApply={(suggestions) => {
          // Apply wizard suggestions to courts
          const newCourts = [...courts]
          suggestions.forEach((pair, index) => {
            if (index < 3) {
              newCourts[index] = {
                ...newCourts[index],
                player1: pair.player1,
                player2: pair.player2,
              }
            }
          })
          setCourts(newCourts)

          // Remove assigned players from available
          const assignedIds = new Set(suggestions.flatMap(p => [p.player1.id, p.player2.id]))
          setAvailablePlayers(prev => prev.filter(p => !assignedIds.has(p.id)))
          setShowWizard(false)
        }}
      />
    </DndContext>
  )
}
