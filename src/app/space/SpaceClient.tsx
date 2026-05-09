'use client'

import dynamic from 'next/dynamic'
import PlayerLoader from '@/components/player/PlayerLoader'

const SpaceScene = dynamic(() => import('@/components/three/SpaceScene'), { ssr: false })

export default function SpaceClient() {
  return (
    <>
      <SpaceScene />
      <PlayerLoader />
    </>
  )
}
