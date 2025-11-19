'use client'

import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  title: string
  showNotifications?: boolean
}

export function Header({ title, showNotifications = true }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-top">
      <div className="flex h-14 items-center justify-between px-4">
        <h1 className="text-lg font-semibold">{title}</h1>
        {showNotifications && (
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
          </Button>
        )}
      </div>
    </header>
  )
}
