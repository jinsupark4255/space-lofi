import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { track_id, duration_seconds } = await req.json()
  if (!track_id || !duration_seconds || duration_seconds < 1) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // listen_log 기록
  const { error: logError } = await supabase
    .from('listen_logs')
    .insert({ user_id: user.id, track_id, duration_seconds })

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  // 누적 청취 시간 업데이트
  const { error: profileError } = await supabase.rpc('increment_listen_seconds', {
    p_user_id: user.id,
    p_seconds: duration_seconds,
  })

  if (profileError) console.error('profile update failed:', profileError.message)

  return NextResponse.json({ ok: true })
}
