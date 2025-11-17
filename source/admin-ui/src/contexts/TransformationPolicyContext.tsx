import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { TransformationPolicy, TransformationPolicyCreate, TransformationPolicyUpdate } from '@data-models';
import { TransformationPolicyService } from '../services/transformationPolicyService';

interface TransformationPolicyState {
  allPolicies: TransformationPolicy[];
  loading: boolean;
  error: string | null;
  selectedPolicies: TransformationPolicy[];
  hasNext: boolean;
  currentToken?: string;
}

interface TransformationPolicyContextType extends TransformationPolicyState {
  setSelectedPolicies: (policies: TransformationPolicy[]) => void;
  deletePolicy: (policyId: string) => Promise<{ success: boolean; error?: string }>;
  createPolicy: (policy: TransformationPolicyCreate) => Promise<{ success: boolean; data?: TransformationPolicy; error?: string }>;
  updatePolicy: (id: string, updates: TransformationPolicyUpdate) => Promise<{ success: boolean; data?: TransformationPolicy; error?: string }>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  fetchAllPolicies: () => Promise<void>;
}

type TransformationPolicyAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_POLICIES'; payload: { policies: TransformationPolicy[]; nextToken?: string; append?: boolean } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SELECTED_POLICIES'; payload: TransformationPolicy[] }
  | { type: 'DELETE_POLICY_SUCCESS'; payload: string }
  | { type: 'CREATE_POLICY_SUCCESS'; payload: TransformationPolicy }
  | { type: 'UPDATE_POLICY_SUCCESS'; payload: { id: string; policy: TransformationPolicy } }
  | { type: 'RESET_POLICIES' };

const policyReducer = (state: TransformationPolicyState, action: TransformationPolicyAction): TransformationPolicyState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { 
        ...state, 
        loading: action.payload,
        error: action.payload ? null : state.error
      };
    case 'SET_POLICIES':
      const newPolicies = action.payload.append 
        ? [...state.allPolicies, ...action.payload.policies]
        : action.payload.policies;
      return { 
        ...state, 
        allPolicies: newPolicies,
        loading: false,
        hasNext: !!action.payload.nextToken,
        currentToken: action.payload.nextToken
      };
    case 'SET_ERROR':
      return { ...state, loading: false, error: action.payload };
    case 'SET_SELECTED_POLICIES':
      return { ...state, selectedPolicies: action.payload };
    case 'DELETE_POLICY_SUCCESS':
      return {
        ...state,
        loading: false,
        allPolicies: state.allPolicies.filter(policy => policy.policyId !== action.payload),
        selectedPolicies: state.selectedPolicies.filter(policy => policy.policyId !== action.payload)
      };
    case 'CREATE_POLICY_SUCCESS':
      return { 
        ...state, 
        loading: false, 
        allPolicies: [...state.allPolicies, action.payload]
      };
    case 'UPDATE_POLICY_SUCCESS':
      return {
        ...state,
        loading: false,
        allPolicies: state.allPolicies.map(policy =>
          policy.policyId === action.payload.id ? action.payload.policy : policy
        )
      };
    case 'RESET_POLICIES':
      return {
        ...state,
        allPolicies: [],
        currentToken: undefined,
        hasNext: false
      };
    default:
      return state;
  }
};

const initialState: TransformationPolicyState = {
  allPolicies: [],
  loading: false,
  error: null,
  selectedPolicies: [],
  hasNext: false
};

const TransformationPolicyContext = createContext<TransformationPolicyContextType | undefined>(undefined);

interface TransformationPolicyProviderProps {
  children: ReactNode;
}

export const TransformationPolicyProvider: React.FC<TransformationPolicyProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(policyReducer, initialState);

  const fetchPolicies = async (nextToken?: string, append = false) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await TransformationPolicyService.list(nextToken);
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch policies');
      }
      
      dispatch({ 
        type: 'SET_POLICIES', 
        payload: { policies: result.data?.items || [], nextToken: result.data?.nextToken, append }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load policies';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const setSelectedPolicies = (policies: TransformationPolicy[]) => {
    dispatch({ type: 'SET_SELECTED_POLICIES', payload: policies });
  };

  const deletePolicy = async (policyId: string): Promise<{ success: boolean; error?: string }> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    const result = await TransformationPolicyService.delete(policyId);
    
    if (result.success) {
      dispatch({ type: 'DELETE_POLICY_SUCCESS', payload: policyId });
      return { success: true };
    } else {
      dispatch({ type: 'SET_ERROR', payload: result.error || 'Failed to delete policy' });
      return { success: false, error: result.error || 'Failed to delete policy' };
    }
  };

  const createPolicy = async (policy: TransformationPolicyCreate): Promise<{ success: boolean; data?: TransformationPolicy; error?: string }> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await TransformationPolicyService.create(policy);
      dispatch({ type: 'CREATE_POLICY_SUCCESS', payload: result.data });
      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create policy';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const updatePolicy = async (id: string, updates: TransformationPolicyUpdate): Promise<{ success: boolean; data?: TransformationPolicy; error?: string }> => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const result = await TransformationPolicyService.update(id, updates);
      dispatch({ type: 'UPDATE_POLICY_SUCCESS', payload: { id, policy: result.data } });
      return { success: true, data: result.data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update policy';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  };

  const loadMore = async () => {
    if (state.currentToken && !state.loading) {
      await fetchPolicies(state.currentToken, true);
    }
  };

  const fetchAllPolicies = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const allPolicies: TransformationPolicy[] = [];
      let nextToken: string | undefined;

      do {
        const result = await TransformationPolicyService.list(nextToken);
        if (!result.success || !result.data) {
          throw new Error(result.error || 'Failed to fetch policies');
        }

        allPolicies.push(...result.data.items);
        nextToken = result.data.nextToken;
      } while (nextToken);

      dispatch({ 
        type: 'SET_POLICIES', 
        payload: { policies: allPolicies, nextToken: undefined }
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load all policies';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  const refresh = async () => {
    dispatch({ type: 'RESET_POLICIES' });
    await fetchPolicies();
  };

  const contextValue = {
    ...state,
    setSelectedPolicies,
    deletePolicy,
    createPolicy,
    updatePolicy,
    loadMore,
    refresh,
    fetchAllPolicies
  };

  return (
    <TransformationPolicyContext.Provider value={contextValue}>
      {children}
    </TransformationPolicyContext.Provider>
  );
};

export const useTransformationPolicyContext = (): TransformationPolicyContextType => {
  const context = useContext(TransformationPolicyContext);
  if (!context) {
    throw new Error('useTransformationPolicyContext must be used within a TransformationPolicyProvider');
  }
  return context;
};