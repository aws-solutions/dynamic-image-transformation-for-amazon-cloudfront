// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState, useRef } from 'react';
import { FlashbarProps } from '@cloudscape-design/components';

export const useFlashMessages = () => {
  const [messages, setMessages] = useState<FlashbarProps.MessageDefinition[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addMessage = (message: Omit<FlashbarProps.MessageDefinition, 'id'>) => {
    const id = Date.now().toString();
    const messageWithId = { 
      ...message, 
      id,
      dismissible: message.dismissible !== false
    };
    setMessages(prev => [...prev, messageWithId]);
    
    const timeout = setTimeout(() => {
      setMessages(prev => prev.filter(m => m.id !== id));
      timeoutsRef.current.delete(id);
    }, 5000);
    
    timeoutsRef.current.set(id, timeout);
  };

  const dismissMessage = (id: string) => {
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const clearMessages = () => {
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();
    setMessages([]);
  };

  return { messages, addMessage, dismissMessage, clearMessages };
};