// app/painel/error.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import PainelError from './error'

const captureExceptionMock = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: any[]) => captureExceptionMock(...args) }))

afterEach(() => {
  cleanup()
  captureExceptionMock.mockClear()
})

describe('app/painel/error.tsx', () => {
  it('reporta o erro pro Sentry e mostra mensagem pro time da farmácia', () => {
    const error = new Error('boom')
    render(<PainelError error={error} reset={() => {}} />)
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
    expect(screen.getByText('Algo deu errado no painel')).toBeInTheDocument()
  })
})
