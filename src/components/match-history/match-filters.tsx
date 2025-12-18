'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

interface Team {
  id: string
  name: string
}

export interface MatchFilters {
  teamId: string | null
  result: 'win' | 'loss' | 'tie' | 'no_score' | null
  dateFrom: string | null
  dateTo: string | null
  sortBy: 'date_desc' | 'date_asc' | 'opponent_asc'
}

interface MatchFiltersProps {
  teams: Team[]
  filters: MatchFilters
  onFiltersChange: (filters: MatchFilters) => void
}

export function MatchFiltersComponent({
  teams,
  filters,
  onFiltersChange,
}: MatchFiltersProps) {
  const handleTeamChange = (value: string) => {
    onFiltersChange({
      ...filters,
      teamId: value === 'all' ? null : value,
    })
  }

  const handleResultChange = (value: string) => {
    onFiltersChange({
      ...filters,
      result: value === 'all' ? null : (value as MatchFilters['result']),
    })
  }

  const handleSortChange = (value: string) => {
    onFiltersChange({
      ...filters,
      sortBy: value as MatchFilters['sortBy'],
    })
  }

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      dateFrom: e.target.value || null,
    })
  }

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      dateTo: e.target.value || null,
    })
  }

  return (
    <Card className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Team Filter */}
        <div className="space-y-2">
          <Label htmlFor="team-filter" className="text-sm font-medium">
            Team
          </Label>
          <Select
            value={filters.teamId || 'all'}
            onValueChange={handleTeamChange}
          >
            <SelectTrigger id="team-filter">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams.map((team) => (
                <SelectItem key={team.id} value={team.id}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Result Filter */}
        <div className="space-y-2">
          <Label htmlFor="result-filter" className="text-sm font-medium">
            Result
          </Label>
          <Select
            value={filters.result || 'all'}
            onValueChange={handleResultChange}
          >
            <SelectTrigger id="result-filter">
              <SelectValue placeholder="All Results" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Results</SelectItem>
              <SelectItem value="win">Won</SelectItem>
              <SelectItem value="loss">Lost</SelectItem>
              <SelectItem value="tie">Tie</SelectItem>
              <SelectItem value="no_score">No Score</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date From */}
        <div className="space-y-2">
          <Label htmlFor="date-from" className="text-sm font-medium">
            From Date
          </Label>
          <Input
            id="date-from"
            type="date"
            value={filters.dateFrom || ''}
            onChange={handleDateFromChange}
          />
        </div>

        {/* Date To */}
        <div className="space-y-2">
          <Label htmlFor="date-to" className="text-sm font-medium">
            To Date
          </Label>
          <Input
            id="date-to"
            type="date"
            value={filters.dateTo || ''}
            onChange={handleDateToChange}
          />
        </div>

        {/* Sort By */}
        <div className="space-y-2 md:col-span-2 lg:col-span-4">
          <Label htmlFor="sort-by" className="text-sm font-medium">
            Sort By
          </Label>
          <Select value={filters.sortBy} onValueChange={handleSortChange}>
            <SelectTrigger id="sort-by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest First</SelectItem>
              <SelectItem value="date_asc">Oldest First</SelectItem>
              <SelectItem value="opponent_asc">Opponent (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  )
}

