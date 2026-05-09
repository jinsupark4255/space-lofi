'use client'

import { useEffect } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import AudioPlayer from './AudioPlayer'

export default function PlayerLoader() {
  const setTracks = usePlayerStore(s => s.setTracks)
  const tracks    = usePlayerStore(s => s.tracks)

  useEffect(() => {
    fetch('/api/tracks')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setTracks(data) })
      .catch(console.error)
  }, [setTracks])

  if (!tracks.length) return null

  return <AudioPlayer />
}
