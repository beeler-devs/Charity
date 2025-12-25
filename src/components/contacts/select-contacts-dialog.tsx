'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Users, CheckCircle2 } from 'lucide-react'

interface PotentialContact {
  roster_member_id: string
  team_id: string
  team_name: string | null
  profile_id: string | null
  name: string
  email: string | null
  phone: string | null
  relationship_type: string
  already_exists: boolean
  existing_contact_id: string | null
}

interface SelectContactsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  onImported: () => void
}

export function SelectContactsDialog({
  open,
  onOpenChange,
  userId,
  onImported,
}: SelectContactsDialogProps) {
  const [potentialContacts, setPotentialContacts] = useState<PotentialContact[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open && userId) {
      loadPotentialContacts()
      setSelectedIds(new Set())
    }
  }, [open, userId])

  async function loadPotentialContacts() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase.rpc('get_potential_contacts_from_network', {
        target_user_id: userId,
      })

      if (error) {
        console.error('Error loading potential contacts:', error)
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
        onOpenChange(false)
      } else {
        setPotentialContacts(data || [])

        if (!data || data.length === 0) {
          toast({
            title: 'No contacts available',
            description: 'No teammates found with the required information (name and email/user account) to import as contacts.',
            variant: 'default',
          })
          onOpenChange(false)
        } else {
          // Automatically select all non-existing contacts
          const initialSelected = new Set<string>()
          data.forEach(contact => {
            if (!contact.already_exists) {
              initialSelected.add(contact.roster_member_id)
            }
          })
          setSelectedIds(initialSelected)
        }
      }
    } catch (error: any) {
      console.error('Unexpected error loading potential contacts:', error)
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred while loading contacts.',
        variant: 'destructive',
      })
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  const groupedContacts = useMemo(() => {
    return potentialContacts.reduce((acc, contact) => {
      const teamName = contact.team_name || 'No Team'
      if (!acc[teamName]) {
        acc[teamName] = []
      }
      acc[teamName].push(contact)
      return acc
    }, {} as Record<string, PotentialContact[]>)
  }, [potentialContacts])

  const handleToggleSelect = (id: string, alreadyExists: boolean) => {
    if (alreadyExists) return
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    const newContacts = potentialContacts.filter(c => !c.already_exists)
    setSelectedIds(new Set(newContacts.map(c => c.roster_member_id)))
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  async function handleImport() {
    if (selectedIds.size === 0) {
      toast({
        title: 'No contacts selected',
        description: 'Please select at least one contact to import',
        variant: 'default',
      })
      return
    }

    try {
      setImporting(true)
      const supabase = createClient()
      const { data, error } = await supabase.rpc('import_selected_contacts', {
        target_user_id: userId,
        selected_roster_member_ids: Array.from(selectedIds),
      })

      if (error) {
        console.error('Error importing contacts:', error)
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        const result = data?.[0]
        const created = result?.created_count || 0
        const updated = result?.updated_count || 0
        const skipped = result?.skipped_count || 0
        toast({
          title: 'Import complete',
          description: `Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`,
        })
        onImported()
        onOpenChange(false)
      }
    } catch (error: any) {
      console.error('Error importing contacts:', error)
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred during import.',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  const newContacts = potentialContacts.filter(c => !c.already_exists)
  const existingContacts = potentialContacts.filter(c => c.already_exists)
  const allSelected = newContacts.length > 0 && newContacts.every(c => selectedIds.has(c.roster_member_id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Contacts from Network</DialogTitle>
          <DialogDescription>
            Select teammates from your teams to add to your contacts.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : potentialContacts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
            <Users className="h-12 w-12 mb-4" />
            <p className="text-lg font-semibold">No new teammates found</p>
            <p className="text-sm">
              Either all potential contacts already exist in your address book, or no teammates meet the criteria (active, has name and email/user account).
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mr-2">
              {/* Summary */}
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-4 text-sm">
                  <span>
                    <strong>{newContacts.length}</strong> new contacts available
                  </span>
                  {existingContacts.length > 0 && (
                    <span className="text-muted-foreground">
                      <strong>{existingContacts.length}</strong> already in contacts
                    </span>
                  )}
                </div>
                {newContacts.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={allSelected ? handleDeselectAll : handleSelectAll}
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Contacts grouped by team */}
              {Object.entries(groupedContacts).map(([teamName, contacts]) => (
                <div key={teamName} className="space-y-2">
                  <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {teamName}
                  </h4>
                  <div className="space-y-2 pl-6">
                    {contacts.map((contact) => {
                      const isSelected = selectedIds.has(contact.roster_member_id)
                      const isDisabled = contact.already_exists

                      return (
                        <div
                          key={contact.roster_member_id}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            isDisabled
                              ? 'bg-muted/50 opacity-60'
                              : isSelected
                              ? 'bg-primary/5 border-primary'
                              : 'bg-background hover:bg-muted/50'
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleSelect(contact.roster_member_id, isDisabled)}
                            disabled={isDisabled}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{contact.name}</span>
                                  {isDisabled && (
                                    <Badge variant="secondary" className="text-xs">
                                      Already exists
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                                  {contact.email && <span>{contact.email}</span>}
                                  {contact.phone && <span>{contact.phone}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedIds.size === 0 || importing}
          >
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

