'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Howl } from 'howler'
import { usePlayerStore } from '@/stores/playerStore'

const MOOD_COLORS: Record<string, string> = {
  chill:  '#88bbff',
  deep:   '#bb88ff',
  cosmic: '#ffbb88',
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function flushListen(trackId: string, seconds: number) {
  if (seconds < 1) return
  try {
    await fetch('/api/listen', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ track_id: trackId, duration_seconds: Math.floor(seconds) }),
    })
  } catch {}
}

export default function AudioPlayer() {
  const {
    tracks, currentIndex, isPlaying, volume, currentTime,
    setIsPlaying, setVolume, setCurrentTime, next, prev, setCurrentIndex,
    currentTrack, listenedSeconds, resetListened,
  } = usePlayerStore()

  const howlRef        = useRef<Howl | null>(null)
  const tickRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const listenRef      = useRef(listenedSeconds)
  const prevTrackRef   = useRef<string | null>(null)

  // listenedSeconds를 ref에 동기화 (클로저 최신값 유지)
  useEffect(() => { listenRef.current = listenedSeconds }, [listenedSeconds])

  const stopTick = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
  }, [])

  const startTick = useCallback(() => {
    stopTick()
    tickRef.current = setInterval(() => {
      const h = howlRef.current
      if (!h || !h.playing()) return
      const t = h.seek() as number
      setCurrentTime(t)
      usePlayerStore.getState().addListened(1)
    }, 1000)
  }, [stopTick, setCurrentTime])

  // 트랙 변경 시 Howl 재생성
  useEffect(() => {
    const track = currentTrack()
    if (!track) return

    // 이전 트랙 청취 기록 flush
    if (prevTrackRef.current && prevTrackRef.current !== track.id) {
      flushListen(prevTrackRef.current, listenRef.current)
      resetListened()
    }
    prevTrackRef.current = track.id

    stopTick()
    howlRef.current?.unload()

    const howl = new Howl({
      src:    [track.file_url],
      html5:  true,
      volume,
      onplay: () => { setIsPlaying(true); startTick() },
      onpause:() => { setIsPlaying(false); stopTick() },
      onstop: () => { setIsPlaying(false); stopTick(); setCurrentTime(0) },
      onend:  () => {
        flushListen(track.id, listenRef.current)
        resetListened()
        next()
      },
      onloaderror: (_, err) => console.error('load error', err),
    })

    howlRef.current = howl
    if (isPlaying) howl.play()

    return () => { stopTick(); howl.unload() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, tracks])

  // 재생/정지 동기화
  useEffect(() => {
    const h = howlRef.current
    if (!h) return
    if (isPlaying && !h.playing()) { h.play(); startTick() }
    if (!isPlaying && h.playing())  { h.pause(); stopTick() }
  }, [isPlaying, startTick, stopTick])

  // 볼륨 동기화
  useEffect(() => { howlRef.current?.volume(volume) }, [volume])

  // 언마운트 시 flush
  useEffect(() => {
    return () => {
      const track = currentTrack()
      if (track) flushListen(track.id, listenRef.current)
      stopTick()
      howlRef.current?.unload()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const track    = currentTrack()
  const duration = track?.duration_seconds ?? 0
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (!track) return null

  const moodColor = MOOD_COLORS[track.mood] ?? '#aaaaaa'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* 진행 바 */}
      <div className="h-[2px] bg-white/10 relative">
        <div
          className="absolute inset-y-0 left-0 bg-white/40 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
        <input
          type="range" min={0} max={duration} step={1}
          value={Math.floor(currentTime)}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
          onChange={e => {
            const t = Number(e.target.value)
            howlRef.current?.seek(t)
            setCurrentTime(t)
          }}
        />
      </div>

      {/* 컨트롤 바 */}
      <div
        className="flex items-center gap-4 px-6 py-3"
        style={{ background: 'rgba(4,6,20,0.75)', backdropFilter: 'blur(16px)' }}
      >
        {/* 트랙 정보 */}
        <div className="flex-1 min-w-0">
          <p className="text-white/90 text-sm font-medium truncate">{track.title}</p>
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{ color: moodColor, background: `${moodColor}22` }}
          >
            {track.mood}
          </span>
        </div>

        {/* 재생 컨트롤 */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => prev()}
            className="text-white/50 hover:text-white/90 transition-colors"
          >
            <PrevIcon />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          <button
            onClick={() => next()}
            className="text-white/50 hover:text-white/90 transition-colors"
          >
            <NextIcon />
          </button>
        </div>

        {/* 시간 + 볼륨 */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="text-white/40 text-xs tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex items-center gap-1.5">
            <VolumeIcon muted={volume === 0} />
            <input
              type="range" min={0} max={1} step={0.01}
              value={volume}
              className="w-20 accent-white/60"
              onChange={e => setVolume(Number(e.target.value))}
            />
          </div>

          {/* 트랙 목록 */}
          <div className="flex gap-1">
            {tracks.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setCurrentIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === currentIndex ? 'bg-white scale-125' : 'bg-white/25 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}
function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  )
}
function PrevIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="19,20 9,12 19,4" />
      <rect x="5" y="4" width="3" height="16" rx="1" />
    </svg>
  )
}
function NextIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,4 15,12 5,20" />
      <rect x="16" y="4" width="3" height="16" rx="1" />
    </svg>
  )
}
function VolumeIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
      <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" />
      <path d="M15.54,8.46a5,5,0,0,1,0,7.07" />
      <path d="M19.07,4.93a10,10,0,0,1,0,14.14" />
    </svg>
  )
}
