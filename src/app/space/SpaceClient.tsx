'use client'

import dynamic from 'next/dynamic'

const SpaceScene = dynamic(() => import('@/components/three/SpaceScene'), { ssr: false })

export default function SpaceClient() {
  return <SpaceScene />
}
