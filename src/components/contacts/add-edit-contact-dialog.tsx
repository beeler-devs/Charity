'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Contact, ContactInsert } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Loader2, X } from 'lucide-react'

interface AddEditContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact | null
  onSaved: () => void
}

export function AddEditContactDialog({
  open,
  onOpenChange,
  contact,
  onSaved,
}: AddEditContactDialogProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [relationshipType, setRelationshipType] = useState<string>('none')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      if (contact) {
        setName(contact.name || '')
        setEmail(contact.email || '')
        setPhone(contact.phone || '')
        setAddress(contact.address || '')
        setNotes(contact.notes || '')
        setRelationshipType(contact.relationship_type || 'none')
        setTags(contact.tags || [])
      } else {
        setName('')
        setEmail('')
        setPhone('')
        setAddress('')
        setNotes('')
        setRelationshipType('none')
        setTags([])
      }
      setTagInput('')
    }
  }, [open, contact])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Name is required',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
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

      if (contact) {
        // Update existing contact
        const { error } = await supabase
          .from('contacts')
          .update({
            name: name.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
            notes: notes.trim() || null,
            relationship_type: relationshipType && relationshipType !== 'none' ? relationshipType : null,
            tags: tags.length > 0 ? tags : null,
          })
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
            title: 'Contact updated',
            description: `${name} has been updated`,
          })
          onSaved()
          onOpenChange(false)
        }
      } else {
        // Create new contact
        const insertData: ContactInsert = {
          user_id: user.id,
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          relationship_type: relationshipType && relationshipType !== 'none' ? relationshipType : null,
          tags: tags.length > 0 ? tags : null,
          source: 'manual',
        }

        const { error } = await supabase
          .from('contacts')
          .insert(insertData)

        if (error) {
          toast({
            title: 'Error',
            description: error.message,
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Contact added',
            description: `${name} has been added to your contacts`,
          })
          onSaved()
          onOpenChange(false)
        }
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  function handleAddTag() {
    const trimmed = tagInput.trim()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
      setTagInput('')
    }
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  function handleTagInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          <DialogDescription>
            {contact ? 'Update contact information' : 'Add a new contact to your address book'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="123 Main St, City, State"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="relationshipType">Relationship Type</Label>
              <Select 
                value={relationshipType} 
                onValueChange={(value) => setRelationshipType(value || 'none')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="teammate">Teammate</SelectItem>
                  <SelectItem value="opponent">Opponent</SelectItem>
                  <SelectItem value="coach">Coach</SelectItem>
                  <SelectItem value="facility_staff">Facility Staff</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  placeholder="Add a tag and press Enter"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                >
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about this contact..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {contact ? 'Update' : 'Add'} Contact
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
