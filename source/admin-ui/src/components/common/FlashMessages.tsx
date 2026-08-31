import React from 'react';
import { Flashbar, FlashbarProps } from '@cloudscape-design/components';

interface FlashMessagesProps {
  messages: FlashbarProps.MessageDefinition[];
  onDismiss: (id: string) => void;
}

export const FlashMessages: React.FC<FlashMessagesProps> = ({ messages, onDismiss }) => {
  if (messages.length === 0) return null;

  return (
    <Flashbar
      items={messages.map((msg) => ({
        ...msg,
        onDismiss: () => {
          if (msg.id) onDismiss(msg.id);
        },
      }))}
    />
  );
};
