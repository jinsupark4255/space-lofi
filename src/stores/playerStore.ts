import { create } from 'zustand'
import type { Track } from '@/types'

type PlayerStore = {
  tracks:         Track[]
  currentIndex:   number
  isPlaying:      boolean
  volume:         number
  currentTime:    number
  listenedSeconds: number

  setTracks:      (tracks: Track[]) => void
  setCurrentIndex:(index: number)   => void
  setIsPlaying:   (v: boolean)      => void
  setVolume:      (v: number)       => void
  setCurrentTime: (v: number)       => void
  addListened:    (seconds: number) => void
  resetListened:  ()                => void

  currentTrack: () => Track | null
  next:         () => void
  prev:         () => void
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  tracks:          [],
  currentIndex:    0,
  isPlaying:       false,
  volume:          0.8,
  currentTime:     0,
  listenedSeconds: 0,

  setTracks:       (tracks)  => set({ tracks, currentIndex: 0 }),
  setCurrentIndex: (index)   => set({ currentIndex: index, currentTime: 0 }),
  setIsPlaying:    (v)       => set({ isPlaying: v }),
  setVolume:       (v)       => set({ volume: v }),
  setCurrentTime:  (v)       => set({ currentTime: v }),
  addListened:     (seconds) => set(s => ({ listenedSeconds: s.listenedSeconds + seconds })),
  resetListened:   ()        => set({ listenedSeconds: 0 }),

  currentTrack: () => {
    const { tracks, currentIndex } = get()
    return tracks[currentIndex] ?? null
  },
  next: () => {
    const { tracks, currentIndex } = get()
    if (!tracks.length) return
    set({ currentIndex: (currentIndex + 1) % tracks.length, currentTime: 0 })
  },
  prev: () => {
    const { tracks, currentIndex } = get()
    if (!tracks.length) return
    set({ currentIndex: (currentIndex - 1 + tracks.length) % tracks.length, currentTime: 0 })
  },
}))
