'use client'

import { useState } from 'react'
import { CODE_LENGTH } from '@/lib/auth/code'
import {
  useConfirmSessionSaved,
  useGenerateCode,
  useSignInWithCode,
} from '@/hooks/useCodeAuth'
import { toast } from '@/stores/toasts'
import { Button } from '@/components/ui/Button'

type Mode = 'choose' | 'generated' | 'enter'

/**
 * Full-screen entry gate shown whenever no session exists (AuthGate renders
 * this instead of the app). Not a <dialog> like ConfirmDialog/VictoryModal —
 * this fully replaces the shell rather than overlaying it, so it has no
 * backdrop/cancel affordance of its own.
 */
export function CodeAuthScreen() {
  const [mode, setMode] = useState<Mode>('choose')
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [enteredCode, setEnteredCode] = useState('')
  const [copied, setCopied] = useState(false)

  const generateCode = useGenerateCode()
  const signIn = useSignInWithCode()
  const confirmSaved = useConfirmSessionSaved()

  function handleGenerate() {
    generateCode.mutate(undefined, {
      onSuccess: (code) => {
        setGeneratedCode(code)
        setMode('generated')
      },
    })
  }

  async function handleCopy() {
    if (!generatedCode) return
    try {
      await navigator.clipboard.writeText(generatedCode)
      setCopied(true)
    } catch {
      toast.error('Could not copy. Select and copy the code manually.')
    }
  }

  function handleSignIn() {
    signIn.mutate(enteredCode)
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">
            Score Keeper
          </h1>
          <p className="mt-1 text-sm text-muted">
            Keep score for cards and domino matches between two teams.
          </p>
        </div>

        {mode === 'choose' && (
          <div className="space-y-3">
            <Button
              variant="primary"
              className="w-full"
              disabled={generateCode.isPending}
              onClick={handleGenerate}
            >
              Generate a code to start
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setMode('enter')}
            >
              Enter your code
            </Button>
          </div>
        )}

        {mode === 'generated' && generatedCode && (
          <div className="space-y-4 rounded-xl border border-border bg-surface p-5">
            <p className="numerals text-4xl font-bold tracking-[0.2em] text-fg">
              {generatedCode}
            </p>

            <Button variant="secondary" className="w-full" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy code'}
            </Button>

            <p className="text-sm text-danger">
              Write this down — it&rsquo;s the only way back into this
              account. There is no email recovery; if this code is lost, the
              data behind it cannot be reached again.
            </p>

            <Button
              variant="primary"
              className="w-full"
              disabled={!copied}
              onClick={confirmSaved}
            >
              I&rsquo;ve saved it
            </Button>
          </div>
        )}

        {mode === 'enter' && (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              handleSignIn()
            }}
          >
            <label className="block text-left">
              <span className="sr-only">Your code</span>
              <input
                autoFocus
                value={enteredCode}
                onChange={(event) =>
                  setEnteredCode(event.target.value.toUpperCase())
                }
                maxLength={CODE_LENGTH}
                placeholder="7F3K9Q"
                className="numerals w-full rounded-lg border border-border bg-bg px-3 py-3 text-center text-2xl tracking-[0.2em] text-fg focus:border-accent"
              />
            </label>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={signIn.isPending}
            >
              Sign in
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setMode('choose')}
            >
              Back
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
