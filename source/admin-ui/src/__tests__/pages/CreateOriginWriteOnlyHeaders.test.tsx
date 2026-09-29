// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// originHeaders values are write-only: the API returns redacted placeholders, never the real
// credentials. The edit form therefore must not submit what it was hydrated with, or renaming an
// origin would overwrite its stored upstream credential. These tests pin the submit payload.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test-utils';
import { CreateOrigin } from '../../pages/CreateOrigin';
import { OriginService } from '../../services/originService';

const ORIGIN_ID = '550e8400-e29b-41d4-a716-446655440001';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: '550e8400-e29b-41d4-a716-446655440001' }),
  };
});

describe('CreateOrigin — originHeaders are write-only', () => {
  let updateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // The API redacts values but still returns header names.
    vi.spyOn(OriginService, 'getOrigin').mockResolvedValue({
      success: true,
      data: {
        originId: ORIGIN_ID,
        originName: 'existing-origin',
        originDomain: 'images.example.com',
        originPath: '/api/v1',
        originHeaders: { 'X-API-Key': '***REDACTED***' },
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-20T14:30:00Z',
      },
    } as any);

    updateSpy = vi
      .spyOn(OriginService, 'updateOrigin')
      .mockResolvedValue({ success: true, data: {} } as any);
  });

  const waitForForm = async () =>
    waitFor(() => expect(screen.getByDisplayValue('existing-origin')).toBeInTheDocument());

  it('does not pre-fill the redacted placeholder into the value input', async () => {
    render(<CreateOrigin />);
    await waitForForm();

    // The header name is hydrated so the operator can see which headers exist...
    expect(screen.getByDisplayValue('X-API-Key')).toBeInTheDocument();
    // ...but the placeholder must never land in an input, where it could be submitted back.
    expect(screen.queryByDisplayValue('***REDACTED***')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Unchanged')).toBeInTheDocument();
  });

  // The regression that matters: a name-only edit must omit originHeaders so the API's merge patch
  // leaves the stored credential untouched.
  it('omits originHeaders when the operator only edits the name', async () => {
    const user = userEvent.setup();
    render(<CreateOrigin />);
    await waitForForm();

    const nameInput = screen.getByDisplayValue('existing-origin');
    await user.clear(nameInput);
    await user.type(nameInput, 'renamed-origin');
    await user.click(screen.getByRole('button', { name: /save changes|update origin/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());

    const [, payload] = updateSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.originName).toBe('renamed-origin');
    expect(payload.originHeaders).toBeUndefined();
    // Belt and braces: the placeholder must not reach the wire in any form.
    expect(JSON.stringify(payload)).not.toContain('REDACTED');
  });

  it('sends the new value when the operator edits a header value', async () => {
    const user = userEvent.setup();
    render(<CreateOrigin />);
    await waitForForm();

    const valueInput = screen.getByPlaceholderText('Unchanged');
    await user.type(valueInput, 'rotated-key');
    await user.click(screen.getByRole('button', { name: /save changes|update origin/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());

    const [, payload] = updateSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.originHeaders).toEqual({ 'X-API-Key': 'rotated-key' });
  });

  it('sends null when the operator removes every header', async () => {
    const user = userEvent.setup();
    render(<CreateOrigin />);
    await waitForForm();

    await user.click(screen.getByRole('button', { name: 'Remove' }));
    await user.click(screen.getByRole('button', { name: /save changes|update origin/i }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalled());

    const [, payload] = updateSpy.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.originHeaders).toBeNull();
  });
});
