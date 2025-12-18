'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { MatchScore, calculateSetWinner, requiresTiebreak } from '@/lib/score-utils'

export interface CourtScoreCardProps {
  courtNumber: number
  player1Name: string
  player2Name: string
  mode: 'CUP' | 'USTA' | 'FLEX'
  lineupId: string
  existingScores?: MatchScore[]
  onChange: (lineupId: string, scores: MatchScore[]) => void
}

export function CourtScoreCard({
  courtNumber,
  player1Name,
  player2Name,
  mode,
  lineupId,
  existingScores = [],
  onChange,
}: CourtScoreCardProps) {
  // Initialize sets with existing scores or empty defaults
  const [set1Home, setSet1Home] = useState<string>(existingScores.find(s => s.set_number === 1)?.home_games?.toString() || '')
  const [set1Away, setSet1Away] = useState<string>(existingScores.find(s => s.set_number === 1)?.away_games?.toString() || '')
  const [set2Home, setSet2Home] = useState<string>(existingScores.find(s => s.set_number === 2)?.home_games?.toString() || '')
  const [set2Away, setSet2Away] = useState<string>(existingScores.find(s => s.set_number === 2)?.away_games?.toString() || '')
  const [set3Home, setSet3Home] = useState<string>(existingScores.find(s => s.set_number === 3)?.home_games?.toString() || '')
  const [set3Away, setSet3Away] = useState<string>(existingScores.find(s => s.set_number === 3)?.away_games?.toString() || '')
  
  const [set1Tiebreak, setSet1Tiebreak] = useState(existingScores.find(s => s.set_number === 1)?.tiebreak_home !== null)
  const [set2Tiebreak, setSet2Tiebreak] = useState(existingScores.find(s => s.set_number === 2)?.tiebreak_home !== null)
  const [set3Tiebreak, setSet3Tiebreak] = useState(existingScores.find(s => s.set_number === 3)?.tiebreak_home !== null)

  // Notify parent of changes
  useEffect(() => {
    const scores: MatchScore[] = []
    
    // CUP mode: single "set" with total games
    if (mode === 'CUP') {
      if (set1Home && set1Away) {
        scores.push({
          lineup_id: lineupId,
          set_number: 1,
          home_games: parseInt(set1Home) || 0,
          away_games: parseInt(set1Away) || 0,
          tiebreak_home: null,
          tiebreak_away: null,
          is_completed: true,
        })
      }
    } else {
      // USTA mode: up to 3 sets
      if (set1Home && set1Away) {
        scores.push({
          lineup_id: lineupId,
          set_number: 1,
          home_games: parseInt(set1Home) || 0,
          away_games: parseInt(set1Away) || 0,
          tiebreak_home: set1Tiebreak ? 0 : null,
          tiebreak_away: set1Tiebreak ? 0 : null,
          is_completed: true,
        })
      }
      
      if (set2Home && set2Away) {
        scores.push({
          lineup_id: lineupId,
          set_number: 2,
          home_games: parseInt(set2Home) || 0,
          away_games: parseInt(set2Away) || 0,
          tiebreak_home: set2Tiebreak ? 0 : null,
          tiebreak_away: set2Tiebreak ? 0 : null,
          is_completed: true,
        })
      }
      
      if (set3Home && set3Away) {
        scores.push({
          lineup_id: lineupId,
          set_number: 3,
          home_games: parseInt(set3Home) || 0,
          away_games: parseInt(set3Away) || 0,
          tiebreak_home: set3Tiebreak ? 0 : null,
          tiebreak_away: set3Tiebreak ? 0 : null,
          is_completed: true,
        })
      }
    }
    
    onChange(lineupId, scores)
  }, [set1Home, set1Away, set2Home, set2Away, set3Home, set3Away, set1Tiebreak, set2Tiebreak, set3Tiebreak, mode, lineupId, onChange])

  // Calculate current winner
  const getSetWinner = (home: string, away: string) => {
    if (!home || !away) return null
    const homeNum = parseInt(home)
    const awayNum = parseInt(away)
    if (isNaN(homeNum) || isNaN(awayNum)) return null
    return calculateSetWinner(homeNum, awayNum)
  }

  const set1Winner = getSetWinner(set1Home, set1Away)
  const set2Winner = getSetWinner(set2Home, set2Away)
  const set3Winner = getSetWinner(set3Home, set3Away)

  // Calculate court winner
  const setsWon = [set1Winner, set2Winner, set3Winner].filter(w => w === 'home').length
  const setsLost = [set1Winner, set2Winner, set3Winner].filter(w => w === 'away').length
  const courtWon = setsWon > setsLost

  if (mode === 'CUP') {
    return (
      <Card className={courtWon && set1Home && set1Away ? 'border-green-500' : ''}>
        <CardHeader>
          <CardTitle className="text-base">Court {courtNumber}</CardTitle>
          <div className="text-sm text-muted-foreground">
            {player1Name} + {player2Name}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <Label htmlFor={`court-${courtNumber}-home`}>Games Won (Home)</Label>
              <Input
                id={`court-${courtNumber}-home`}
                type="number"
                min="0"
                max="20"
                value={set1Home}
                onChange={(e) => setSet1Home(e.target.value)}
                className="w-20"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`court-${courtNumber}-away`}>Games Won (Away)</Label>
              <Input
                id={`court-${courtNumber}-away`}
                type="number"
                min="0"
                max="20"
                value={set1Away}
                onChange={(e) => setSet1Away(e.target.value)}
                className="w-20"
              />
            </div>
          </div>
          {set1Home && set1Away && (
            <div className="mt-3 text-sm">
              Result: <span className={courtWon ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                {courtWon ? 'Won' : 'Lost'} {set1Home}-{set1Away}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // USTA Mode
  return (
    <Card className={courtWon && (set1Home || set2Home || set3Home) ? 'border-green-500' : ''}>
      <CardHeader>
        <CardTitle className="text-base">Court {courtNumber}</CardTitle>
        <div className="text-sm text-muted-foreground">
          {player1Name} + {player2Name}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Set 1 */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Set 1</Label>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min="0"
              max="7"
              value={set1Home}
              onChange={(e) => setSet1Home(e.target.value)}
              className="w-16"
              placeholder="0"
            />
            <span>-</span>
            <Input
              type="number"
              min="0"
              max="7"
              value={set1Away}
              onChange={(e) => setSet1Away(e.target.value)}
              className="w-16"
              placeholder="0"
            />
            <div className="flex items-center gap-2 ml-4">
              <Checkbox 
                id={`set1-tiebreak-${courtNumber}`}
                checked={set1Tiebreak}
                onCheckedChange={(checked) => setSet1Tiebreak(checked as boolean)}
              />
              <Label htmlFor={`set1-tiebreak-${courtNumber}`} className="text-sm cursor-pointer">
                Tiebreak
              </Label>
            </div>
            {set1Winner && (
              <span className={`text-sm ml-auto ${set1Winner === 'home' ? 'text-green-600' : 'text-red-600'}`}>
                {set1Winner === 'home' ? '✓ Won' : '✗ Lost'}
              </span>
            )}
          </div>
        </div>

        {/* Set 2 */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Set 2</Label>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min="0"
              max="7"
              value={set2Home}
              onChange={(e) => setSet2Home(e.target.value)}
              className="w-16"
              placeholder="0"
            />
            <span>-</span>
            <Input
              type="number"
              min="0"
              max="7"
              value={set2Away}
              onChange={(e) => setSet2Away(e.target.value)}
              className="w-16"
              placeholder="0"
            />
            <div className="flex items-center gap-2 ml-4">
              <Checkbox 
                id={`set2-tiebreak-${courtNumber}`}
                checked={set2Tiebreak}
                onCheckedChange={(checked) => setSet2Tiebreak(checked as boolean)}
              />
              <Label htmlFor={`set2-tiebreak-${courtNumber}`} className="text-sm cursor-pointer">
                Tiebreak
              </Label>
            </div>
            {set2Winner && (
              <span className={`text-sm ml-auto ${set2Winner === 'home' ? 'text-green-600' : 'text-red-600'}`}>
                {set2Winner === 'home' ? '✓ Won' : '✗ Lost'}
              </span>
            )}
          </div>
        </div>

        {/* Set 3 */}
        <div>
          <Label className="text-sm font-semibold mb-2 block">Set 3</Label>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min="0"
              max="7"
              value={set3Home}
              onChange={(e) => setSet3Home(e.target.value)}
              className="w-16"
              placeholder="0"
            />
            <span>-</span>
            <Input
              type="number"
              min="0"
              max="7"
              value={set3Away}
              onChange={(e) => setSet3Away(e.target.value)}
              className="w-16"
              placeholder="0"
            />
            <div className="flex items-center gap-2 ml-4">
              <Checkbox 
                id={`set3-tiebreak-${courtNumber}`}
                checked={set3Tiebreak}
                onCheckedChange={(checked) => setSet3Tiebreak(checked as boolean)}
              />
              <Label htmlFor={`set3-tiebreak-${courtNumber}`} className="text-sm cursor-pointer">
                10-pt TB
              </Label>
            </div>
            {set3Winner && (
              <span className={`text-sm ml-auto ${set3Winner === 'home' ? 'text-green-600' : 'text-red-600'}`}>
                {set3Winner === 'home' ? '✓ Won' : '✗ Lost'}
              </span>
            )}
          </div>
        </div>

        {/* Court Result */}
        {(set1Home || set2Home || set3Home) && (
          <div className="pt-3 border-t">
            <div className="text-sm font-semibold">
              Sets: {setsWon}-{setsLost}
              {setsWon !== setsLost && (
                <span className={`ml-2 ${courtWon ? 'text-green-600' : 'text-red-600'}`}>
                  ({courtWon ? 'Court Won' : 'Court Lost'})
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

