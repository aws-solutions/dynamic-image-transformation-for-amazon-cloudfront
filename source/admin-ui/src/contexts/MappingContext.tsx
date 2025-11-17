import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Mapping, MappingCreate, MappingUpdate } from '@data-models';
import { MappingService } from '../services/mappingService';

interface MappingState {
  allMappings: Mapping[];
  loading: boolean;
  error: string | null;
  selectedMappings: Mapping[];
  hasNext: boolean;
  currentToken?: string;
}

interface MappingContextType extends MappingState {
  setSelectedMappings: (mappings: Mapping[]) => void;
  deleteMapping: (mappingId: string) => Promise<{ success: boolean; error?: string }>;
  createMapping: (mapping: MappingCreate) => Promise<{ success: boolean; data?: Mapping; error?: string }>;
  updateMapping: (id: string, updates: MappingUpdate) => Promise<{ success: boolean; data?: Mapping; error?: string }>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

type MappingAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_MAPPINGS'; payload: { mappings: Mapping[]; nextToken?: string; append?: boolean } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SELECTED_MAPPINGS'; payload: Mapping[] }
  | { type: 'DELETE_MAPPING_SUCCESS'; payload: string }
  | { type: 'CREATE_MAPPING_SUCCESS'; payload: Mapping }
  | { type: 'UPDATE_MAPPING_SUCCESS'; payload: { id: string; mapping: Mapping } }
  | { type: 'RESET_MAPPINGS' };

const mappingReducer = (state: MappingState, action: MappingAction): MappingState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { 
        ...state, 
        loading: action.payload,
        error: action.payload ? null : state.error
      };
    case 'SET_MAPPINGS':
      const newMappings = action.payload.append 
        ? [...state.allMappings, ...action.payload.mappings]
        : action.payload.mappings;
      return { 
        ...state, 
        allMappings: newMappings,
        loading: false,
        hasNext: !!action.payload.nextToken,
        currentToken: action.payload.nextToken
      };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_SELECTED_MAPPINGS':
      return { ...state, selectedMappings: action.payload };
    case 'DELETE_MAPPING_SUCCESS':
      return {
        ...state,
        loading: false,
        allMappings: state.allMappings.filter(mapping => mapping.mappingId !== action.payload),
        selectedMappings: state.selectedMappings.filter(mapping => mapping.mappingId !== action.payload)
      };
    case 'CREATE_MAPPING_SUCCESS':
      return { 
        ...state, 
        loading: false, 
        allMappings: [...state.allMappings, action.payload]
      };
    case 'UPDATE_MAPPING_SUCCESS':
      return {
        ...state,
        loading: false,
        allMappings: state.allMappings.map(mapping =>
          mapping.mappingId === action.payload.id ? action.payload.mapping : mapping
        )
      };
    case 'RESET_MAPPINGS':
      return {
        ...state,
        allMappings: [],
        currentToken: undefined,
        hasNext: false
      };
    default:
      return state;
  }
};

const initialState: MappingState = {
  allMappings: [],
  loading: false,
  error: null,
  selectedMappings: [],
  hasNext: false
};

const MappingContext = createContext<MappingContextType | undefined>(undefined);

export const MappingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(mappingReducer, initialState);

  const fetchMappings = async (nextToken?: string, append = false) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await MappingService.getMappings({ nextToken });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch mappings');
      }
      
      dispatch({ 
        type: 'SET_MAPPINGS', 
        payload: { mappings: result.data?.mappings || [], nextToken: result.data?.nextToken, append }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load mappings';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const setSelectedMappings = (mappings: Mapping[]) => {
    dispatch({ type: 'SET_SELECTED_MAPPINGS', payload: mappings });
  };

  const deleteMapping = async (mappingId: string): Promise<{ success: boolean; error?: string }> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await MappingService.deleteMapping(mappingId);
      dispatch({ type: 'DELETE_MAPPING_SUCCESS', payload: mappingId });
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete mapping';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const createMapping = async (mapping: MappingCreate): Promise<{ success: boolean; data?: Mapping; error?: string }> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await MappingService.createMapping(mapping);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create mapping');
      }
      
      dispatch({ type: 'CREATE_MAPPING_SUCCESS', payload: result.data });
      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create mapping';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const updateMapping = async (id: string, updates: MappingUpdate): Promise<{ success: boolean; data?: Mapping; error?: string }> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await MappingService.updateMapping(id, updates);
      dispatch({ type: 'UPDATE_MAPPING_SUCCESS', payload: { id, mapping: result.data } });
      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update mapping';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const loadMore = async () => {
    if (state.currentToken && !state.loading) {
      await fetchMappings(state.currentToken, true);
    }
  };

  const refresh = async () => {
    dispatch({ type: 'RESET_MAPPINGS' });
    await fetchMappings();
  };

  const contextValue = {
    ...state,
    setSelectedMappings,
    deleteMapping,
    createMapping,
    updateMapping,
    loadMore,
    refresh
  };

  return (
    <MappingContext.Provider value={contextValue}>
      {children}
    </MappingContext.Provider>
  );
};

export const useMappingContext = (): MappingContextType => {
  const context = useContext(MappingContext);
  if (!context) {
    throw new Error('useMappingContext must be used within a MappingProvider');
  }
  return context;
};
