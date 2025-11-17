import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Origin, OriginCreate, OriginUpdate } from '@data-models';
import { OriginService } from '../services/originService';

interface OriginState {
  allOrigins: Origin[];
  loading: boolean;
  error: string | null;
  selectedOrigins: Origin[];
  hasNext: boolean;
  currentToken?: string;
}

interface OriginContextType extends OriginState {
  setSelectedOrigins: (origins: Origin[]) => void;
  deleteOrigin: (originId: string) => Promise<{ success: boolean; error?: string }>;
  createOrigin: (origin: OriginCreate) => Promise<{ success: boolean; data?: Origin; error?: string }>;
  updateOrigin: (id: string, updates: OriginUpdate) => Promise<{ success: boolean; data?: Origin; error?: string }>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  fetchAllOrigins: () => Promise<void>;
}

type OriginAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ORIGINS'; payload: { origins: Origin[]; nextToken?: string; append?: boolean } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SELECTED_ORIGINS'; payload: Origin[] }
  | { type: 'DELETE_ORIGIN_SUCCESS'; payload: string }
  | { type: 'CREATE_ORIGIN_SUCCESS'; payload: Origin }
  | { type: 'UPDATE_ORIGIN_SUCCESS'; payload: { id: string; origin: Origin } }
  | { type: 'RESET_ORIGINS' };

const originReducer = (state: OriginState, action: OriginAction): OriginState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { 
        ...state, 
        loading: action.payload,
        error: action.payload ? null : state.error
      };
    case 'SET_ORIGINS':
      const newOrigins = action.payload.append 
        ? [...state.allOrigins, ...action.payload.origins]
        : action.payload.origins;
      return { 
        ...state, 
        allOrigins: newOrigins,
        loading: false,
        hasNext: !!action.payload.nextToken,
        currentToken: action.payload.nextToken
      };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_SELECTED_ORIGINS':
      return { ...state, selectedOrigins: action.payload };
    case 'DELETE_ORIGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        allOrigins: state.allOrigins.filter(origin => origin.originId !== action.payload),
        selectedOrigins: state.selectedOrigins.filter(origin => origin.originId !== action.payload)
      };
    case 'CREATE_ORIGIN_SUCCESS':
      return { 
        ...state, 
        loading: false, 
        allOrigins: [...state.allOrigins, action.payload]
      };
    case 'UPDATE_ORIGIN_SUCCESS':
      return {
        ...state,
        loading: false,
        allOrigins: state.allOrigins.map(origin =>
          origin.originId === action.payload.id ? action.payload.origin : origin
        )
      };
    case 'RESET_ORIGINS':
      return {
        ...state,
        allOrigins: [],
        currentToken: undefined,
        hasNext: false
      };
    default:
      return state;
  }
};

const initialState: OriginState = {
  allOrigins: [],
  loading: false,
  error: null,
  selectedOrigins: [],
  hasNext: false
};

const OriginContext = createContext<OriginContextType | undefined>(undefined);

export const OriginProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(originReducer, initialState);

  const fetchOrigins = async (nextToken?: string, append = false) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await OriginService.getOrigins({ nextToken });
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch origins');
      }
      
      dispatch({ 
        type: 'SET_ORIGINS', 
        payload: { origins: result.data?.origins || [], nextToken: result.data?.nextToken, append }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load origins';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  const fetchAllOrigins = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await OriginService.getAllOrigins();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to fetch all origins');
      }
      dispatch({ 
        type: 'SET_ORIGINS', 
        payload: { origins: result.data, nextToken: undefined }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load all origins';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  useEffect(() => {
    fetchOrigins();
  }, []);

  const setSelectedOrigins = (origins: Origin[]) => {
    dispatch({ type: 'SET_SELECTED_ORIGINS', payload: origins });
  };

  const deleteOrigin = async (originId: string): Promise<{ success: boolean; error?: string }> => {
  dispatch({ type: 'SET_LOADING', payload: true });
  
  const result = await OriginService.deleteOrigin(originId);
  
  if (result.success) {
    dispatch({ type: 'DELETE_ORIGIN_SUCCESS', payload: originId });
    return { success: true };
  } else {
    dispatch({ type: 'SET_ERROR', payload: result.error || 'Failed to delete origin' });
    return { success: false, error: result.error || 'Failed to delete origin' };
  }
  };

  const createOrigin = async (origin: OriginCreate): Promise<{ success: boolean; data?: Origin; error?: string }> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await OriginService.createOrigin(origin);
      dispatch({ type: 'CREATE_ORIGIN_SUCCESS', payload: result.data });
      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create origin';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const updateOrigin = async (id: string, updates: OriginUpdate): Promise<{ success: boolean; data?: Origin; error?: string }> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await OriginService.updateOrigin(id, updates);
      dispatch({ type: 'UPDATE_ORIGIN_SUCCESS', payload: { id, origin: result.data } });
      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update origin';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const loadMore = async () => {
    if (state.currentToken && !state.loading) {
      await fetchOrigins(state.currentToken, true);
    }
  };

  const refresh = async () => {
    dispatch({ type: 'RESET_ORIGINS' });
    await fetchOrigins();
  };

  const contextValue = {
    ...state,
    setSelectedOrigins,
    deleteOrigin,
    createOrigin,
    updateOrigin,
    loadMore,
    refresh,
    fetchAllOrigins
  };

  return (
    <OriginContext.Provider value={contextValue}>
      {children}
    </OriginContext.Provider>
  );
};

export const useOriginContext = (): OriginContextType => {
  const context = useContext(OriginContext);
  if (!context) {
    throw new Error('useOriginContext must be used within an OriginProvider');
  }
  return context;
};
