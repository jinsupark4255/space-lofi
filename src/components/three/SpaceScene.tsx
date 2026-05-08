'use client'

import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import Starfield from './Starfield'
import Rocket from './Rocket'
import Nebula from './Nebula'
import Planets from './Planets'

export default function SpaceScene() {
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 70, near: 0.1, far: 500 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={['#00000a']} />
        <fog attach="fog" args={['#00000a', 80, 200]} />

        <ambientLight intensity={0.1} />
        {/* 우측 상단 키 라이트 — 로켓 측면에 그림자/하이라이트 */}
        <directionalLight position={[4, 6, 3]} intensity={2.5} color="#ffffff" />
        {/* 좌측 림 라이트 — 엣지 강조 */}
        <directionalLight position={[-4, 2, -2]} intensity={0.6} color="#aabbff" />
        {/* 우주 환경광 */}
        <pointLight position={[0, 10, -10]} intensity={0.4} color="#334488" />

        <Nebula />
        <Starfield />
        <Planets />
        <Rocket />

        <EffectComposer>
          <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} intensity={0.6} />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
