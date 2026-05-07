'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const STAR_COUNT = 6000
const SPREAD = 200
// 로켓 비행 방향(-X, +Y, -Z)의 반대 — 별들이 우측 하단+카메라 쪽으로 흐름
const VX = 0.30
const VY = -0.10
const VZ = 0.25

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
    const pos = ref.current.geometry.attributes.position.array as Float32Array
    const dx = VX * delta * 60
    const dy = VY * delta * 60
    const dz = VZ * delta * 60

    for (let i = 0; i < STAR_COUNT; i++) {
      pos[i * 3]     += dx
      pos[i * 3 + 1] += dy
      pos[i * 3 + 2] += dz

      // 범위 벗어나면 반대편에서 재등장
      if (pos[i * 3 + 2] > SPREAD / 2) {
        pos[i * 3 + 2] = -SPREAD / 2
        pos[i * 3]     = (Math.random() - 0.5) * SPREAD
        pos[i * 3 + 1] = (Math.random() - 0.5) * SPREAD
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
