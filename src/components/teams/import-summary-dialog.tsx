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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, SkipForward, GitMerge, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface ImportResult {
  player: {
    fullName: string
    email?: string
    phone?: string
    ntrpRating?: number
    role?: string
  }
  status: 'success' | 'failed' | 'skipped' | 'merged'
  action?: 'added' | 'invited' | 'merged' | 'skipped' | 'duplicate_added'
  error?: string
  existingRecord?: {
    id: string
    full_name: string
    email?: string | null
  }
  mergedFields?: string[]
}

interface ImportSummaryDialogProps {
  open: boolean
  results: ImportResult[]
  onClose: () => void
}

export function ImportSummaryDialog({ open, results, onClose }: ImportSummaryDialogProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    successful: false,
    failed: false,
    skipped: false,
    merged: false,
  })

  const successful = results.filter(r => r.status === 'success')
  const failed = results.filter(r => r.status === 'failed')
  const skipped = results.filter(r => r.status === 'skipped')
  const merged = results.filter(r => r.status === 'merged')

  const stats = {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    skipped: skipped.length,
    merged: merged.length,
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  const getStatusBadge = (result: ImportResult) => {
    switch (result.status) {
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'skipped':
        return <Badge variant="secondary">Skipped</Badge>
      case 'merged':
        return <Badge variant="default" className="bg-blue-500">Merged</Badge>
      default:
        return null
    }
  }

  const getActionLabel = (result: ImportResult) => {
    switch (result.action) {
      case 'added':
        return 'Added to roster'
      case 'invited':
        return 'Invitation sent'
      case 'merged':
        return 'Merged with existing'
      case 'skipped':
        return 'Skipped'
      case 'duplicate_added':
        return 'Added as duplicate'
      default:
        return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Summary</DialogTitle>
          <DialogDescription>
            Results of the player import operation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.successful}</div>
                <div className="text-xs text-muted-foreground">Success</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.merged}</div>
                <div className="text-xs text-muted-foreground">Merged</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </CardContent>
            </Card>
          </div>

          {/* Successful Imports */}
          {successful.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('successful')}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <CardTitle className="text-sm">Successful ({successful.length})</CardTitle>
                  </div>
                  {expandedSections.successful ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
              {expandedSections.successful && (
                <CardContent className="p-3 pt-0">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {successful.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded text-sm">
                        <div className="flex-1">
                          <div className="font-medium">{result.player.fullName}</div>
                          <div className="text-xs text-muted-foreground">{getActionLabel(result)}</div>
                        </div>
                        {getStatusBadge(result)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Merged Records */}
          {merged.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('merged')}
                >
                  <div className="flex items-center gap-2">
                    <GitMerge className="h-4 w-4 text-blue-500" />
                    <CardTitle className="text-sm">Merged ({merged.length})</CardTitle>
                  </div>
                  {expandedSections.merged ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
              {expandedSections.merged && (
                <CardContent className="p-3 pt-0">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {merged.map((result, index) => (
                      <div key={index} className="p-2 bg-blue-50 rounded text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium">{result.player.fullName}</div>
                          {getStatusBadge(result)}
                        </div>
                        {result.mergedFields && result.mergedFields.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Updated: {result.mergedFields.join(', ')}
                          </div>
                        )}
                        {result.existingRecord && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Merged with: {result.existingRecord.full_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Skipped Records */}
          {skipped.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('skipped')}
                >
                  <div className="flex items-center gap-2">
                    <SkipForward className="h-4 w-4 text-yellow-500" />
                    <CardTitle className="text-sm">Skipped ({skipped.length})</CardTitle>
                  </div>
                  {expandedSections.skipped ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
              {expandedSections.skipped && (
                <CardContent className="p-3 pt-0">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {skipped.map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-yellow-50 rounded text-sm">
                        <div className="flex-1">
                          <div className="font-medium">{result.player.fullName}</div>
                          {result.error && (
                            <div className="text-xs text-muted-foreground">{result.error}</div>
                          )}
                        </div>
                        {getStatusBadge(result)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Failed Records */}
          {failed.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSection('failed')}
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <CardTitle className="text-sm">Failed ({failed.length})</CardTitle>
                  </div>
                  {expandedSections.failed ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </CardHeader>
              {expandedSections.failed && (
                <CardContent className="p-3 pt-0">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {failed.map((result, index) => (
                      <div key={index} className="p-2 bg-red-50 rounded text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium">{result.player.fullName}</div>
                          {getStatusBadge(result)}
                        </div>
                        {result.error && (
                          <div className="text-xs text-red-600 mt-1">{result.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}




