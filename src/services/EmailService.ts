import { Match, Team, RosterMember, Lineup } from '@/types/database.types'
import { formatDate, formatTime, getWarmupMessage } from '@/lib/utils'

export interface EmailData {
  to: string
  subject: string
  body: string
}

interface WelcomeEmailData {
  match: Match
  team: Team
  opponentCaptains: string
}

interface LineupPlayingEmailData {
  match: Match
  team: Team
  player: RosterMember
  partner: RosterMember
  courtSlot: number
}

interface LineupBenchEmailData {
  match: Match
  team: Team
  player: RosterMember
  lineupSummary: string
  captainNames: string
}

export class EmailService {
  /**
   * Template A: Auto-Welcome Email
   * Triggered manually via Checklist
   */
  static compileWelcomeEmail(data: WelcomeEmailData): EmailData {
    const { match, team, opponentCaptains } = data

    const subject = `${team.league_format} Match – ${formatDate(match.date)} ${formatTime(match.time)} @ ${match.venue || 'TBD'}`

    const body = `Hi ${opponentCaptains || 'Team'} –

Below are the details for our ${team.league_format} Match on ${formatDate(match.date)} ${formatTime(match.time)} @${match.venue || 'TBD'}.
Please familiarize yourself, and your team, with the following policies and procedures.
We look forward to a great match!

${team.name}
${team.home_phones || ''}
____________________________________________________________________________

MATCH DAY
Time: Court time is 75 minutes (including warmup).
Payment: $${team.fee_per_team || 0} per team.
Location: ${team.venue_address || match.venue || 'TBD'}
Warmup Courts: ${team.warmup_policy || 'TBD'}

Thank you,
${team.name}`

    return {
      to: match.opponent_captain_email || '',
      subject,
      body,
    }
  }

  /**
   * Template B: Auto-Lineup Publish (Playing)
   * Triggered by "Publish Lineup" for players in the lineup
   */
  static compileLineupPlayingEmail(data: LineupPlayingEmailData): EmailData {
    const { match, team, player, partner, courtSlot } = data

    const warmupMessage = getWarmupMessage(
      match.warm_up_status,
      match.warm_up_time,
      match.warm_up_court
    )

    const homeAway = match.is_home ? 'Home' : 'Away'
    const playerFirstName = player.full_name.split(' ')[0]

    const subject = `You're IN the lineup – ${formatDate(match.date)} vs ${match.opponent_name} (${homeAway})`

    const body = `Hi ${playerFirstName},

You are in the lineup for our match vs ${match.opponent_name} on ${formatDate(match.date)}.

${warmupMessage}
Match starts: ${formatTime(match.time)} sharp

Location: ${match.venue || team.venue_address || 'TBD'}
Playing Line: Court ${courtSlot} (with ${partner.full_name})

Confirm you are available: ${process.env.NEXT_PUBLIC_APP_URL || 'https://tennislife.app'}

Good luck!
${team.name}`

    return {
      to: player.email || '',
      subject,
      body,
    }
  }

  /**
   * Template C: Auto-Lineup Publish (Bench)
   * Triggered by "Publish Lineup" for players not in the lineup
   */
  static compileLineupBenchEmail(data: LineupBenchEmailData): EmailData {
    const { match, team, player, lineupSummary, captainNames } = data

    const warmupMessage = getWarmupMessage(
      match.warm_up_status,
      match.warm_up_time,
      match.warm_up_court
    )

    const homeAway = match.is_home ? 'Home' : 'Away'
    const playerFirstName = player.full_name.split(' ')[0]

    const subject = `Lineup posted – you're off this week`

    const body = `Hi ${playerFirstName},

You get a well deserved break this week.
Come out and cheer on our team if you can!

${formatDate(match.date)} vs ${match.opponent_name} (${homeAway} @ ${match.venue || 'TBD'})
${warmupMessage}

Lineup:
${lineupSummary}

Thanks,
${captainNames || team.name}`

    return {
      to: player.email || '',
      subject,
      body,
    }
  }

  /**
   * Send email using the configured email service (Resend)
   */
  static async send(emailData: EmailData): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'TennisLife <noreply@tennislife.app>',
          to: [emailData.to],
          subject: emailData.subject,
          text: emailData.body,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Generate lineup summary for bench emails
   */
  static generateLineupSummary(
    lineups: Array<{
      court_slot: number
      player1: RosterMember | null
      player2: RosterMember | null
    }>
  ): string {
    return lineups
      .filter(l => l.player1 && l.player2)
      .sort((a, b) => a.court_slot - b.court_slot)
      .map(l => `Court ${l.court_slot}: ${l.player1!.full_name} & ${l.player2!.full_name}`)
      .join('\n')
  }
}

export default EmailService
