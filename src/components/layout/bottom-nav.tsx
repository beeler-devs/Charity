'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Gamepad2, Trophy, User, MessageCircle, Calendar, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Home',
    href: '/home',
    icon: Home,
  },
  {
    label: 'Calendar',
    href: '/calendar',
    icon: Calendar,
  },
  {
    label: 'Availability',
    href: '/availability',
    icon: CheckCircle2,
  },
  {
    label: 'Teams',
    href: '/teams',
    icon: Users,
  },
  {
    label: 'Messages',
    href: '/messages',
    icon: MessageCircle,
  },
  {
    label: 'Profile',
    href: '/profile',
    icon: User,
  },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full px-2 py-1 transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')} />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
