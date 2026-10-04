import { createContext, useContext } from 'react'

export const FeedbackContext = createContext(null)

// { toast(message, tone?), confirm({ title, body, confirmLabel, danger }) → Promise<boolean> }
export function useFeedback() {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider')
  return ctx
}
