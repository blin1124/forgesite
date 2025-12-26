'use client'
import { useEffect, useRef } from 'react'

export default function LivePreview({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(()=>{
    if (!ref.current) return
    const doc = ref.current.contentDocument
    if (!doc) return
    doc.open(); doc.write(html); doc.close()
  }, [html])
  return <iframe ref={ref} title="preview" sandbox="allow-same-origin allow-forms allow-scripts" className="w-full h-[70vh] rounded-xl bg-white" />
}
