import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../frontend/src/App';
import * as api from '../../frontend/src/api';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('local usage dashboard UI contract (FR-020–FR-023, AIAC12–AIAC13)', () => {
  it('offers a collapsible privacy-safe usage section even without an active game', async () => {
    vi.spyOn(api, 'loadGame').mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByRole('button', { name: /AI upotreba/i })).toHaveAttribute('aria-expanded', 'false');
    expect(document.body).not.toHaveTextContent(/prompt|api.?key|raw response|stack trace/i);
  });

  it('requires an explicit confirmed reset action', async () => {
    vi.spyOn(api, 'loadGame').mockResolvedValue(null);
    render(<App />);
    const open = await screen.findByRole('button', { name: /AI upotreba/i });
    open.click();
    expect(screen.getByRole('button', { name: /resetuj metrike/i })).toBeVisible();
  });
});
