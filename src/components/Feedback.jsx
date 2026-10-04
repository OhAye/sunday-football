import { useCallback, useMemo, useRef, useState } from 'react'
import { FeedbackContext } from './feedback-context'
import Sheet from './Sheet'
import { CheckIcon, CloseIcon } from './icons'

const TOAST_MS = 2800

// App-wide toasts and confirm dialogs (replaces window.alert / window.confirm).
export default function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null) // { title, body, confirmLabel, danger, resolve }
  const nextId = useRef(1)

  const toast = useCallback((message, tone = 'ok') => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_MS)
  }, [])

  const confirm = useCallback(
    (options) => new Promise((resolve) => setDialog({ ...options, resolve })),
    [],
  )

  function settle(answer) {
    dialog?.resolve(answer)
    setDialog(null)
  }
  const cancel = () => settle(false)

  const api = useMemo(() => ({ toast, confirm }), [toast, confirm])

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      {/* Toasts sit above the bottom nav */}
      <div
        className="pointer-events-none fixed inset-x-0 z-[120] flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 104px)' }}
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rise flex max-w-sm items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_12px_30px_rgba(0,0,0,0.6)] ${
              t.tone === 'error'
                ? 'border-red/40 bg-red-dim text-red-bright'
                : 'border-green/40 bg-green-deep text-ink'
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                t.tone === 'error' ? 'bg-red text-white' : 'bg-green text-white'
              }`}
            >
              {t.tone === 'error'
                ? <CloseIcon className="w-3 h-3" strokeWidth={3} />
                : <CheckIcon className="w-3 h-3" strokeWidth={3} />}
            </span>
            {t.message}
          </div>
        ))}
      </div>

      {dialog && (
        <Sheet
          title={dialog.title}
          onClose={cancel}
          footer={
            <div className="flex gap-3">
              <button type="button" className="btn btn-quiet flex-1" onClick={cancel}>
                {dialog.cancelLabel ?? 'Cancel'}
              </button>
              <button
                type="button"
                className={`btn flex-1 ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => settle(true)}
              >
                {dialog.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          }
        >
          {dialog.body && <p className="text-sm leading-relaxed text-mist">{dialog.body}</p>}
        </Sheet>
      )}
    </FeedbackContext.Provider>
  )
}
