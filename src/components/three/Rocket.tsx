'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import RocketFlame from './RocketFlame'

export default function Rocket() {
  const outerRef = useRef<THREE.Group>(null)
  const bodyRef  = useRef<THREE.Group>(null)

  useFrame((state, delta) => {
    if (!outerRef.current || !bodyRef.current) return
    const t = state.clock.elapsedTime
    // 외부: 위아래 둥둥만
    outerRef.current.position.y = 0.3 + Math.sin(t * 0.6) * 0.04
    // 내부 몸통만 Y축 회전
    bodyRef.current.rotation.y += delta * 0.18
  })

  return (
    <group ref={outerRef} position={[0, 0.3, -6]} rotation={[-1.55, 0.4, 0.9]} scale={0.5}>
      {/* 방향 고정 — 불꽃은 항상 엔진 뒤쪽 */}
      <RocketFlame />

      {/* 몸통만 빙글빙글 */}
      <group ref={bodyRef}>
        {/* 동체 */}
        <mesh>
          <cylinderGeometry args={[0.28, 0.32, 1.1, 10]} />
          <meshStandardMaterial color="#ff6b6b" metalness={0.2} roughness={0.6} />
        </mesh>

        {/* 노즈콘 */}
        <mesh position={[0, 0.82, 0]}>
          <coneGeometry args={[0.28, 0.6, 10]} />
          <meshStandardMaterial color="#ffd93d" metalness={0.1} roughness={0.5} />
        </mesh>

        {/* 동체 하단 링 */}
        <mesh position={[0, -0.52, 0]}>
          <cylinderGeometry args={[0.32, 0.36, 0.12, 10]} />
          <meshStandardMaterial color="#cc4444" metalness={0.3} roughness={0.5} />
        </mesh>

        {/* 창문 */}
        <mesh position={[0, 0.2, 0.29]}>
          <circleGeometry args={[0.13, 12]} />
          <meshStandardMaterial color="#a8e6ff" emissive="#66ccff" emissiveIntensity={0.8} metalness={0.1} roughness={0.1} />
        </mesh>
        <mesh position={[0, 0.2, 0.28]}>
          <ringGeometry args={[0.13, 0.17, 12]} />
          <meshStandardMaterial color="#ffd93d" metalness={0.4} roughness={0.4} />
        </mesh>

        {/* 핀 3개 */}
        {[0, 120, 240].map((deg) => {
          const rad = (deg * Math.PI) / 180
          return (
            <mesh
              key={deg}
              position={[Math.sin(rad) * 0.3, -0.6, Math.cos(rad) * 0.3]}
              rotation={[0, -rad, 0]}
            >
              <boxGeometry args={[0.08, 0.3, 0.36]} />
              <meshStandardMaterial color="#ffd93d" metalness={0.2} roughness={0.5} />
            </mesh>
          )
        })}

        {/* 엔진 노즐 */}
        <mesh position={[0, -0.78, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.18, 0.22, 10]} />
          <meshStandardMaterial color="#994444" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}
