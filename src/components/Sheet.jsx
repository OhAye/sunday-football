import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CloseIcon } from './icons'

// Bottom sheet modal. Rendered in a portal so animated/transformed ancestors can't trap it.
export default function Sheet({ title, kicker, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="sheet-up w-full max-w-lg max-h-[92dvh] flex flex-col rounded-t-[28px] bg-surface border border-b-0 border-line shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="shrink-0 px-5 pt-3 pb-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {kicker && <p className="eyebrow mb-1">{kicker}</p>}
              <h2 className="display text-2xl text-ink truncate">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 -mr-1 flex h-9 w-9 items-center justify-center rounded-full bg-raised text-muted"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-line px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
            {footer}
          </div>
        )}
        {!footer && <div className="pb-safe" />}
      </div>
    </div>,
    document.body,
  )
}
