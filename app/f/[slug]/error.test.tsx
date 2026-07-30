// app/f/[slug]/error.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import ErrorPage from './error'

const captureExceptionMock = vi.fn()
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: any[]) => captureExceptionMock(...args) }))

afterEach(() => {
  cleanup()
  captureExceptionMock.mockClear()
})

describe('app/f/[slug]/error.tsx', () => {
  it('reporta o erro pro Sentry e mostra mensagem pro cliente final', () => {
    const error = new Error('boom')
    render(<ErrorPage error={error} reset={() => {}} />)
    expect(captureExceptionMock).toHaveBeenCalledWith(error)
    expect(screen.getByText(/Não foi você/)).toBeInTheDocument()
  })
})
