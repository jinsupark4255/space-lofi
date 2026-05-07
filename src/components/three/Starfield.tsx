'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STAR_VX, STAR_VY, STAR_VZ } from '@/lib/scene-config'

const STAR_COUNT = 6000
const SPREAD = 200

export default function Starfield() {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const pos = new Float32Array(STAR_COUNT * 3)
    for (let i = 0; i < STAR_COUNT; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * SPREAD
      pos[i * 3 + 1] = (Math.random() - 0.5) * SPREAD
      pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD
    }
    return pos
  }, [])

  useFrame((_, delta) => {
    if (!ref.current) return
    const d = Math.min(delta, 0.05)
    const pos = ref.current.geometry.attributes.position.array as Float32Array
    const dx = STAR_VX * d * 60
    const dy = STAR_VY * d * 60
    const dz = STAR_VZ * d * 60

    for (let i = 0; i < STAR_COUNT; i++) {
      pos[i * 3]     += dx
      pos[i * 3 + 1] += dy
      pos[i * 3 + 2] += dz

      const half = SPREAD / 2
      if (pos[i * 3] > half) {
        // 오른쪽으로 나감 → 왼쪽에서 재등장
        pos[i * 3]     = -half
        pos[i * 3 + 1] = (Math.random() - 0.5) * SPREAD
        pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD
      } else if (pos[i * 3 + 1] < -half) {
        // 아래로 나감 → 위에서 재등장
        pos[i * 3]     = (Math.random() - 0.5) * SPREAD
        pos[i * 3 + 1] = half
        pos[i * 3 + 2] = (Math.random() - 0.5) * SPREAD
      } else if (pos[i * 3 + 2] > half) {
        // 카메라 앞으로 나감 → 뒤에서 재등장
        pos[i * 3]     = (Math.random() - 0.5) * SPREAD
        pos[i * 3 + 1] = (Math.random() - 0.5) * SPREAD
        pos[i * 3 + 2] = -half
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffffff"
        size={0.14}
        sizeAttenuation
        transparent
        opacity={0.85}
        fog={false}
      />
    </points>
  )
}
