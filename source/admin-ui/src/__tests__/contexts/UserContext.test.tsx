import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { UserProvider, useUser } from '../../contexts/UserContext';
import { getCurrentUser, fetchUserAttributes, signInWithRedirect } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { TEST_USER } from '../fixtures';

vi.mock('aws-amplify/auth');
vi.mock('aws-amplify/utils');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UserProvider>{children}</UserProvider>
);

describe('UserContext', () => {
  const mockUser = {
    username: TEST_USER.name.toLowerCase().replace(' ', ''),
    userId: TEST_USER.id,
  };

  const mockEmail = TEST_USER.email;

  beforeEach(() => {
    vi.clearAllMocks();
    delete (window as any).location;
    (window as any).location = { pathname: '/' };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct initial state', () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(fetchUserAttributes).mockResolvedValue({ email: mockEmail });

    const { result } = renderHook(() => useUser(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.email).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('should load user on mount', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(fetchUserAttributes).mockResolvedValue({ email: mockEmail });

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.email).toBe(mockEmail);
  });

  it('should redirect to sign in when user not authenticated', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new Error('Not authenticated'));
    vi.mocked(signInWithRedirect).mockResolvedValue(undefined as any);

    renderHook(() => useUser(), { wrapper });

    await waitFor(() => {
      expect(signInWithRedirect).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle Hub signInWithRedirect event', async () => {
    let hubListener: any;
    vi.mocked(Hub.listen).mockImplementation((channel, callback) => {
      hubListener = callback;
      return vi.fn();
    });

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(fetchUserAttributes).mockResolvedValue({ email: mockEmail });

    renderHook(() => useUser(), { wrapper });

    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(1));

    hubListener({ payload: { event: 'signInWithRedirect' } });

    await waitFor(() => expect(getCurrentUser).toHaveBeenCalledTimes(2));
  });

  it('should handle Hub signedOut event', async () => {
    let hubListener: any;
    vi.mocked(Hub.listen).mockImplementation((channel, callback) => {
      hubListener = callback;
      return vi.fn();
    });

    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(fetchUserAttributes).mockResolvedValue({ email: mockEmail });

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    hubListener({ payload: { event: 'signedOut' } });

    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.email).toBeNull();
    });
  });

  it('should handle fetchUserAttributes error gracefully', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    vi.mocked(fetchUserAttributes).mockRejectedValue(new Error('Fetch error'));

    const { result } = renderHook(() => useUser(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.email).toBeNull();
  });
});