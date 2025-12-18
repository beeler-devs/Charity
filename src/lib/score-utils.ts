// Utility functions for match score calculations

export interface CourtResult {
  courtNumber: number
  won: boolean
  sets: SetScore[]
}

export interface SetScore {
  homeGames: number
  awayGames: number
  isTiebreak: boolean
}

export interface MatchScore {
  id?: string
  lineup_id: string
  set_number: number
  home_games: number
  away_games: number
  tiebreak_home: number | null
  tiebreak_away: number | null
  is_completed: boolean
}

/**
 * Calculate match result based on courts won
 * @param courtResults Array of court results
 * @returns 'win' if more courts won, 'loss' if more courts lost, 'tie' if equal
 */
export function calculateMatchResult(courtResults: CourtResult[]): 'win' | 'loss' | 'tie' {
  const courtsWon = courtResults.filter(c => c.won).length
  const courtsLost = courtResults.filter(c => !c.won).length
  
  if (courtsWon > courtsLost) return 'win'
  if (courtsLost > courtsWon) return 'loss'
  return 'tie'
}

/**
 * Generate score summary string (e.g., "3-0", "2-1")
 * @param courtResults Array of court results
 * @returns Score summary string
 */
export function generateScoreSummary(courtResults: CourtResult[]): string {
  const courtsWon = courtResults.filter(c => c.won).length
  const courtsLost = courtResults.filter(c => !c.won).length
  return `${courtsWon}-${courtsLost}`
}

/**
 * Determine the winner of a set based on games won
 * Standard tennis rules: first to 6 with 2-game margin, or 7-6 tiebreak
 * @param homeGames Number of games won by home team
 * @param awayGames Number of games won by away team
 * @returns 'home' if home won, 'away' if away won, null if set not complete
 */
export function calculateSetWinner(homeGames: number, awayGames: number): 'home' | 'away' | null {
  // Standard set: first to 6 games with 2-game margin
  if (homeGames >= 6 && homeGames - awayGames >= 2) return 'home'
  if (awayGames >= 6 && awayGames - homeGames >= 2) return 'away'
  
  // Tiebreak scenario: 7-6 or 6-7
  if (homeGames === 7 && awayGames === 6) return 'home'
  if (awayGames === 7 && homeGames === 6) return 'away'
  
  // Set not complete
  return null
}

/**
 * Determine if a court was won based on sets won
 * @param sets Array of set scores
 * @returns true if home team won more sets
 */
export function calculateCourtWinner(sets: SetScore[]): boolean {
  const setsWon = sets.filter(set => {
    const winner = calculateSetWinner(set.homeGames, set.awayGames)
    return winner === 'home'
  }).length
  
  const setsLost = sets.filter(set => {
    const winner = calculateSetWinner(set.homeGames, set.awayGames)
    return winner === 'away'
  }).length
  
  return setsWon > setsLost
}

/**
 * Format score display for a court (e.g., "6-4, 4-6, 10-8")
 * @param scores Array of match scores
 * @returns Formatted score string
 */
export function formatScoreDisplay(scores: MatchScore[]): string {
  if (!scores || scores.length === 0) return 'No score'
  
  return scores
    .sort((a, b) => a.set_number - b.set_number)
    .map(s => `${s.home_games}-${s.away_games}`)
    .join(', ')
}

/**
 * Format score display with superscript for tiebreaks (e.g., "6-7(4)")
 * @param scores Array of match scores
 * @returns Formatted score string with tiebreak notation
 */
export function formatScoreDisplayWithTiebreak(scores: MatchScore[]): string {
  if (!scores || scores.length === 0) return 'No score'
  
  return scores
    .sort((a, b) => a.set_number - b.set_number)
    .map(s => {
      const baseScore = `${s.home_games}-${s.away_games}`
      
      // Add tiebreak score if present
      if (s.tiebreak_home !== null && s.tiebreak_away !== null) {
        const tiebreakScore = s.home_games > s.away_games ? s.tiebreak_away : s.tiebreak_home
        return `${baseScore}(${tiebreakScore})`
      }
      
      return baseScore
    })
    .join(', ')
}

/**
 * Validate tennis score
 * @param homeGames Home games
 * @param awayGames Away games
 * @returns true if score is valid
 */
export function isValidTennisScore(homeGames: number, awayGames: number): boolean {
  // Both scores must be non-negative
  if (homeGames < 0 || awayGames < 0) return false
  
  // At least one must reach 6 or both must be less than 7
  if (homeGames < 6 && awayGames < 6) return false
  
  // Can't both be >= 7
  if (homeGames >= 7 && awayGames >= 7) return false
  
  // If one is 6, the other must be 0-7
  if (homeGames === 6 && awayGames > 7) return false
  if (awayGames === 6 && homeGames > 7) return false
  
  // If one is 7, the other must be 5 or 6 (tiebreak)
  if (homeGames === 7 && (awayGames < 5 || awayGames > 6)) return false
  if (awayGames === 7 && (homeGames < 5 || homeGames > 6)) return false
  
  // If one is > 7, it's invalid
  if (homeGames > 7 || awayGames > 7) return false
  
  return true
}

/**
 * Check if a set score requires a tiebreak
 * @param homeGames Home games
 * @param awayGames Away games
 * @returns true if score is 7-6 or 6-7 (tiebreak required)
 */
export function requiresTiebreak(homeGames: number, awayGames: number): boolean {
  return (homeGames === 7 && awayGames === 6) || (homeGames === 6 && awayGames === 7)
}

/**
 * Calculate total games for statistics
 * @param scores Array of match scores
 * @returns Object with games won and games lost
 */
export function calculateTotalGames(scores: MatchScore[]): { gamesWon: number; gamesLost: number } {
  const gamesWon = scores.reduce((sum, s) => sum + s.home_games, 0)
  const gamesLost = scores.reduce((sum, s) => sum + s.away_games, 0)
  
  return { gamesWon, gamesLost }
}

/**
 * Check if all sets are completed for a court
 * @param scores Array of match scores
 * @returns true if all sets have a winner
 */
export function areAllSetsComplete(scores: MatchScore[]): boolean {
  if (!scores || scores.length === 0) return false
  
  return scores.every(s => calculateSetWinner(s.home_games, s.away_games) !== null)
}

