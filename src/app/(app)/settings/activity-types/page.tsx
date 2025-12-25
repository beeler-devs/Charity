'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Loader2, ChevronUp, ChevronDown } from 'lucide-react'
import { ActivityTypeBadge } from '@/components/activities/activity-type-badge'
import { ActivityType } from '@/lib/calendar-utils'
import { getActivityTypeLabel } from '@/lib/event-type-colors'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface ActivityTypePreference {
  activity_type: ActivityType
  is_enabled: boolean
  display_order: number
}

export default function ActivityTypesSettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<ActivityTypePreference[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    loadPreferences()
  }, [])

  async function loadPreferences() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    try {
      // Get user's preferences
      const { data, error } = await supabase.rpc('get_user_activity_types', {
        target_user_id: user.id,
      })

      if (error) {
        console.error('Error loading preferences:', error)
        // Try to initialize preferences if they don't exist
        const { error: initError } = await supabase.rpc('initialize_user_activity_type_preferences', {
          target_user_id: user.id,
        })
        
        if (initError) {
          console.error('Error initializing preferences:', initError)
          toast({
            title: 'Error',
            description: 'Failed to load activity type preferences. Please try refreshing the page.',
            variant: 'destructive',
          })
          // Fallback to default types
          const defaultTypes = [
            { value: 'scrimmage' as ActivityType, label: 'Scrimmage' },
            { value: 'lesson' as ActivityType, label: 'Lesson' },
            { value: 'class' as ActivityType, label: 'Class' },
            { value: 'flex_league' as ActivityType, label: 'Flex League' },
            { value: 'booked_court' as ActivityType, label: 'Booked Court' },
            { value: 'other' as ActivityType, label: 'Other' },
          ]
          setPreferences(
            defaultTypes.map((type, index) => ({
              activity_type: type.value,
              is_enabled: true,
              display_order: index,
            }))
          )
        } else {
          // Retry loading after initialization
          const { data: retryData, error: retryError } = await supabase.rpc('get_user_activity_types', {
            target_user_id: user.id,
          })
          if (retryError || !retryData || retryData.length === 0) {
            // Still failed, use defaults
            const defaultTypes = [
              { value: 'scrimmage' as ActivityType, label: 'Scrimmage' },
              { value: 'lesson' as ActivityType, label: 'Lesson' },
              { value: 'class' as ActivityType, label: 'Class' },
              { value: 'flex_league' as ActivityType, label: 'Flex League' },
              { value: 'booked_court' as ActivityType, label: 'Booked Court' },
              { value: 'other' as ActivityType, label: 'Other' },
            ]
            setPreferences(
              defaultTypes.map((type, index) => ({
                activity_type: type.value,
                is_enabled: true,
                display_order: index,
              }))
            )
          } else {
            setPreferences(retryData as ActivityTypePreference[])
          }
        }
      } else if (data && data.length > 0) {
        setPreferences(data as ActivityTypePreference[])
      } else {
        // No preferences found, initialize them
        const { error: initError } = await supabase.rpc('initialize_user_activity_type_preferences', {
          target_user_id: user.id,
        })
        
        if (initError) {
          console.error('Error initializing preferences:', initError)
        }
        
        // Load again after initialization
        const { data: initData } = await supabase.rpc('get_user_activity_types', {
          target_user_id: user.id,
        })
        
        if (initData && initData.length > 0) {
          setPreferences(initData as ActivityTypePreference[])
        } else {
          // Fallback to defaults
          const defaultTypes = [
            { value: 'scrimmage' as ActivityType, label: 'Scrimmage' },
            { value: 'lesson' as ActivityType, label: 'Lesson' },
            { value: 'class' as ActivityType, label: 'Class' },
            { value: 'flex_league' as ActivityType, label: 'Flex League' },
            { value: 'booked_court' as ActivityType, label: 'Booked Court' },
            { value: 'other' as ActivityType, label: 'Other' },
          ]
          setPreferences(
            defaultTypes.map((type, index) => ({
              activity_type: type.value,
              is_enabled: true,
              display_order: index,
            }))
          )
        }
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
      toast({
        title: 'Error',
        description: 'Failed to load activity type preferences',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function savePreferences() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setSaving(false)
      return
    }

    try {
      // Delete all existing preferences
      const { error: deleteError } = await supabase
        .from('user_activity_type_preferences')
        .delete()
        .eq('user_id', user.id)

      if (deleteError) {
        throw deleteError
      }

      // Insert updated preferences
      const preferencesToInsert = preferences.map((pref, index) => ({
        user_id: user.id,
        activity_type: pref.activity_type,
        is_enabled: pref.is_enabled,
        display_order: index,
      }))

      const { error: insertError } = await supabase
        .from('user_activity_type_preferences')
        .insert(preferencesToInsert)

      if (insertError) {
        throw insertError
      }

      toast({
        title: 'Preferences saved',
        description: 'Your activity type preferences have been updated',
      })

      setHasChanges(false)
    } catch (error: any) {
      console.error('Error saving preferences:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to save preferences',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleToggle(activityType: ActivityType, enabled: boolean) {
    setPreferences((prev) =>
      prev.map((pref) =>
        pref.activity_type === activityType
          ? { ...pref, is_enabled: enabled }
          : pref
      )
    )
    setHasChanges(true)
  }

  function moveUp(index: number) {
    if (index === 0) return
    setPreferences((items) => {
      const newItems = [...items]
      const temp = newItems[index]
      newItems[index] = newItems[index - 1]
      newItems[index - 1] = temp
      return newItems
    })
    setHasChanges(true)
  }

  function moveDown(index: number) {
    if (index === preferences.length - 1) return
    setPreferences((items) => {
      const newItems = [...items]
      const temp = newItems[index]
      newItems[index] = newItems[index + 1]
      newItems[index + 1] = temp
      return newItems
    })
    setHasChanges(true)
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header title="Activity Types" />
        <main className="flex-1 p-4 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen pb-16">
      <Header title="Activity Types" />

      <main className="flex-1 p-4 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" onClick={() => router.back()} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Activity Types</CardTitle>
            <CardDescription>
              Configure which activity types you want to use when creating personal activities.
              Drag to reorder, and toggle to enable or disable types.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {preferences.map((preference, index) => (
                <div
                  key={preference.activity_type}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-background"
                >
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveDown(index)}
                      disabled={index === preferences.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <ActivityTypeBadge activityType={preference.activity_type} />
                  <div className="flex-1">
                    <Label className="font-medium">{getActivityTypeLabel(preference.activity_type)}</Label>
                  </div>
                  <Switch
                    checked={preference.is_enabled}
                    onCheckedChange={(checked) => handleToggle(preference.activity_type, checked)}
                  />
                </div>
              ))}
            </div>

            {hasChanges && (
              <div className="mt-6 flex gap-2">
                <Button
                  onClick={savePreferences}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    loadPreferences()
                    setHasChanges(false)
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

