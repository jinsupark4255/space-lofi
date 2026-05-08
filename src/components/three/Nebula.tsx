'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { STAR_VX, STAR_VY } from '@/lib/scene-config'

// 호출마다 랜덤하게 다른 wisp 배치 생성 → 각 성운마다 고유한 모양
function createWispTexture(r: number, g: number, b: number): THREE.CanvasTexture {
  const S = 512
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!

  const wispCount = 7 + Math.floor(Math.random() * 5)  // 7~11개
  for (let i = 0; i < wispCount; i++) {
    const cx     = 0.15 + Math.random() * 0.70
    const cy     = 0.15 + Math.random() * 0.70
    const radius = 70  + Math.random() * 180
    const scaleY = 0.15 + Math.random() * 0.50   // 얼마나 납작한 타원인지
    const angle  = Math.random() * Math.PI
    const alpha  = 0.08 + Math.random() * 0.22

    ctx.save()
    ctx.translate(cx * S, cy * S)
    ctx.rotate(angle)
    ctx.scale(1, scaleY)
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
    grad.addColorStop(0,    `rgba(${r},${g},${b},${alpha})`)
    grad.addColorStop(0.40, `rgba(${r},${g},${b},${(alpha * 0.35).toFixed(3)})`)
    grad.addColorStop(0.75, `rgba(${r},${g},${b},${(alpha * 0.06).toFixed(3)})`)
    grad.addColorStop(1,    `rgba(0,0,0,0)`)
    ctx.fillStyle = grad
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
    ctx.restore()
  }

  return new THREE.CanvasTexture(canvas)
}

const DRIFT = 0.04
const BOUND = 90

type LayerDef = { w: number; h: number; rx: number; ry: number; rz: number; opacity: number }
type CloudDef = {
  initPos: [number, number, number]
  r: number; g: number; b: number
  layers: LayerDef[]
  pulseSpeed: number
  pulsePhase: number
}

const CLOUDS: CloudDef[] = [
  // 연보라 — 좌상단, 세로로 긴 형태
  {
    initPos: [-28, 14, -58],
    r: 110, g: 85, b: 205,
    layers: [
      { w: 60, h: 28, rx:  0.00, ry:  0.00, rz:  0.50, opacity: 0.060 },
      { w: 54, h: 22, rx:  0.35, ry:  0.10, rz:  0.65, opacity: 0.048 },
      { w: 48, h: 35, rx: -0.20, ry:  0.30, rz:  0.20, opacity: 0.042 },
      { w: 42, h: 18, rx:  0.15, ry: -0.25, rz:  0.80, opacity: 0.035 },
      { w: 38, h: 40, rx: -0.45, ry:  0.15, rz: -0.10, opacity: 0.028 },
    ],
    pulseSpeed: 0.11, pulsePhase: 0,
  },
  // 연분홍 — 우하단, 가로로 퍼진 형태
  {
    initPos: [26, -14, -48],
    r: 195, g: 105, b: 155,
    layers: [
      { w: 55, h: 20, rx:  0.00, ry:  0.00, rz: -0.30, opacity: 0.055 },
      { w: 48, h: 15, rx: -0.40, ry:  0.20, rz: -0.50, opacity: 0.042 },
      { w: 40, h: 28, rx:  0.20, ry: -0.35, rz: -0.10, opacity: 0.036 },
      { w: 35, h: 12, rx:  0.10, ry:  0.15, rz: -0.70, opacity: 0.028 },
    ],
    pulseSpeed: 0.14, pulsePhase: 2.3,
  },
  // 연청 — 우상단, 비스듬한 형태
  {
    initPos: [18, 18, -70],
    r: 75, g: 145, b: 205,
    layers: [
      { w: 50, h: 30, rx:  0.00, ry:  0.00, rz:  1.00, opacity: 0.050 },
      { w: 44, h: 22, rx:  0.50, ry:  0.20, rz:  1.20, opacity: 0.038 },
      { w: 38, h: 38, rx: -0.30, ry: -0.30, rz:  0.70, opacity: 0.030 },
    ],
    pulseSpeed: 0.09, pulsePhase: 4.5,
  },
  // 연황록 — 좌하단, 작고 흩어진 형태
  {
    initPos: [-14, -18, -42],
    r: 100, g: 180, b: 140,
    layers: [
      { w: 36, h: 14, rx:  0.00, ry:  0.00, rz: -0.80, opacity: 0.045 },
      { w: 30, h: 20, rx:  0.60, ry:  0.10, rz: -0.40, opacity: 0.035 },
      { w: 26, h: 10, rx: -0.25, ry:  0.40, rz: -1.10, opacity: 0.028 },
    ],
    pulseSpeed: 0.17, pulsePhase: 1.1,
  },
]

function NebulaCloud({ initPos, r, g, b, layers, pulseSpeed, pulsePhase }: CloudDef) {
  const groupRef    = useRef<THREE.Group>(null)
  const matsRef     = useRef<THREE.MeshStandardMaterial[]>([])
  const texture     = useMemo(() => createWispTexture(r, g, b), [r, g, b])
  const emissiveCol = useMemo(() => new THREE.Color(r / 255, g / 255, b / 255), [r, g, b])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const d = Math.min(delta, 0.05)
    const t = state.clock.elapsedTime

    groupRef.current.position.x += STAR_VX * d * 60 * DRIFT
    groupRef.current.position.y += STAR_VY * d * 60 * DRIFT

    if (groupRef.current.position.x > BOUND) {
      groupRef.current.position.x = -BOUND
      groupRef.current.position.y = (Math.random() - 0.5) * 35
    }
    if (groupRef.current.position.y < -BOUND) {
      groupRef.current.position.y = BOUND
      groupRef.current.position.x = (Math.random() - 0.5) * 60
    }

    const pulse = Math.sin(t * pulseSpeed + pulsePhase) * 0.008
    matsRef.current.forEach((m, i) => {
      if (m) {
        m.opacity           = layers[i].opacity + pulse
        m.emissiveIntensity = 0.5 + Math.sin(t * pulseSpeed + pulsePhase) * 0.1
      }
    })
  })

  return (
    <group ref={groupRef} position={initPos}>
      {layers.map((l, i) => (
        <mesh key={i} rotation={[l.rx, l.ry, l.rz]}>
          <planeGeometry args={[l.w, l.h]} />
          <meshStandardMaterial
            ref={el => { if (el) matsRef.current[i] = el }}
            map={texture}
            emissiveMap={texture}
            emissive={emissiveCol}
            emissiveIntensity={0.5}
            transparent
            opacity={l.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

export default function Nebula() {
  return (
    <>
      {CLOUDS.map((c, i) => <NebulaCloud key={i} {...c} />)}
    </>
  )
}
