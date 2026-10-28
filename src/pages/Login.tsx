import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { apiFetch } from '@/services/api'

function PasswordField({ label, id, value, onChange, autoComplete, minLength, invalid = false }: {
  label: string; id: string; value: string; onChange: (value: string) => void
  autoComplete: string; minLength: number; invalid?: boolean
}) {
  const [visible, setVisible] = useState(false)
  const toggleLabel = `${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`
  return <div>
    <label htmlFor={id} className="block text-sm text-text-secondary">{label}</label>
    <div className="relative mt-1">
      <input id={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required minLength={minLength} maxLength={72}
        value={value} onChange={e => onChange(e.target.value)} aria-invalid={invalid || undefined} aria-describedby={invalid ? 'confirm-password-error' : undefined}
        className="min-h-11 w-full rounded border border-border-subtle bg-bg-elevated p-2 pr-12 text-text-primary" />
      <button type="button" aria-label={toggleLabel} title={toggleLabel} aria-pressed={visible} onClick={() => setVisible(!visible)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded text-text-muted hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-primary">
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path strokeLinecap="round" d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  </div>
}

export default function LoginPage() {
  const { user, login } = useAuthStore()
  const location = useLocation()
  const [register, setRegister] = useState(false)
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState(''), [attempted, setAttempted] = useState(false)
  const [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const mismatch = register && (confirmation.length > 0 || attempted) && password !== confirmation
  const from = location.state?.from as string | undefined
  if (user) return <Navigate to={from?.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/dashboard'} replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    if (register && password !== confirmation) { setAttempted(true); return }
    setBusy(true)
    try {
      if (register) {
        await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) })
        setRegister(false); setPassword(''); setConfirmation(''); setAttempted(false); setMessage('Account created. Sign in to continue.')
      } else { await login(email, password); setPassword('') }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to sign in') }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen flex items-center justify-center bg-bg-base p-5">
    <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border-subtle bg-bg-surface p-7 shadow-panel space-y-4">
      <div><p className="text-xs font-semibold tracking-widest text-accent-primary">SMART PORT DIGITAL TWIN</p>
        <h1 className="mt-3 text-xl font-semibold text-text-primary">{register ? 'Create account' : 'Sign in'}</h1>
        <p className="mt-1 text-xs text-text-muted">JNPA reference port · Operational workspace</p></div>
      <label className="block text-sm text-text-secondary">Email<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded border border-border-subtle bg-bg-elevated p-2 text-text-primary" /></label>
      <PasswordField key={register ? 'register-password' : 'login-password'} label="Password" id="password" value={password} onChange={setPassword} autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 8 : 1} />
      {register && <>
        <PasswordField label="Confirm Password" id="confirm-password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" minLength={8} invalid={mismatch} />
        {mismatch && <p id="confirm-password-error" role="alert" className="text-xs text-red-600">Passwords do not match.</p>}
        <p className="text-xs text-text-muted">Use a unique passphrase of 8–72 characters, at most 72 UTF-8 bytes.</p>
      </>}
      {message && <p role="status" className="text-sm text-text-secondary">{message}</p>}
      <button disabled={busy} className="w-full rounded bg-accent-primary p-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      <button type="button" disabled={busy} onClick={() => { setRegister(!register); setMessage(''); setPassword(''); setConfirmation(''); setAttempted(false) }} className="w-full text-xs text-accent-primary">{register ? 'Already registered? Sign in' : 'Create an account'}</button>
    </form>
  </main>
}
