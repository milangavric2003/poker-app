import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../frontend/src/App';
import { GameViewSchema, type GameView } from '../../shared/contracts';
import { publicView } from '../helpers/public-fixtures';
import * as api from '../../frontend/src/api';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('AI status UI seam (FR-015)', () => {
  it('shows AI-off status and an explicit AI mode control', async () => {
    const game = { ...GameViewSchema.parse(publicView()), ai: {
      mode: 'off', availability: 'unavailable', active: null, lastBotOutcome: null,
      analysis: { status: 'idle', interactionId: null, result: null },
    } } as unknown as GameView;
    vi.spyOn(api, 'loadGame').mockResolvedValue(game);
    render(<App />);
    expect(await screen.findByText(/AI režim je isključen/i)).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /AI režim/i })).not.toBeChecked();
  });

  it('announces waiting without exposing provider internals and disables human actions', async () => {
    const game = { ...GameViewSchema.parse(publicView()), ai: {
      mode: 'on', availability: 'configured',
      active: { interactionId: '33333333-3333-4333-8333-333333333333', purpose: 'bot',
        status: 'waiting', attemptCount: 0, model: 'gemini-primary' },
      lastBotOutcome: null, analysis: { status: 'idle', interactionId: null, result: null },
    } } as unknown as GameView;
    vi.spyOn(api, 'loadGame').mockResolvedValue(game);
    render(<App />);
    expect(await screen.findByRole('status')).toHaveTextContent(/čeka.*AI/i);
    expect(screen.getByRole('button', { name: 'Fold' })).toBeDisabled();
    expect(document.body).not.toHaveTextContent('gemini-primary');
  });
});
