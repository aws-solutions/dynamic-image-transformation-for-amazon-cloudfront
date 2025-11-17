import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MappingProvider, useMappingContext } from '../../contexts/MappingContext';
import { MappingService } from '../../services/mappingService';
import { MOCK_MAPPINGS, MOCK_API_RESPONSES } from '../fixtures';

// Mock the MappingService
vi.mock('../../services/mappingService');

const mockMappingService = vi.mocked(MappingService);

// Test component to access context
const TestComponent = () => {
  const {
    allMappings,
    selectedMappings,
    loading,
    error,
    refresh,
    createMapping,
    updateMapping,
    deleteMapping,
    setSelectedMappings
  } = useMappingContext();

  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="error">{error || 'no-error'}</div>
      <div data-testid="mappings-count">{allMappings?.length || 0}</div>
      <div data-testid="selected-count">{selectedMappings?.length || 0}</div>
      <button onClick={() => refresh()} data-testid="refresh-btn">Refresh</button>
      <button onClick={() => createMapping({ name: 'Test', originId: '1' })} data-testid="create-btn">Create</button>
      <button onClick={() => updateMapping('1', { name: 'Updated' })} data-testid="update-btn">Update</button>
      <button onClick={() => deleteMapping('1')} data-testid="delete-btn">Delete</button>
      <button onClick={() => setSelectedMappings([{ mappingId: '1', name: 'Test', originId: '1', createdAt: '2023-01-01' }])} data-testid="select-btn">Select</button>
    </div>
  );
};

describe('MappingContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should provide initial state', async () => {
    mockMappingService.getMappings.mockResolvedValueOnce(MOCK_API_RESPONSES.mappings.empty);

    render(
      <MappingProvider>
        <TestComponent />
      </MappingProvider>
    );

    // Wait for initial fetch to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    expect(screen.getByTestId('mappings-count')).toHaveTextContent('0');
    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
  });

  it('should fetch mappings successfully', async () => {
    mockMappingService.getMappings.mockResolvedValueOnce(MOCK_API_RESPONSES.mappings.empty);
    mockMappingService.getMappings.mockResolvedValueOnce(MOCK_API_RESPONSES.mappings.success);

    render(
      <MappingProvider>
        <TestComponent />
      </MappingProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: /refresh/i }).click();
    });

    expect(screen.getByTestId('mappings-count')).toHaveTextContent('2');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(mockMappingService.getMappings).toHaveBeenCalledTimes(2);
  });

  it('should handle fetch error', async () => {
    mockMappingService.getMappings.mockResolvedValueOnce(MOCK_API_RESPONSES.mappings.empty);
    mockMappingService.getMappings.mockRejectedValueOnce(MOCK_API_RESPONSES.mappings.error);

    render(
      <MappingProvider>
        <TestComponent />
      </MappingProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: /refresh/i }).click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Failed to fetch mappings');
    expect(screen.getByTestId('mappings-count')).toHaveTextContent('0');
  });

  it('should create mapping successfully', async () => {
    // Mock initial fetch on mount
    mockMappingService.getMappings.mockResolvedValueOnce({
      success: true,
      data: { mappings: [] }
    });

    const newMapping = { mappingId: '3', name: 'Test', originId: '1', createdAt: '2023-01-03' };

    mockMappingService.createMapping.mockResolvedValueOnce({
      success: true,
      data: newMapping
    });

    render(
      <MappingProvider>
        <TestComponent />
      </MappingProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: /create/i }).click();
    });

    expect(mockMappingService.createMapping).toHaveBeenCalledWith({ name: 'Test', originId: '1' });
  });

  it('should handle create error', async () => {
    // Mock initial fetch on mount
    mockMappingService.getMappings.mockResolvedValueOnce({
      success: true,
      data: { mappings: [] }
    });

    mockMappingService.createMapping.mockRejectedValueOnce(new Error('Failed to create mapping'));

    render(
      <MappingProvider>
        <TestComponent />
      </MappingProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: /create/i }).click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Failed to create mapping');
  });

  it('should update mapping successfully', async () => {
    // Mock initial fetch on mount
    mockMappingService.getMappings.mockResolvedValueOnce({
      success: true,
      data: { mappings: [] }
    });

    const updatedMapping = { mappingId: '1', name: 'Updated', originId: '1', createdAt: '2023-01-01' };

    mockMappingService.updateMapping.mockResolvedValueOnce({
      success: true,
      data: updatedMapping
    });

    render(
      <MappingProvider>
        <TestComponent />
      </MappingProvider>
    );

    await act(async () => {
      screen.getByTestId('update-btn').click();
    });

    expect(mockMappingService.updateMapping).toHaveBeenCalledWith('1', { name: 'Updated' });
  });

  it('should delete mapping successfully', async () => {
    // Mock initial fetch on mount
    mockMappingService.getMappings.mockResolvedValueOnce({
      success: true,
      data: { mappings: [] }
    });

    mockMappingService.deleteMapping.mockResolvedValueOnce({
      success: true
    });

    render(
      <MappingProvider>
        <TestComponent />
      </MappingProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: /delete/i }).click();
    });

    expect(mockMappingService.deleteMapping).toHaveBeenCalledWith('1');
  });

  it('should handle delete error', async () => {
    // Mock initial fetch on mount
    mockMappingService.getMappings.mockResolvedValueOnce({
      success: true,
      data: { mappings: [] }
    });

    mockMappingService.deleteMapping.mockRejectedValueOnce(new Error('Failed to delete mapping'));

    render(
      <MappingProvider>
        <TestComponent />
      </MappingProvider>
    );

    await act(async () => {
      screen.getByRole('button', { name: /delete/i }).click();
    });

    expect(screen.getByTestId('error')).toHaveTextContent('Failed to delete mapping');
  });

  it('should update selected mappings', async () => {
    // Mock initial fetch on mount
    mockMappingService.getMappings.mockResolvedValueOnce({
      success: true,
      data: { mappings: [] }
    });

    render(
      <MappingProvider>
        <TestComponent />
      </MappingProvider>
    );

    await act(async () => {
      screen.getByTestId('select-btn').click();
    });

    expect(screen.getByTestId('selected-count')).toHaveTextContent('1');
  });
});
