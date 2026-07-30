// app/error.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ErrorPage from './error'

const captureExceptionMock = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: any[]) => captureExceptionMock(...args) }))

afterEach(() => {
  cleanup()
  captureExceptionMock.mockClear()
})

describe('app/error.tsx', () => {
  it('reporta o erro pro Sentry e mostra a mensagem amigável', () => {
    const error = new Error('boom')
    render(<ErrorPage error={error} reset={() => {}} />)
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
  })

  it('botão "Tentar de novo" chama reset', () => {
    const reset = vi.fn()
    render(<ErrorPage error={new Error('boom')} reset={reset} />)
    screen.getByText('Tentar de novo').click()
    expect(reset).toHaveBeenCalledTimes(1)
  })
})
