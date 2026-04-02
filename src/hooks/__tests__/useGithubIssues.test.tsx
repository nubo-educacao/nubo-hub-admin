import { renderHook, waitFor } from '@testing-library/react';
import { useGetIssues, useCreateIssue } from '../useGithubIssues';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { vi, describe, it, expect } from 'vitest';

const queryClient = new QueryClient();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

// Mock do supabase global
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('useGithubIssues hooks', () => {
  it('should call github-proxy to fetch issues', async () => {
    (supabase.functions.invoke as any).mockResolvedValue({
      data: [{ id: 1, title: 'Bug test' }],
      error: null,
    });

    const { result } = renderHook(() => useGetIssues(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(supabase.functions.invoke).toHaveBeenCalledWith('github-proxy', {
      method: 'GET',
    });
    expect(result.current.data).toEqual([{ id: 1, title: 'Bug test' }]);
  });

  it('should call github-proxy to create an issue', async () => {
    (supabase.functions.invoke as any).mockResolvedValue({
      data: { id: 2, title: 'New Bug' },
      error: null,
    });

    const { result } = renderHook(() => useCreateIssue(), { wrapper });

    result.current.mutate({
      application: 'nubo-hub-admin',
      version: 'Nubo Hub',
      title: 'New Bug',
      type: 'bug',
      body: 'Testing',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(supabase.functions.invoke).toHaveBeenCalledWith('github-proxy', {
      method: 'POST',
      body: {
        application: 'nubo-hub-admin',
        version: 'Nubo Hub',
        title: 'New Bug',
        type: 'bug',
        body: 'Testing',
      },
    });
  });
});
