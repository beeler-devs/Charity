'use client'

import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AvailabilityGrid } from '@/components/availability/availability-grid'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save } from 'lucide-react'
import { getAllDays, getAllTimeSlots, generateTimeSlots } from '@/lib/availability-utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export default function DefaultAvailabilityPage() {
  const [availability, setAvailability] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadAvailability()
  }, [])

  async function loadAvailability() {
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('availability_defaults')
      .eq('id', user.id)
      .single()

    if (profile?.availability_defaults && Object.keys(profile.availability_defaults).length > 0) {
      setAvailability(profile.availability_defaults as Record<string, string[]>)
    } else {
      // Initialize with no time slots selected (unavailable by default - user must mark when available)
      setAvailability({})
    }

    setLoading(false)
  }

  async function saveAvailability() {
    setSaving(true)
    const supabase = createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in',
        variant: 'destructive',
      })
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ availability_defaults: availability })
      .eq('id', user.id)

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Saved',
        description: 'Your default availability has been saved',
      })
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header title="Default Availability" />

      <main className="flex-1 p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>My Weekly Availability</CardTitle>
            <CardDescription>
              Select the times you're typically available. This will pre-fill when setting match-specific availability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 bg-muted rounded-lg text-sm">
              <p className="text-muted-foreground">
                By default, you're unavailable. Click and drag to select times when you ARE available.
              </p>
            </div>

            {/* Quick day selection */}
            <div className="mb-4 p-4 border rounded-lg bg-background">
              <Label className="text-sm font-medium mb-3 block">Mark Days as Available</Label>
              <div className="flex flex-wrap gap-4">
                {getAllDays().map((day) => {
                  const daySlots = availability[day] || []
                  const allTimeSlots = getAllTimeSlots()[day] || []
                  const isDayAvailable = daySlots.length === allTimeSlots.length
                  
                  return (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day}`}
                        checked={isDayAvailable}
                        onCheckedChange={(checked) => {
                          const newAvailability = { ...availability }
                          if (checked) {
                            // Mark entire day as available (select all time slots)
                            newAvailability[day] = getAllTimeSlots()[day] || []
                          } else {
                            // Mark entire day as unavailable (deselect all time slots)
                            newAvailability[day] = []
                          }
                          setAvailability(newAvailability)
                        }}
                      />
                      <Label
                        htmlFor={`day-${day}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {day}
                      </Label>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Check a day to mark the entire day as available. Uncheck it to mark the entire day as unavailable.
              </p>
            </div>

            {/* Quick time range selection */}
            <div className="mb-4 p-4 border rounded-lg bg-background">
              <Label className="text-sm font-medium mb-3 block">Mark Time Ranges as Available</Label>
              <div className="space-y-4">
                {[
                  { label: 'Early Morning', timeRange: '5:00 AM - 8:00 AM', start: '05:00', end: '08:00' },
                  { label: 'Morning', timeRange: '8:00 AM - 12:00 PM', start: '08:00', end: '12:00' },
                  { label: 'Midday', timeRange: '12:00 PM - 2:00 PM', start: '12:00', end: '14:00' },
                  { label: 'Afternoon', timeRange: '2:00 PM - 5:00 PM', start: '14:00', end: '17:00' },
                  { label: 'Early Evening', timeRange: '5:00 PM - 7:00 PM', start: '17:00', end: '19:00' },
                  { label: 'Evening', timeRange: '7:00 PM - 9:00 PM', start: '19:00', end: '21:00' },
                  { label: 'Late Evening', timeRange: '9:00 PM - 10:30 PM', start: '21:00', end: '22:30' },
                ].map((range) => {
                  const timeSlots = generateTimeSlots(5, 22)
                  const rangeSlots = timeSlots.filter(slot => {
                    const [hour, min] = slot.split(':').map(Number)
                    const slotMinutes = hour * 60 + min
                    const [startHour, startMin] = range.start.split(':').map(Number)
                    const [endHour, endMin] = range.end.split(':').map(Number)
                    const startMinutes = startHour * 60 + startMin
                    const endMinutes = endHour * 60 + endMin
                    // Include slots from start (inclusive) to end (inclusive)
                    return slotMinutes >= startMinutes && slotMinutes <= endMinutes
                  })

                  // Check which days have this time range available
                  const daysAvailable: Record<string, boolean> = {}
                  getAllDays().forEach(day => {
                    const daySlots = availability[day] || []
                    daysAvailable[day] = rangeSlots.every(slot => daySlots.includes(slot))
                  })

                  const allDaysAvailable = Object.values(daysAvailable).every(val => val)
                  const someDaysAvailable = Object.values(daysAvailable).some(val => val)

                  return (
                    <div key={range.label} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">{range.label}</Label>
                          <p className="text-xs text-muted-foreground">{range.timeRange}</p>
                        </div>
                        <Button
                          type="button"
                          variant={allDaysAvailable ? "default" : someDaysAvailable ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newAvailability = { ...availability }
                            const selectedDays = getAllDays().filter(day => daysAvailable[day])
                            
                            if (selectedDays.length > 0) {
                              // Make unavailable for selected days
                              selectedDays.forEach(day => {
                                const daySlots = newAvailability[day] || []
                                newAvailability[day] = daySlots.filter(slot => !rangeSlots.includes(slot))
                              })
                            } else {
                              // Make available for all days
                              getAllDays().forEach(day => {
                                const daySlots = newAvailability[day] || []
                                const updatedSlots = [...daySlots]
                                rangeSlots.forEach(slot => {
                                  if (!updatedSlots.includes(slot)) {
                                    updatedSlots.push(slot)
                                  }
                                })
                                newAvailability[day] = updatedSlots.sort()
                              })
                            }
                            setAvailability(newAvailability)
                          }}
                        >
                          {allDaysAvailable ? 'Make Unavailable (All Days)' : someDaysAvailable ? 'Make Unavailable (Selected)' : 'Make Available (All Days)'}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {getAllDays().map((day) => {
                          const isAvailable = daysAvailable[day]
                          return (
                            <div key={day} className="flex items-center space-x-2">
                              <Checkbox
                                id={`${range.label}-${day}`}
                                checked={isAvailable}
                                onCheckedChange={(checked) => {
                                  const newAvailability = { ...availability }
                                  const daySlots = newAvailability[day] || []
                                  
                                  if (checked) {
                                    // Make available: add all slots in range
                                    const updatedSlots = [...daySlots]
                                    rangeSlots.forEach(slot => {
                                      if (!updatedSlots.includes(slot)) {
                                        updatedSlots.push(slot)
                                      }
                                    })
                                    newAvailability[day] = updatedSlots.sort()
                                  } else {
                                    // Make unavailable: remove all slots in range
                                    newAvailability[day] = daySlots.filter(slot => !rangeSlots.includes(slot))
                                  }
                                  setAvailability(newAvailability)
                                }}
                              />
                              <Label
                                htmlFor={`${range.label}-${day}`}
                                className={cn(
                                  "text-sm font-normal cursor-pointer",
                                  isAvailable && "text-primary"
                                )}
                              >
                                {day.slice(0, 3)}
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Select specific days for each time range, or use the button to apply to all days at once.
              </p>
            </div>
            
            <AvailabilityGrid
              mode="weekly"
              selectedSlots={availability}
              onSelectionChange={(slots) => setAvailability(slots as Record<string, string[]>)}
              startHour={5}
              endHour={22}
            />

            <div className="mt-6 flex justify-end">
              <Button onClick={saveAvailability} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Availability
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
