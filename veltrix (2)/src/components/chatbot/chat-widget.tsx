'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Sparkles, Loader2, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

interface ChatWidgetProps {
  /** Live dashboard context passed into every /api/chat call so the assistant
   *  can answer based on what the user is actually seeing. */
  context: {
    tenantCode?: string
    region?: string
    collectorConnected?: boolean
    healthStatus?: string
    healthScore?: number
    integrity?: string
    totalPackets?: number
    openAnomalies?: number
  }
}

const QUICK_PROMPTS = [
  'What does boundary integrity mean?',
  'Why is my collector reconnecting?',
  'How do I remediate an anomaly?',
  'What stays in Tier 1?',
]

const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    "Hi — I'm the observability assistant. I can help you read the dashboard, diagnose issues, and decide what to do next. What are you seeing?",
  ts: Date.now(),
}

export function ChatWidget({ context }: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when messages change.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, open])

  // Focus input when opened.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    } else {
      // Mark read when closed.
      setUnread(false)
    }
  }, [open])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const userMsg: ChatMessage = { role: 'user', content: trimmed, ts: Date.now() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setSending(true)

    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          context,
        }),
      })
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}))
        throw new Error(errBody?.error || `HTTP ${r.status}`)
      }
      const data = (await r.json()) as { reply?: string; error?: string }
      const reply: ChatMessage = {
        role: 'assistant',
        content: data.reply ?? 'Sorry, I could not generate a response.',
        ts: Date.now(),
      }
      setMessages(prev => [...prev, reply])
      if (!open) setUnread(true)
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `The assistant backend is unavailable right now (${err?.message ?? 'unknown error'}). You can still navigate the dashboard — try the section links in the top nav.`,
          ts: Date.now(),
        },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
        className={cn(
          'fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all sm:bottom-6 sm:right-6',
          open
            ? 'rotate-90 bg-foreground text-background'
            : 'bg-primary text-primary-foreground hover:scale-105',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && unread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Observability assistant"
          className="fixed bottom-20 right-5 z-50 flex h-[min(560px,75vh)] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:right-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-gradient-to-br from-primary/10 to-transparent px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">Assistant</div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  Reduces problems
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3"
          >
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Assistant is thinking…</span>
              </div>
            )}

            {/* Quick prompts on first turn */}
            {messages.length === 1 && !sending && (
              <div className="space-y-1.5 pt-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Try
                </div>
                {QUICK_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="block w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-accent/30"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={e => {
              e.preventDefault()
              send(input)
            }}
            className="flex items-center gap-2 border-t border-border bg-background p-2.5"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about a metric or problem…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Send"
              className={cn(
                'grid h-8 w-8 place-items-center rounded-md transition-colors',
                input.trim() && !sending
                  ? 'bg-primary text-primary-foreground hover:opacity-90'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md bg-background text-foreground shadow-sm ring-1 ring-border/60',
        )}
      >
        {isUser ? msg.content : renderInlineMarkdown(msg.content)}
      </div>
    </div>
  )
}

/**
 * Minimal inline markdown renderer for assistant replies.
 * Supports **bold**, *italic*, `code`. Everything else is plain text.
 * Keeps the widget small — no full markdown lib needed.
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  // Split on **bold**, *italic*, `code` in a single pass.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <span key={i}>{part}</span>
  })
}
