'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Filter } from 'lucide-react'

interface TeamInfo {
  id: string
  name: string
}

interface CalendarFiltersProps {
  teams: TeamInfo[]
  selectedTeamIds: string[]
  onTeamSelectionChange: (teamIds: string[]) => void
  showMatches: boolean
  onShowMatchesChange: (show: boolean) => void
  showEvents: boolean
  onShowEventsChange: (show: boolean) => void
}

export function CalendarFilters({
  teams,
  selectedTeamIds,
  onTeamSelectionChange,
  showMatches,
  onShowMatchesChange,
  showEvents,
  onShowEventsChange,
}: CalendarFiltersProps) {
  const allTeamsSelected = selectedTeamIds.length === teams.length
  
  const toggleAllTeams = () => {
    if (allTeamsSelected) {
      onTeamSelectionChange([])
    } else {
      onTeamSelectionChange(teams.map(t => t.id))
    }
  }
  
  const toggleTeam = (teamId: string) => {
    if (selectedTeamIds.includes(teamId)) {
      onTeamSelectionChange(selectedTeamIds.filter(id => id !== teamId))
    } else {
      onTeamSelectionChange([...selectedTeamIds, teamId])
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh]">
        <SheetHeader>
          <SheetTitle>Calendar Filters</SheetTitle>
          <SheetDescription>
            Customize what appears on your calendar
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 120px)' }}>
          {/* Item types */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Show Item Types</h3>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="show-matches" className="flex-1">
                Matches
              </Label>
              <Switch
                id="show-matches"
                checked={showMatches}
                onCheckedChange={onShowMatchesChange}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="show-events" className="flex-1">
                Events
              </Label>
              <Switch
                id="show-events"
                checked={showEvents}
                onCheckedChange={onShowEventsChange}
              />
            </div>
          </div>

          {/* Teams */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Teams</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleAllTeams}
              >
                {allTeamsSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="space-y-3">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-${team.id}`}
                    checked={selectedTeamIds.includes(team.id)}
                    onCheckedChange={() => toggleTeam(team.id)}
                  />
                  <label
                    htmlFor={`team-${team.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1"
                  >
                    {team.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}


