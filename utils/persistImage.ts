// @ts-nocheck
import { v4 as uuid } from 'uuid'
import { useSupabase } from '../services/supabaseClient'
import React from 'react'

export function usePersistImage() {
  const supabase = useSupabase()

  const persistImage = React.useCallback(async (replicateUrl: string) => {
    const res = await fetch(replicateUrl)
    if (!res.ok) throw new Error('Unable to download image')
    const blob = await res.blob()
    const filename = `${uuid()}.png`
    const { error } = await supabase.storage.from('generated-images').upload(filename, blob, {
      contentType: blob.type,
      upsert: false
    })
    if (error) throw error
    const { data } = supabase.storage.from('generated-images').getPublicUrl(filename)
    return data.publicUrl
  }, [supabase])

  return { persistImage }
} 