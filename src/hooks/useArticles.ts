// src/hooks/useArticles.ts
import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function useArticles() {
  const [articles, setArticles] = useState([])

  useEffect(() => {
    // Initial load
    supabase
      .from('wire_feed')  // the view: pending articles, newest first
      .select('*')
      .then(({ data }) => setArticles(data ?? []))

    // Realtime: push new articles as they arrive
    const channel = supabase
      .channel('articles-feed')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'articles',
        filter: 'status=eq.pending',
      }, (payload) => {
        setArticles(prev => [payload.new, ...prev])
        // Optional: browser notification
        if (Notification.permission === 'granted') {
          new Notification('New story — Amaica Wire', {
            body: payload.new.title,
            icon: '/favicon.ico',
          })
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  return articles
}
