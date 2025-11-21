import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EmailService } from '@/services/EmailService'
import { RosterMember } from '@/types/database.types'

export async function POST(request: NextRequest) {
  try {
    const { matchId, teamId } = await request.json()

    if (!matchId || !teamId) {
      return NextResponse.json(
        { error: 'Missing matchId or teamId' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get match details
    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Get team details
    const { data: team } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single()

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Get published lineups with player details
    const { data: lineups } = await supabase
      .from('lineups')
      .select(`
        *,
        player1:roster_members!lineups_player1_id_fkey(*),
        player2:roster_members!lineups_player2_id_fkey(*)
      `)
      .eq('match_id', matchId)
      .eq('is_published', true)

    // Get all roster members
    const { data: roster } = await supabase
      .from('roster_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('is_active', true)

    if (!roster) {
      return NextResponse.json({ error: 'Roster not found' }, { status: 404 })
    }

    // Build set of player IDs in lineup
    const playersInLineup = new Set<string>()
    const lineupDetails: Array<{
      court_slot: number
      player1: RosterMember | null
      player2: RosterMember | null
    }> = []

    lineups?.forEach(lineup => {
      if (lineup.player1_id) playersInLineup.add(lineup.player1_id)
      if (lineup.player2_id) playersInLineup.add(lineup.player2_id)

      lineupDetails.push({
        court_slot: lineup.court_slot,
        player1: lineup.player1 as RosterMember | null,
        player2: lineup.player2 as RosterMember | null,
      })
    })

    const lineupSummary = EmailService.generateLineupSummary(lineupDetails)
    const emailResults: Array<{ email: string; success: boolean; error?: string }> = []

    // Send emails to players in lineup
    for (const lineup of lineups || []) {
      const player1 = lineup.player1 as RosterMember | null
      const player2 = lineup.player2 as RosterMember | null

      // Send email to player1 (always send if player1 has email, regardless of singles/doubles)
      if (player1?.email) {
        const emailData = EmailService.compileLineupPlayingEmail({
          match,
          team,
          player: player1,
          partner: player2, // Will be null for singles matches
          courtSlot: lineup.court_slot,
        })

        const result = await EmailService.send(emailData)
        emailResults.push({
          email: player1.email,
          success: result.success,
          error: result.error,
        })

        // Log email
        await supabase.from('email_logs').insert({
          match_id: matchId,
          team_id: teamId,
          type: 'lineup_playing',
          recipient_email: player1.email,
          recipient_name: player1.full_name,
          subject: emailData.subject,
          body: emailData.body,
          status: result.success ? 'sent' : 'failed',
          sent_at: result.success ? new Date().toISOString() : null,
          error_message: result.error,
        })
      }

      // Send email to player2 (only if doubles match and player2 has email)
      if (player2?.email) {
        const emailData = EmailService.compileLineupPlayingEmail({
          match,
          team,
          player: player2,
          partner: player1,
          courtSlot: lineup.court_slot,
        })

        const result = await EmailService.send(emailData)
        emailResults.push({
          email: player2.email,
          success: result.success,
          error: result.error,
        })

        // Log email
        await supabase.from('email_logs').insert({
          match_id: matchId,
          team_id: teamId,
          type: 'lineup_playing',
          recipient_email: player2.email,
          recipient_name: player2.full_name,
          subject: emailData.subject,
          body: emailData.body,
          status: result.success ? 'sent' : 'failed',
          sent_at: result.success ? new Date().toISOString() : null,
          error_message: result.error,
        })
      }
    }

    // Send emails to players on bench
    const benchPlayers = roster.filter(p => !playersInLineup.has(p.id))

    for (const player of benchPlayers) {
      if (!player.email) continue

      const emailData = EmailService.compileLineupBenchEmail({
        match,
        team,
        player,
        lineupSummary,
        captainNames: team.name,
      })

      const result = await EmailService.send(emailData)
      emailResults.push({
        email: player.email,
        success: result.success,
        error: result.error,
      })

      // Log email
      await supabase.from('email_logs').insert({
        match_id: matchId,
        team_id: teamId,
        type: 'lineup_bench',
        recipient_email: player.email,
        recipient_name: player.full_name,
        subject: emailData.subject,
        body: emailData.body,
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.error,
      })
    }

    const successCount = emailResults.filter(r => r.success).length
    const failCount = emailResults.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failCount,
      results: emailResults,
    })
  } catch (error) {
    console.error('Error publishing lineup emails:', error)
    return NextResponse.json(
      { error: 'Failed to send emails' },
      { status: 500 }
    )
  }
}
