import React from 'react';
import { Flashbar, FlashbarProps } from '@cloudscape-design/components';
import { useApp } from '../../contexts/AppContext';

export const NotificationBar: React.FC = () => {
  const { notifications, removeNotification } = useApp();

  const flashbarItems: FlashbarProps.MessageDefinition[] = notifications.map(notification => ({
    id: notification.id,
    type: notification.type,
    content: notification.message,
    dismissible: true
  }));

  if (flashbarItems.length === 0) {
    return null;
  }

  return <Flashbar items={flashbarItems} onDismiss={({ detail }) => removeNotification(detail.id)} />;
};
