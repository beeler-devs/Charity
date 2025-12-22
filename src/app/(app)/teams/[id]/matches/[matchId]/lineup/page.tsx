'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  DragStartEvent,
  useDroppable,
  DragOverlay,
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
  isSelectionMode = false,
  onPlayerClick,
}: {
  player: PlayerWithAvailability
  onRemove: () => void
  isSelectionMode?: boolean
  onPlayerClick?: (player: PlayerWithAvailability) => void
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
        isDragging && 'opacity-50',
        isSelectionMode && 'cursor-pointer hover:bg-accent transition-colors'
      )}
      onClick={() => isSelectionMode && onPlayerClick?.(player)}
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
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
      >
        ×
      </Button>
    </div>
  )
}

function CourtSlotDropZone({
  courtNumber,
  slot,
  player,
  onRemove,
  isSelected,
  onClick,
  isSelectionMode,
}: {
  courtNumber: number
  slot: 'p1' | 'p2'
  player: PlayerWithAvailability | null
  onRemove: () => void
  isSelected: boolean
  onClick: () => void
  isSelectionMode: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `court-${courtNumber}-${slot}`
  })

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={cn(
        'min-h-[48px] rounded border-2 border-dashed cursor-pointer transition-colors',
        player ? 'border-transparent' : 'border-muted-foreground/20',
        isOver && 'bg-primary/10 border-primary',
        isSelected && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      {player ? (
        <SortablePlayer 
          player={player} 
          onRemove={onRemove}
          isSelectionMode={isSelectionMode}
        />
      ) : (
        <div className="flex items-center justify-center h-12 text-sm text-muted-foreground">
          <User className="h-4 w-4 mr-2" />
          Player {slot === 'p1' ? '1' : '2'}
        </div>
      )}
    </div>
  )
}

export default function LineupBuilderPage() {
  const params = useParams()
  const router = useRouter()
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
  const [selectedSlot, setSelectedSlot] = useState<{
    courtIndex: number
    slot: 'player1' | 'player2'
  } | null>(null)
  const [activePlayer, setActivePlayer] = useState<PlayerWithAvailability | null>(null)
  const playersContainerRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Split available players into available and unavailable
  const { available, unavailable } = useMemo(() => {
    const available = availablePlayers.filter(p =>
      p.availability === 'available' || p.availability === 'maybe' || p.availability === 'late'
    )
    const unavailable = availablePlayers.filter(p =>
      p.availability === 'unavailable' || !p.availability
    )
    return { available, unavailable }
  }, [availablePlayers])

  // Combine all players for drag context
  const allDraggablePlayers = useMemo(() => 
    [...available, ...unavailable].map(p => p.id),
    [available, unavailable]
  )

  useEffect(() => {
    loadLineupData()
  }, [teamId, matchId])

  // ESC key handler to cancel selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedSlot(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Click outside handler to cancel selection
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (playersContainerRef.current && !playersContainerRef.current.contains(e.target as Node)) {
        setSelectedSlot(null)
      }
    }
    if (selectedSlot) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectedSlot])

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

  function handleDragStart(event: DragStartEvent) {
    const playerId = event.active.id as string
    const player = availablePlayers.find(p => p.id === playerId)
    setActivePlayer(player || null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActivePlayer(null)
    
    if (!over) return

    const playerId = active.id as string
    const player = availablePlayers.find(p => p.id === playerId)
    if (!player) return

    // Check if dropped on a court slot
    const overId = over.id as string
    if (overId.startsWith('court-')) {
      const [, courtNum, slot] = overId.split('-')
      const courtIndex = parseInt(courtNum) - 1

      // Get the player currently in the slot (if any)
      const slotKey = slot === 'p1' ? 'player1' : 'player2'
      const displacedPlayer = courts[courtIndex][slotKey]

      setCourts(prev => {
        const newCourts = [...prev]
        if (slot === 'p1') {
          newCourts[courtIndex] = { ...newCourts[courtIndex], player1: player }
        } else {
          newCourts[courtIndex] = { ...newCourts[courtIndex], player2: player }
        }
        return newCourts
      })

      // Remove assigned player from available list
      setAvailablePlayers(prev => {
        let updated = prev.filter(p => p.id !== playerId)
        // Add back the displaced player if there was one
        if (displacedPlayer) {
          updated = [...updated, displacedPlayer]
        }
        return updated
      })
    }
  }

  function handleSlotClick(courtIndex: number, slot: 'player1' | 'player2') {
    // If clicking the same slot, deselect
    if (selectedSlot?.courtIndex === courtIndex && selectedSlot?.slot === slot) {
      setSelectedSlot(null)
    } else {
      setSelectedSlot({ courtIndex, slot })
    }
  }

  function handlePlayerClick(player: PlayerWithAvailability) {
    if (!selectedSlot) return

    // Get the player currently in the slot (if any)
    const displacedPlayer = courts[selectedSlot.courtIndex][selectedSlot.slot]

    // Assign player to the selected slot
    setCourts(prev => {
      const newCourts = [...prev]
      newCourts[selectedSlot.courtIndex] = {
        ...newCourts[selectedSlot.courtIndex],
        [selectedSlot.slot]: player
      }
      return newCourts
    })

    // Update available players list
    setAvailablePlayers(prev => {
      let updated = prev.filter(p => p.id !== player.id)
      // Add back the displaced player if there was one
      if (displacedPlayer) {
        updated = [...updated, displacedPlayer]
      }
      return updated
    })

    // Clear selection
    setSelectedSlot(null)
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
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col min-h-screen">
        <Header title="Lineup Builder" />

        <main className="flex-1 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-180px)]">
            {/* Left Column: Courts */}
            <div className="space-y-3 overflow-y-auto">
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
                    <CourtSlotDropZone
                      courtNumber={court.courtNumber}
                      slot="p1"
                      player={court.player1}
                      onRemove={() => removeFromCourt(index, 'player1')}
                      isSelected={selectedSlot?.courtIndex === index && selectedSlot?.slot === 'player1'}
                      onClick={() => handleSlotClick(index, 'player1')}
                      isSelectionMode={!!selectedSlot}
                    />

                    {/* Player 2 Slot */}
                    <CourtSlotDropZone
                      courtNumber={court.courtNumber}
                      slot="p2"
                      player={court.player2}
                      onRemove={() => removeFromCourt(index, 'player2')}
                      isSelected={selectedSlot?.courtIndex === index && selectedSlot?.slot === 'player2'}
                      onClick={() => handleSlotClick(index, 'player2')}
                      isSelectionMode={!!selectedSlot}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Right Column: Players */}
            <div ref={playersContainerRef} className="space-y-3 overflow-y-auto">
              <SortableContext
                items={allDraggablePlayers}
                strategy={verticalListSortingStrategy}
              >
                {/* Available Players */}
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">Available ({available.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="space-y-2">
                      {available.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No available players
                        </p>
                      ) : (
                        available.map(player => (
                          <SortablePlayer
                            key={player.id}
                            player={player}
                            onRemove={() => {}}
                            isSelectionMode={!!selectedSlot}
                            onPlayerClick={handlePlayerClick}
                          />
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Unavailable Players */}
                <Card>
                  <CardHeader className="p-3 pb-2">
                    <CardTitle className="text-sm">Unavailable ({unavailable.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="space-y-2">
                      {unavailable.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          No unavailable players
                        </p>
                      ) : (
                        unavailable.map(player => (
                          <SortablePlayer
                            key={player.id}
                            player={player}
                            onRemove={() => {}}
                            isSelectionMode={!!selectedSlot}
                            onPlayerClick={handlePlayerClick}
                          />
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </SortableContext>
            </div>
          </div>

          {/* Actions - Full width below */}
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => router.back()}>
              Cancel
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

      <DragOverlay>
        {activePlayer ? (
          <div
            className={cn(
              'flex items-center gap-2 p-2 bg-background rounded border-l-4 shadow-lg',
              activePlayer.availability === 'available' && 'border-l-green-500',
              activePlayer.availability === 'unavailable' && 'border-l-red-500',
              activePlayer.availability === 'maybe' && 'border-l-yellow-500',
              activePlayer.availability === 'late' && 'border-l-orange-500',
              !activePlayer.availability && 'border-l-gray-300'
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{activePlayer.full_name}</p>
              {activePlayer.ntrp_rating && (
                <p className="text-xs text-muted-foreground">{activePlayer.ntrp_rating}</p>
              )}
            </div>
          </div>
        ) : null}
      </DragOverlay>

    </DndContext>
  )
}
