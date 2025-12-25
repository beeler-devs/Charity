'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Contact } from '@/types/database.types'
import { Phone, Mail, MessageCircle, MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ContactListItemProps {
  contact: Contact
  onDelete?: (contactId: string) => void
}

export function ContactListItem({ contact, onDelete }: ContactListItemProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRelationshipBadge = (type?: string | null) => {
    if (!type) return null
    const colors: Record<string, string> = {
      teammate: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      opponent: 'bg-orange-500/10 text-orange-700 dark:text-orange-400',
      coach: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
      facility_staff: 'bg-green-500/10 text-green-700 dark:text-green-400',
      other: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
    }
    return (
      <Badge variant="outline" className={`text-xs ${colors[type] || colors.other}`}>
        {type.replace('_', ' ')}
      </Badge>
    )
  }

  const handleCall = () => {
    if (contact.phone) {
      window.location.href = `tel:${contact.phone}`
    }
  }

  const handleEmail = () => {
    if (contact.email) {
      window.location.href = `mailto:${contact.email}`
    }
  }

  const handleMessage = () => {
    // TODO: Navigate to messages with this contact
    // For now, just show email option
    if (contact.email) {
      window.location.href = `mailto:${contact.email}`
    }
  }

  return (
    <Link href={`/contacts/${contact.id}`}>
      <div className="flex items-center gap-3 p-3 hover:bg-accent transition-colors rounded-lg cursor-pointer">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(contact.name)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate">{contact.name}</h3>
            {contact.source === 'auto' && (
              <Badge variant="outline" className="text-xs">
                Auto
              </Badge>
            )}
            {getRelationshipBadge(contact.relationship_type)}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {contact.email && (
              <span className="truncate">{contact.email}</span>
            )}
            {contact.phone && contact.email && <span>•</span>}
            {contact.phone && (
              <span>{contact.phone}</span>
            )}
          </div>
          
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {contact.tags.slice(0, 3).map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {contact.tags.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{contact.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {contact.phone && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.preventDefault()
                handleCall()
              }}
            >
              <Phone className="h-4 w-4" />
            </Button>
          )}
          {contact.email && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.preventDefault()
                handleEmail()
              }}
            >
              <Mail className="h-4 w-4" />
            </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="end">
              <div className="flex flex-col">
                {contact.email && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start"
                    onClick={(e) => {
                      e.preventDefault()
                      handleMessage()
                    }}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start text-destructive"
                    onClick={(e) => {
                      e.preventDefault()
                      if (confirm(`Delete ${contact.name}?`)) {
                        onDelete(contact.id)
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </Link>
  )
}
