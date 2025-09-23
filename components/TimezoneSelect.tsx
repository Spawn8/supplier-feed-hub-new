'use client'

import { useEffect, useState, useTransition } from 'react'
import Button from '@/components/ui/Button'

export default function TimezoneSelect({ initialTz }: { initialTz: string }) {
  const [tz, setTz] = useState<string>(initialTz)
  const [options, setOptions] = useState<string[]>([])
  const [isPending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const [nowStr, setNowStr] = useState<string>('')

  useEffect(() => {
    try {
      const supported = (Intl as any).supportedValuesOf
        ? (Intl as any).supportedValuesOf('timeZone')
        : []
      if (Array.isArray(supported) && supported.length) {
        setOptions(supported)
      } else {
        setOptions(['UTC','Europe/Athens','America/New_York','Europe/London','Asia/Tokyo'])
      }
    } catch {
      setOptions(['UTC','Europe/Athens','America/New_York','Europe/London','Asia/Tokyo'])
    }
  }, [])

  // Live clock: YYYY-MM-DD HH:mm:ss in selected timezone
  useEffect(() => {
    const formatNow = (zone: string) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: zone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date()).replace(',', '') // -> "YYYY-MM-DD HH:mm:ss"

    setNowStr(formatNow(tz))
    const id = setInterval(() => setNowStr(formatNow(tz)), 1000)
    return () => clearInterval(id)
  }, [tz])

  async function save() {
    setMsg(null)
    start(async () => {
      const res = await fetch('/api/account/timezone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: tz }),
      })
      if (!res.ok) {
        const j = await res.json().catch(()=>({}))
        setMsg(j?.error || 'Failed to save')
      } else {
        setMsg('Saved')
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="label">Local timezone</label>
        <select className="input" value={tz} onChange={(e)=>setTz(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {/* Live current time in the selected timezone */}
      <div className="rounded border px-3 py-2 text-sm">
        <div className="text-gray-600">Current time in <span className="font-mono">{tz}</span>:</div>
        <div className="font-mono text-base">{nowStr}</div>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" onClick={save} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </div>
  )
}
