'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FLIGHT_SCREEN_X, FLIGHT_SCREEN_Y } from '@/lib/scene-config'

const POOL_SIZE = 6
const SPEED    = 28
const TRAIL    = 4.5

type Star = {
  active:      boolean
  x:           number
  y:           number
  z:           number
  lifetime:    number
  maxLifetime: number
}

function makePool(): Star[] {
  return Array.from({ length: POOL_SIZE }, () => ({
    active: false, x: 0, y: 0, z: 0, lifetime: 0, maxLifetime: 0,
  }))
}

function spawnStar(star: Star) {
  star.active      = true
  star.lifetime    = 0
  star.maxLifetime = 0.4 + Math.random() * 0.3
  // 화면 가장자리 부근 랜덤 위치에서 시작
  star.x = (Math.random() - 0.5) * 40
  star.y = (Math.random() - 0.5) * 20
  star.z = -10 - Math.random() * 20
}

export default function ShootingStars() {
  const ref       = useRef<THREE.LineSegments>(null)
  const pool      = useRef<Star[]>(makePool())
  const nextSpawn = useRef(2 + Math.random() * 3)

  // 각 슈팅스타: head(3) + tail(3) = 6 floats
  const positions = useMemo(() => new Float32Array(POOL_SIZE * 6), [])

  useFrame((state, delta) => {
    if (!ref.current) return
    const d = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime

    // 스폰 타이밍
    nextSpawn.current -= d
    if (nextSpawn.current <= 0) {
      const idle = pool.current.find(s => !s.active)
      if (idle) spawnStar(idle)
      nextSpawn.current = 3 + Math.random() * 5
    }

    const pos = ref.current.geometry.attributes.position.array as Float32Array
    const mat = ref.current.material as THREE.LineBasicMaterial

    let maxAlpha = 0

    pool.current.forEach((star, i) => {
      const base = i * 6
      if (!star.active) {
        // 비활성: 원점에 숨김
        pos[base]     = 0; pos[base+1] = 0; pos[base+2] = 0
        pos[base+3]   = 0; pos[base+4] = 0; pos[base+5] = 0
        return
      }

      star.lifetime += d
      if (star.lifetime >= star.maxLifetime) {
        star.active = false
        pos[base] = 0; pos[base+1] = 0; pos[base+2] = 0
        pos[base+3] = 0; pos[base+4] = 0; pos[base+5] = 0
        return
      }

      // 이동
      star.x += FLIGHT_SCREEN_X * SPEED * d
      star.y += FLIGHT_SCREEN_Y * SPEED * d

      // head
      pos[base]   = star.x
      pos[base+1] = star.y
      pos[base+2] = star.z
      // tail (반대 방향)
      pos[base+3] = star.x - FLIGHT_SCREEN_X * TRAIL
      pos[base+4] = star.y - FLIGHT_SCREEN_Y * TRAIL
      pos[base+5] = star.z

      // fade in/out
      const progress = star.lifetime / star.maxLifetime
      const alpha    = progress < 0.2
        ? progress / 0.2
        : 1 - (progress - 0.2) / 0.8
      if (alpha > maxAlpha) maxAlpha = alpha
    })

    mat.opacity = Math.max(maxAlpha, 0)
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color="#ffffff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  )
}
