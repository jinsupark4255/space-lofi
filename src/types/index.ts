export type Mood = 'chill' | 'deep' | 'cosmic'

export type Track = {
  id: string
  title: string
  file_url: string
  duration_seconds: number
  mood: Mood
}
