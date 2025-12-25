'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { Contact } from '@/types/database.types'
import { AddEditContactDialog } from '@/components/contacts/add-edit-contact-dialog'
import { SelectContactsDialog } from '@/components/contacts/select-contacts-dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, Search, Users, RefreshCw, Trash2, Eye } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRelationship, setFilterRelationship] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [selectedTag, setSelectedTag] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [showSelectContactsDialog, setShowSelectContactsDialog] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    loadContacts()
  }, [])

  async function loadContacts() {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error loading contacts:', error)
        toast({
          title: 'Error',
          description: 'Failed to load contacts',
          variant: 'destructive',
        })
      } else {
        setContacts(data || [])
      }
    } catch (error: any) {
      console.error('Error loading contacts:', error)
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSyncFromNetwork() {
    try {
      setSyncing(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in',
          variant: 'destructive',
        })
        return
      }

      // First, check if user is on any teams
      const { data: userTeams, error: teamsError } = await supabase
        .from('roster_members')
        .select('team_id, teams(name)')
        .eq('user_id', user.id)
        .eq('is_active', true)

      if (teamsError) {
        console.error('Error checking user teams:', teamsError)
        toast({
          title: 'Error',
          description: 'Failed to check your team memberships',
          variant: 'destructive',
        })
        return
      }

      if (!userTeams || userTeams.length === 0) {
        toast({
          title: 'No teams found',
          description: 'You need to be on at least one team to sync contacts. Join a team first.',
          variant: 'default',
        })
        return
      }

      // Open the selection dialog
      setCurrentUserId(user.id)
      setShowSelectContactsDialog(true)
    } catch (error: any) {
      console.error('Sync exception:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync contacts',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  async function handleDelete(contact: Contact) {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: 'Error',
          description: 'You must be logged in',
          variant: 'destructive',
        })
        return
      }

      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', contact.id)
        .eq('user_id', user.id)

      if (error) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Contact deleted',
          description: `${contact.name} has been removed`,
        })
        loadContacts()
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete contact',
        variant: 'destructive',
      })
    } finally {
      setDeleteDialogOpen(false)
      setContactToDelete(null)
    }
  }

  // Get unique tags from all contacts
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    contacts.forEach(contact => {
      contact.tags?.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [contacts])

  // Get unique relationship types
  const relationshipTypes = useMemo(() => {
    const types = new Set<string>()
    contacts.forEach(contact => {
      if (contact.relationship_type) {
        types.add(contact.relationship_type)
      }
    })
    return Array.from(types).sort()
  }, [contacts])

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const matchesName = contact.name?.toLowerCase().includes(search)
        const matchesEmail = contact.email?.toLowerCase().includes(search)
        const matchesPhone = contact.phone?.toLowerCase().includes(search)
        if (!matchesName && !matchesEmail && !matchesPhone) {
          return false
        }
      }

      // Relationship filter
      if (filterRelationship !== 'all' && contact.relationship_type !== filterRelationship) {
        return false
      }

      // Source filter
      if (filterSource !== 'all' && contact.source !== filterSource) {
        return false
      }

      // Tag filter
      if (selectedTag !== 'all' && !contact.tags?.includes(selectedTag)) {
        return false
      }

      return true
    })
  }, [contacts, searchTerm, filterRelationship, filterSource, selectedTag])

  return (
    <div className="min-h-screen bg-background">
      <Header title="Contacts" />
      <div className="container mx-auto px-4 py-6 pb-24">
        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Button
            onClick={() => {
              setEditingContact(null)
              setDialogOpen(true)
            }}
            className="flex-1 sm:flex-none"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
          <Button
            onClick={handleSyncFromNetwork}
            disabled={syncing}
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync from Network
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={filterRelationship}
              onChange={(e) => setFilterRelationship(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="all">All Relationships</option>
              {relationshipTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="all">All Sources</option>
              <option value="manual">Manual</option>
              <option value="auto">Auto</option>
              <option value="merged">Merged</option>
            </select>

            {allTags.length > 0 && (
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Contacts List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No contacts found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {contacts.length === 0
                  ? 'Get started by adding a contact or syncing from your network.'
                  : 'Try adjusting your search or filters.'}
              </p>
              <Button
                onClick={() => {
                  setEditingContact(null)
                  setDialogOpen(true)
                }}
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredContacts.map((contact) => (
              <Card
                key={contact.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setEditingContact(contact)
                  setDialogOpen(true)
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{contact.name}</h3>
                        {contact.relationship_type && (
                          <Badge variant="secondary" className="text-xs">
                            {contact.relationship_type}
                          </Badge>
                        )}
                        {contact.source === 'auto' && (
                          <Badge variant="outline" className="text-xs">
                            Auto
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {contact.email && <p className="truncate">{contact.email}</p>}
                        {contact.phone && <p>{contact.phone}</p>}
                      </div>
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {contact.tags.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/contacts/${contact.id}`)
                        }}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          setContactToDelete(contact)
                          setDeleteDialogOpen(true)
                        }}
                        title="Delete contact"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <AddEditContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact}
        onSaved={() => {
          loadContacts()
          setDialogOpen(false)
          setEditingContact(null)
        }}
      />

      {/* Select Contacts Dialog */}
      {currentUserId && (
        <SelectContactsDialog
          open={showSelectContactsDialog}
          onOpenChange={setShowSelectContactsDialog}
          userId={currentUserId}
          onImported={() => {
            loadContacts()
            setShowSelectContactsDialog(false)
          }}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contactToDelete?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => contactToDelete && handleDelete(contactToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
