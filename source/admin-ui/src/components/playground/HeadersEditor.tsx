// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { SpaceBetween, Input, Button, FormField, Grid, Box } from '@cloudscape-design/components';
import { PlaygroundHeader } from '../../types/playground';

interface HeadersEditorProps {
  headers: PlaygroundHeader[];
  onChange: (headers: PlaygroundHeader[]) => void;
}

const HeadersEditor: React.FC<HeadersEditorProps> = ({ headers, onChange }) => {
  const updateHeader = (id: string, field: 'key' | 'value', value: string) => {
    onChange(headers.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  };

  const addHeader = () => {
    onChange([...headers, { id: crypto.randomUUID(), key: '', value: '' }]);
  };

  const removeHeader = (id: string) => {
    if (headers.length > 1) onChange(headers.filter((h) => h.id !== id));
  };

  return (
    <SpaceBetween size="xs">
      {headers.map((header, index) => (
        <Grid key={header.id} gridDefinition={[{ colspan: 5 }, { colspan: 6 }, { colspan: 1 }]}>
          <FormField label={index === 0 ? 'Header Name' : ''}>
            <Input value={header.key} onChange={({ detail }) => updateHeader(header.id, 'key', detail.value)}
              placeholder="" />
          </FormField>
          <FormField label={index === 0 ? 'Header Value' : ''}>
            <Input value={header.value} onChange={({ detail }) => updateHeader(header.id, 'value', detail.value)}
              placeholder="" />
          </FormField>
          <Box textAlign="center" padding={{ top: index === 0 ? 'xl' : 'xs' }}>
            <Button iconName="remove" variant="icon" onClick={() => removeHeader(header.id)}
              disabled={headers.length === 1} ariaLabel={`Remove header ${index + 1}`} />
          </Box>
        </Grid>
      ))}
      <Button iconName="add-plus" onClick={addHeader}>Add Header</Button>
    </SpaceBetween>
  );
};

export default HeadersEditor;
