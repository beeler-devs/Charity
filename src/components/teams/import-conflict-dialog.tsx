'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle, User, Mail, Phone, Award, UserCircle } from 'lucide-react'

export type ConflictType = 
  | 'already_on_roster' 
  | 'duplicate_email_in_csv' 
  | 'duplicate_email_in_db'
  | 'database_constraint'

export interface Conflict {
  player: {
    fullName: string
    email?: string
    phone?: string
    ntrpRating?: number
    role?: string
  }
  type: ConflictType
  existingRecord?: {
    id: string
    full_name: string
    email?: string | null
    phone?: string | null
    ntrp_rating?: number | null
    role?: string | null
    user_id?: string | null
  }
  errorMessage?: string
}

export type ConflictResolution = 'skip' | 'merge' | 'add_duplicate'

interface ImportConflictDialogProps {
  open: boolean
  conflict: Conflict | null
  onResolve: (resolution: ConflictResolution) => void
  onResolveAll: (resolution: ConflictResolution) => void
  onProcessImport: () => void
  hasMoreConflicts: boolean
  allConflictsResolved: boolean
}

export function ImportConflictDialog({
  open,
  conflict,
  onResolve,
  onResolveAll,
  onProcessImport,
  hasMoreConflicts,
  allConflictsResolved,
}: ImportConflictDialogProps) {
  if (!conflict) return null

  const getConflictTitle = () => {
    switch (conflict.type) {
      case 'already_on_roster':
        return 'Player Already on Roster'
      case 'duplicate_email_in_csv':
        return 'Duplicate Email in CSV'
      case 'duplicate_email_in_db':
        return 'Email Already Exists'
      case 'database_constraint':
        return 'Database Constraint Violation'
      default:
        return 'Import Conflict'
    }
  }

  const getConflictDescription = () => {
    switch (conflict.type) {
      case 'already_on_roster':
        return 'This player is already on the roster. Choose how to handle this conflict.'
      case 'duplicate_email_in_csv':
        return 'This email appears multiple times in your CSV file. Choose how to handle this conflict.'
      case 'duplicate_email_in_db':
        return 'A player with this email already exists in the database. Choose how to handle this conflict.'
      case 'database_constraint':
        return conflict.errorMessage || 'A database constraint prevents adding this player. Choose how to handle this conflict.'
      default:
        return 'There is a conflict with this player. Choose how to handle it.'
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            {getConflictTitle()}
          </DialogTitle>
          <DialogDescription>
            {getConflictDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* New Player Data from CSV */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-blue-500" />
                <h4 className="font-semibold text-sm">New Player Data (from CSV)</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{conflict.player.fullName}</span>
                </div>
                {conflict.player.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{conflict.player.email}</span>
                  </div>
                )}
                {conflict.player.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{conflict.player.phone}</span>
                  </div>
                )}
                {conflict.player.ntrpRating && (
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-muted-foreground" />
                    <span>NTRP: {conflict.player.ntrpRating}</span>
                  </div>
                )}
                {conflict.player.role && (
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    <span>Role: {conflict.player.role}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Existing Record (if applicable) */}
          {conflict.existingRecord && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-4 w-4 text-green-500" />
                  <h4 className="font-semibold text-sm">Existing Player Record</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{conflict.existingRecord.full_name}</span>
                  </div>
                  {conflict.existingRecord.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{conflict.existingRecord.email}</span>
                    </div>
                  )}
                  {conflict.existingRecord.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{conflict.existingRecord.phone}</span>
                    </div>
                  )}
                  {conflict.existingRecord.ntrp_rating && (
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span>NTRP: {conflict.existingRecord.ntrp_rating}</span>
                    </div>
                  )}
                  {conflict.existingRecord.role && (
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                      <span>Role: {conflict.existingRecord.role}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onResolve('skip')}
              className="flex-1 sm:flex-initial"
            >
              Skip
            </Button>
            {conflict.existingRecord && (
              <Button
                variant="default"
                onClick={() => onResolve('merge')}
                className="flex-1 sm:flex-initial"
              >
                Merge
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => onResolve('add_duplicate')}
              className="flex-1 sm:flex-initial"
            >
              Add Duplicate
            </Button>
          </div>
          {hasMoreConflicts && (
            <div className="flex gap-2 w-full sm:w-auto border-t pt-2 sm:border-t-0 sm:pt-0">
              <Button
                variant="outline"
                onClick={() => onResolveAll('skip')}
                size="sm"
                className="flex-1 sm:flex-initial"
              >
                Skip All
              </Button>
              {conflict.existingRecord && (
                <Button
                  variant="outline"
                  onClick={() => onResolveAll('merge')}
                  size="sm"
                  className="flex-1 sm:flex-initial"
                >
                  Merge All
                </Button>
              )}
            </div>
          )}
          {allConflictsResolved && (
            <div className="w-full border-t pt-2">
              <Button
                variant="default"
                onClick={onProcessImport}
                className="w-full"
              >
                Process Import
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}




