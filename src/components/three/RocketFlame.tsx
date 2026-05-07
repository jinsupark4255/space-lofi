'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const PARTICLE_COUNT = 250

function createGlowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0,    'rgba(255, 255, 240, 1)')
  gradient.addColorStop(0.15, 'rgba(255, 230, 140, 0.9)')
  gradient.addColorStop(0.4,  'rgba(255, 170, 60,  0.5)')
  gradient.addColorStop(0.7,  'rgba(255, 120, 30,  0.15)')
  gradient.addColorStop(1,    'rgba(255, 80,  0,   0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

function ExhaustParticles() {
  const ref = useRef<THREE.Points>(null)
  const texture = useMemo(() => createGlowTexture(), [])

  const { positions, velocities, lifetimes, maxLifetimes, colors } = useMemo(() => {
    const positions    = new Float32Array(PARTICLE_COUNT * 3)
    const velocities   = new Float32Array(PARTICLE_COUNT * 3)
    const lifetimes    = new Float32Array(PARTICLE_COUNT)
    const maxLifetimes = new Float32Array(PARTICLE_COUNT)
    const colors       = new Float32Array(PARTICLE_COUNT * 3)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 0.16
      positions[i * 3 + 1] = -1.0 - Math.random() * 0.1
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.16

      velocities[i * 3]     = (Math.random() - 0.5) * 0.022
      velocities[i * 3 + 1] = -(0.025 + Math.random() * 0.025)
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.022

      maxLifetimes[i] = 0.7 + Math.random() * 0.5
      lifetimes[i]    = Math.random() * maxLifetimes[i]

      colors[i * 3]     = 1.0
      colors[i * 3 + 1] = 0.6
      colors[i * 3 + 2] = 0.2
    }
    return { positions, velocities, lifetimes, maxLifetimes, colors }
  }, [])

  useFrame((_, delta) => {
    if (!ref.current) return
    const d = Math.min(delta, 0.05)
    const pos = ref.current.geometry.attributes.position.array as Float32Array
    const col = ref.current.geometry.attributes.color.array as Float32Array

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      lifetimes[i] += d

      if (lifetimes[i] > maxLifetimes[i]) {
        pos[i * 3]     = (Math.random() - 0.5) * 0.16
        pos[i * 3 + 1] = -1.0
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.16
        velocities[i * 3]     = (Math.random() - 0.5) * 0.022
        velocities[i * 3 + 1] = -(0.025 + Math.random() * 0.025)
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.022
        lifetimes[i] = 0
      } else {
        pos[i * 3]     += velocities[i * 3]     * d * 60
        pos[i * 3 + 1] += velocities[i * 3 + 1] * d * 60
        pos[i * 3 + 2] += velocities[i * 3 + 2] * d * 60
      }

      // 수명 0 → 흰/노랑, 수명 끝 → 주황/빨강 + 투명해짐
      const t = lifetimes[i] / maxLifetimes[i]           // 0 ~ 1
      const fade = 1 - t
      col[i * 3]     = 1.0                               // R
      col[i * 3 + 1] = (0.85 - t * 0.3) * fade          // G — 노랑/주황 유지
      col[i * 3 + 2] = (0.3  - t * 0.3) * fade          // B — 거의 없음
    }

    ref.current.geometry.attributes.position.needsUpdate = true
    ref.current.geometry.attributes.color.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        size={0.10}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

function FlameLayer({
  color, emissive, scaleX, scaleY, speed, offset,
}: {
  color: string, emissive: string, scaleX: number, scaleY: number, speed: number, offset: number
}) {
  const ref    = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)

  useFrame((state) => {
    if (!ref.current || !matRef.current) return
    const t = state.clock.elapsedTime * speed + offset
    ref.current.scale.set(
      scaleX * (1 + Math.sin(t * 7.3) * 0.12),
      scaleY * (1 + Math.sin(t * 5.1) * 0.15),
      scaleX * (1 + Math.sin(t * 7.3) * 0.12),
    )
    matRef.current.opacity = 0.7 + Math.sin(t * 9) * 0.2
  })

  return (
    <mesh ref={ref} position={[0, -1.0, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.12, 0.7, 8]} />
      <meshStandardMaterial
        ref={matRef}
        color={color}
        emissive={emissive}
        emissiveIntensity={3}
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export default function RocketFlame() {
  const lightRef = useRef<THREE.PointLight>(null)

  useFrame((state) => {
    if (!lightRef.current) return
    const t = state.clock.elapsedTime
    lightRef.current.intensity = 5 + Math.sin(t * 11) * 1.5
  })

  return (
    <>
      <FlameLayer color="#ff2200" emissive="#ff1100" scaleX={1.3} scaleY={1.2} speed={1.0} offset={0} />
      <FlameLayer color="#ff7700" emissive="#ff5500" scaleX={1.0} scaleY={1.0} speed={1.4} offset={1.2} />
      <FlameLayer color="#ffcc00" emissive="#ffaa00" scaleX={0.65} scaleY={0.85} speed={1.8} offset={2.4} />
      <FlameLayer color="#ffffff" emissive="#ffffcc" scaleX={0.3}  scaleY={0.6}  speed={2.4} offset={0.8} />
      <ExhaustParticles />
      <pointLight ref={lightRef} position={[0, -1.2, 0]} color="#ff6600" intensity={5} distance={3.5} />
    </>
  )
}
