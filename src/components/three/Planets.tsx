'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STAR_VX, STAR_VY } from '@/lib/scene-config'

const PARALLAX = 0.05
const BOUND_X  = 50
const BOUND_Y  = 30

function move(pos: THREE.Vector3, dx: number, dy: number) {
  pos.x += dx
  pos.y += dy
  if (pos.x > BOUND_X) {
    pos.x = -BOUND_X
    pos.y = (Math.random() - 0.5) * BOUND_Y
  }
  if (pos.y < -BOUND_Y) {
    pos.y = BOUND_Y
    pos.x = (Math.random() - 0.5) * BOUND_X
  }
}

// 목성형 대기 밴드 텍스처
function createBandTexture(
  base: [number, number, number],
  accent: [number, number, number],
): THREE.CanvasTexture {
  const W = 1024, H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!

  // 기본 배경
  ctx.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`
  ctx.fillRect(0, 0, W, H)

  // 대기 밴드 — y 위치마다 굴곡있는 가로 선들
  const bands = 18
  for (let bi = 0; bi < bands; bi++) {
    const cy   = (bi / bands) * H
    const bh   = (H / bands) * (0.3 + Math.random() * 0.5)
    const t    = Math.random()
    const cr   = Math.round(base[0] + (accent[0] - base[0]) * t)
    const cg   = Math.round(base[1] + (accent[1] - base[1]) * t)
    const cb   = Math.round(base[2] + (accent[2] - base[2]) * t)
    const alpha = 0.25 + Math.random() * 0.45

    ctx.beginPath()
    ctx.moveTo(0, cy)
    // 굴곡진 밴드 경계
    for (let x = 0; x <= W; x += 20) {
      const wobble = Math.sin(x / W * Math.PI * 4 + bi * 1.3) * 6 +
                     Math.sin(x / W * Math.PI * 9 + bi * 0.7) * 3
      ctx.lineTo(x, cy + wobble)
    }
    ctx.lineTo(W, cy + bh)
    for (let x = W; x >= 0; x -= 20) {
      const wobble = Math.sin(x / W * Math.PI * 4 + bi * 1.3) * 6 +
                     Math.sin(x / W * Math.PI * 9 + bi * 0.7) * 3
      ctx.lineTo(x, cy + bh + wobble)
    }
    ctx.closePath()
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`
    ctx.fill()
  }

  // 소용돌이 반점 (대적점 느낌)
  const spots = [
    { x: 0.35, y: 0.45, rx: 0.06, ry: 0.03 },
    { x: 0.70, y: 0.30, rx: 0.03, ry: 0.015 },
    { x: 0.55, y: 0.65, rx: 0.025, ry: 0.012 },
  ]
  for (const s of spots) {
    const gx = s.x * W, gy = s.y * H
    ctx.save()
    ctx.translate(gx, gy)
    ctx.scale(1, s.ry / s.rx)
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.rx * W)
    g.addColorStop(0,   `rgba(${accent[0]},${accent[1]},${accent[2]},0.55)`)
    g.addColorStop(0.5, `rgba(${accent[0]},${accent[1]},${accent[2]},0.20)`)
    g.addColorStop(1,   `rgba(0,0,0,0)`)
    ctx.fillStyle = g
    ctx.fillRect(-s.rx * W, -s.rx * W, s.rx * W * 2, s.rx * W * 2)
    ctx.restore()
  }

  return new THREE.CanvasTexture(canvas)
}

// 파티클 글로우 텍스처
function createDustTexture(): THREE.CanvasTexture {
  const S = 64
  const canvas = document.createElement('canvas')
  canvas.width = S; canvas.height = S
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0,   'rgba(255,240,220,1)')
  g.addColorStop(0.3, 'rgba(220,200,180,0.6)')
  g.addColorStop(1,   'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  return new THREE.CanvasTexture(canvas)
}

// 링 파티클 — 먼지 입자들이 행성을 공전
function RingParticles({
  innerR, outerR, count, tilt,
}: {
  innerR: number; outerR: number; count: number; tilt: [number, number, number]
}) {
  const ref     = useRef<THREE.Points>(null)
  const texture = useMemo(() => createDustTexture(), [])

  const { positions, opacities } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const opacities = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      // 밴드 구분: 일부 구간은 밀도 낮춤 (카시니 구분선 느낌)
      let r = innerR + Math.random() * (outerR - innerR)
      const normalized = (r - innerR) / (outerR - innerR)
      if (normalized > 0.42 && normalized < 0.52) r = innerR + (Math.random() < 0.5 ? normalized * 0.42 : normalized * 0.52) * (outerR - innerR)
      const ySpread = (Math.random() - 0.5) * 0.12
      positions[i * 3]     = Math.cos(angle) * r
      positions[i * 3 + 1] = ySpread
      positions[i * 3 + 2] = Math.sin(angle) * r
      opacities[i] = 0.3 + Math.random() * 0.7
    }
    return { positions, opacities }
  }, [innerR, outerR, count])

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += Math.min(delta, 0.05) * 0.06
  })

  // tilt은 부모 group에 고정, 애니메이션은 points에서만
  return (
    <group rotation={tilt}>
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={texture}
        color="#d4c8b0"
        size={0.055}
        sizeAttenuation
        transparent
        opacity={0.75}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
    </group>
  )
}

// 암석형 소행성 텍스처
function createAsteroidTexture(): THREE.CanvasTexture {
  const S = 256
  const canvas = document.createElement('canvas')
  canvas.width = S; canvas.height = S
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#5a5248'
  ctx.fillRect(0, 0, S, S)

  // 불규칙 암석 반점
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * S
    const y = Math.random() * S
    const r = 4 + Math.random() * 18
    const dark = Math.random() > 0.5
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    const c1 = dark ? '38,32,28' : '90,82,70'
    const c2 = dark ? '55,48,40' : '72,65,55'
    g.addColorStop(0,   `rgba(${c1},0.8)`)
    g.addColorStop(0.6, `rgba(${c2},0.4)`)
    g.addColorStop(1,   `rgba(0,0,0,0)`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  return new THREE.CanvasTexture(canvas)
}

function LargePlanet() {
  const groupRef  = useRef<THREE.Group>(null)
  const outerRef  = useRef<THREE.Mesh>(null)   // 외부 가스층 — 느리게 회전
  const innerRef  = useRef<THREE.Mesh>(null)   // 내부 가스층 — 빠르게 회전

  const outerTex = useMemo(() => createBandTexture([72, 95, 145], [180, 140, 100]), [])
  const innerTex = useMemo(() => createBandTexture([55, 80, 160], [200, 160, 90]), [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const d  = Math.min(delta, 0.05)
    move(groupRef.current.position, STAR_VX * d * 60 * PARALLAX, STAR_VY * d * 60 * PARALLAX)
    if (outerRef.current) outerRef.current.rotation.y += d * 0.03
    if (innerRef.current) innerRef.current.rotation.y += d * 0.08  // 내부가 더 빠름
  })

  return (
    <group ref={groupRef} position={[-18, 6, -35]}>
      {/* 내부 가스층 */}
      <mesh ref={innerRef} scale={[0.97, 0.97, 0.97]}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshStandardMaterial
          map={innerTex}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>

      {/* 외부 가스층 */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[2.5, 48, 48]} />
        <meshStandardMaterial
          map={outerTex}
          metalness={0}
          roughness={0.75}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>

      {/* 대기 글로우 */}
      <mesh scale={[1.04, 1.04, 1.04]}>
        <sphereGeometry args={[2.5, 24, 24]} />
        <meshStandardMaterial
          color="#88aadd"
          emissive="#3366bb"
          emissiveIntensity={0.6}
          transparent
          opacity={0.035}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 링 — 먼지 파티클 공전 */}
      <RingParticles innerR={3.2} outerR={6.0} count={10000} tilt={[0.45, 0, 0.18]} />
    </group>
  )
}

function SmallPlanet() {
  const groupRef = useRef<THREE.Group>(null)
  const outerRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const outerTex = useMemo(() => createBandTexture([160, 90, 60], [100, 55, 40]), [])
  const innerTex = useMemo(() => createBandTexture([180, 110, 70], [80, 45, 30]), [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const d = Math.min(delta, 0.05)
    move(groupRef.current.position, STAR_VX * d * 60 * PARALLAX, STAR_VY * d * 60 * PARALLAX)
    if (outerRef.current) outerRef.current.rotation.y += d * 0.05
    if (innerRef.current) innerRef.current.rotation.y += d * 0.12
  })

  return (
    <group ref={groupRef} position={[12, -4, -25]}>
      <mesh ref={innerRef} scale={[0.97, 0.97, 0.97]}>
        <sphereGeometry args={[0.9, 16, 16]} />
        <meshStandardMaterial map={innerTex} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh ref={outerRef}>
        <sphereGeometry args={[0.9, 32, 32]} />
        <meshStandardMaterial map={outerTex} metalness={0} roughness={0.85} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* 대기 글로우 */}
      <mesh scale={[1.04, 1.04, 1.04]}>
        <sphereGeometry args={[0.9, 16, 16]} />
        <meshStandardMaterial
          color="#cc8855"
          emissive="#aa5533"
          emissiveIntensity={0.5}
          transparent
          opacity={0.03}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

function Asteroid() {
  const ref     = useRef<THREE.Mesh>(null)
  const rockTex = useMemo(() => createAsteroidTexture(), [])

  useFrame((_, delta) => {
    if (!ref.current) return
    const d  = Math.min(delta, 0.05)
    const dx = STAR_VX * d * 60 * PARALLAX
    const dy = STAR_VY * d * 60 * PARALLAX
    ref.current.rotation.x += d * 0.4
    ref.current.rotation.z += d * 0.25
    move(ref.current.position, dx, dy)
  })

  return (
    <mesh ref={ref} position={[20, 9, -20]} scale={[1.0, 0.72, 0.85]}>
      <icosahedronGeometry args={[0.5, 1]} />
      <meshStandardMaterial
        map={rockTex}
        metalness={0.05}
        roughness={0.95}
        color="#887766"
      />
    </mesh>
  )
}

export default function Planets() {
  return (
    <>
      <LargePlanet />
      <SmallPlanet />
      <Asteroid />
    </>
  )
}
