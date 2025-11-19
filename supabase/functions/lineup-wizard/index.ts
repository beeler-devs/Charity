// Supabase Edge Function for Lineup Wizard
// Deploy with: supabase functions deploy lineup-wizard

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Player {
  id: string
  full_name: string
  ntrp_rating: number | null
  fair_play_score: number
  availability: string
}

interface PairSuggestion {
  player1: Player
  player2: Player
  score: number
  winPct: number
  gamesPct: number
  fairPlay: number
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { teamId, matchId, availablePlayers } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get pair statistics for this team
    const { data: pairStats } = await supabase
      .from('pair_statistics')
      .select('*')
      .eq('team_id', teamId)

    // Build stats lookup
    const statsMap = new Map<string, {
      wins: number
      matches: number
      gamesWon: number
      gamesPlayed: number
    }>()

    pairStats?.forEach((stat) => {
      const key = [stat.player1_id, stat.player2_id].sort().join('-')
      statsMap.set(key, {
        wins: stat.wins,
        matches: stat.matches_together,
        gamesWon: stat.total_games_won,
        gamesPlayed: stat.total_games_played,
      })
    })

    // Filter only available players
    const eligiblePlayers = availablePlayers.filter(
      (p: Player) => p.availability === 'available' || p.availability === 'maybe' || p.availability === 'late'
    )

    // Generate all possible pairs
    const pairs: PairSuggestion[] = []

    for (let i = 0; i < eligiblePlayers.length; i++) {
      for (let j = i + 1; j < eligiblePlayers.length; j++) {
        const player1 = eligiblePlayers[i]
        const player2 = eligiblePlayers[j]
        const key = [player1.id, player2.id].sort().join('-')
        const stats = statsMap.get(key)

        // Calculate percentages
        let winPct = 50 // default
        let gamesPct = 50 // default

        if (stats && stats.matches > 0) {
          winPct = (stats.wins / stats.matches) * 100
        }

        if (stats && stats.gamesPlayed > 0) {
          gamesPct = (stats.gamesWon / stats.gamesPlayed) * 100
        }

        const fairPlay = (player1.fair_play_score + player2.fair_play_score) / 2

        // Calculate weighted score: (Win % * 0.4) + (Games % * 0.3) + (FairPlay * 0.3)
        const score = (winPct * 0.4) + (gamesPct * 0.3) + (fairPlay * 0.3)

        pairs.push({
          player1,
          player2,
          score,
          winPct,
          gamesPct,
          fairPlay,
        })
      }
    }

    // Sort by score descending
    pairs.sort((a, b) => b.score - a.score)

    // Select top 3 non-overlapping pairs
    const selectedPairs: PairSuggestion[] = []
    const usedPlayerIds = new Set<string>()

    for (const pair of pairs) {
      if (
        !usedPlayerIds.has(pair.player1.id) &&
        !usedPlayerIds.has(pair.player2.id)
      ) {
        selectedPairs.push(pair)
        usedPlayerIds.add(pair.player1.id)
        usedPlayerIds.add(pair.player2.id)

        if (selectedPairs.length === 3) break
      }
    }

    return new Response(JSON.stringify({ suggestions: selectedPairs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
