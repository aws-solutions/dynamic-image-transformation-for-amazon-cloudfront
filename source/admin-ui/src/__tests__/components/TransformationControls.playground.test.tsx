// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TransformationControls from '../../components/playground/TransformationControls';

describe('TransformationControls - query param generation', () => {
  it('should emit all transformation params when everything is set', async () => {
    const onQueryParamsChange = vi.fn();
    render(<TransformationControls onQueryParamsChange={onQueryParamsChange} />);

    fireEvent.change(screen.getAllByPlaceholderText('e.g. 400')[0], { target: { value: '800' } });
    fireEvent.change(screen.getAllByPlaceholderText('e.g. 300')[0], { target: { value: '600' } });
    fireEvent.change(screen.getByPlaceholderText('#FF0000'), { target: { value: '#00FF00' } });
    fireEvent.change(screen.getByPlaceholderText('0-360'), { target: { value: '90' } });
    fireEvent.change(screen.getByPlaceholderText('0.3-1000'), { target: { value: '5' } });
    fireEvent.click(screen.getByLabelText('Grayscale'));
    fireEvent.click(screen.getByLabelText('Normalize'));
    fireEvent.click(screen.getByLabelText('Flip (vertical)'));
    fireEvent.click(screen.getByLabelText('Flop (horizontal)'));
    fireEvent.click(screen.getByLabelText('Sharpen'));
    fireEvent.click(screen.getByLabelText('Strip EXIF metadata'));
    fireEvent.click(screen.getByLabelText('Strip ICC profile'));
    fireEvent.click(screen.getByLabelText('Animated (preserve GIF frames)'));

    await waitFor(() => {
      const lastCall = onQueryParamsChange.mock.calls.at(-1)?.[0];
      const keys = lastCall.map((p: any) => p.key);
      expect(keys).toEqual(expect.arrayContaining([
        'resize.width', 'resize.height', 'resize.fit',
        'tint', 'rotate', 'blur',
        'grayscale', 'normalize', 'flip', 'flop',
        'sharpen.sigma', 'stripExif', 'stripIcc', 'animated',
      ]));
      expect(lastCall.find((p: any) => p.key === 'resize.width').value).toBe('800');
      expect(lastCall.find((p: any) => p.key === 'resize.height').value).toBe('600');
      expect(lastCall.find((p: any) => p.key === 'rotate').value).toBe('90');
      expect(lastCall.find((p: any) => p.key === 'blur').value).toBe('5');
      expect(lastCall.find((p: any) => p.key === 'tint').value).toBe('#00FF00');
    });
  });

  it('should not emit quality param when at default value of 85', () => {
    const onQueryParamsChange = vi.fn();
    render(<TransformationControls onQueryParamsChange={onQueryParamsChange} />);

    expect(onQueryParamsChange).toHaveBeenCalled();
    const lastCall = onQueryParamsChange.mock.calls.at(-1)?.[0];
    const qualityParam = lastCall?.find((p: any) => p.key === 'quality');
    expect(qualityParam).toBeUndefined();
  });

  it('should not emit format param when set to auto', () => {
    const onQueryParamsChange = vi.fn();
    render(<TransformationControls onQueryParamsChange={onQueryParamsChange} />);

    expect(onQueryParamsChange).toHaveBeenCalled();
    const lastCall = onQueryParamsChange.mock.calls.at(-1)?.[0];
    const formatParam = lastCall?.find((p: any) => p.key === 'format');
    expect(formatParam).toBeUndefined();
  });

  it('should emit watermark as nested qs-style params when source and ratio are provided', async () => {
    const onQueryParamsChange = vi.fn();
    render(<TransformationControls onQueryParamsChange={onQueryParamsChange} />);

    fireEvent.change(screen.getByLabelText('Watermark Source URL'), { target: { value: 'https://example.com/logo.png' } });
    fireEvent.change(screen.getByLabelText('Width Ratio'), { target: { value: '0.3' } });

    await waitFor(() => {
      const lastCall = onQueryParamsChange.mock.calls.at(-1)?.[0];
      expect(lastCall.find((p: any) => p.key === 'watermark[0]').value).toBe('https://example.com/logo.png');
      expect(lastCall.find((p: any) => p.key === 'watermark[1][0]').value).toBe('0');
      expect(lastCall.find((p: any) => p.key === 'watermark[1][1]').value).toBe('0');
      expect(lastCall.find((p: any) => p.key === 'watermark[1][3]').value).toBe('0.3');
    });
  });

  it('should reset all params when resetTrigger changes', async () => {
    const onQueryParamsChange = vi.fn();
    const { rerender } = render(<TransformationControls onQueryParamsChange={onQueryParamsChange} resetTrigger={0} />);

    // Set a value
    const widthInputs = screen.getAllByPlaceholderText('e.g. 400');
    fireEvent.change(widthInputs[0], { target: { value: '400' } });

    // Trigger reset
    rerender(<TransformationControls onQueryParamsChange={onQueryParamsChange} resetTrigger={1} />);

    await waitFor(() => {
      const lastCall = onQueryParamsChange.mock.calls.at(-1)?.[0];
      expect(lastCall).toEqual([expect.objectContaining({ key: '', value: '' })]);
    });
  });

  it('should emit smartCrop=true when simple mode is selected', async () => {
    const onQueryParamsChange = vi.fn();
    render(<TransformationControls onQueryParamsChange={onQueryParamsChange} />);

    fireEvent.click(screen.getByLabelText('Simple (Face Detection)'));

    await waitFor(() => {
      const lastCall = onQueryParamsChange.mock.calls.at(-1)?.[0];
      expect(lastCall.find((p: any) => p.key === 'smartCrop').value).toBe('true');
    });
  });

  it('should emit smartCrop bracket-notation params in advanced mode', async () => {
    const onQueryParamsChange = vi.fn();
    render(<TransformationControls onQueryParamsChange={onQueryParamsChange} />);

    // Click the Smart Crop "Advanced" radio — it's the first one in DOM order
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const smartCropAdvanced = radios.find(r => r.value === 'advanced');
    fireEvent.click(smartCropAdvanced!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Car,Person')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Retain Text'));
    fireEvent.change(screen.getByPlaceholderText('Car,Person'), { target: { value: 'Car,Dog' } });

    await waitFor(() => {
      const lastCall = onQueryParamsChange.mock.calls.at(-1)?.[0];
      expect(lastCall.find((p: any) => p.key === 'smartCrop[retainText]').value).toBe('true');
      expect(lastCall.find((p: any) => p.key === 'smartCrop[labels][0]').value).toBe('Car');
      expect(lastCall.find((p: any) => p.key === 'smartCrop[labels][1]').value).toBe('Dog');
    });
  });

  it('should emit contentModeration=true when simple mode is selected', async () => {
    const onQueryParamsChange = vi.fn();
    render(<TransformationControls onQueryParamsChange={onQueryParamsChange} />);

    fireEvent.click(screen.getByLabelText('Simple (blur all inappropriate content)'));

    await waitFor(() => {
      const lastCall = onQueryParamsChange.mock.calls.at(-1)?.[0];
      expect(lastCall.find((p: any) => p.key === 'contentModeration').value).toBe('true');
    });
  });

  it('should emit contentModeration bracket-notation params in advanced mode', async () => {
    const onQueryParamsChange = vi.fn();
    render(<TransformationControls onQueryParamsChange={onQueryParamsChange} />);

    const advancedRadios = screen.getAllByLabelText('Advanced');
    fireEvent.click(advancedRadios[advancedRadios.length - 1]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('75')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('75'), { target: { value: '80' } });
    fireEvent.change(screen.getByPlaceholderText('50'), { target: { value: '100' } });
    fireEvent.change(screen.getByPlaceholderText('Label1, Label2'), { target: { value: 'Cat,Dog' } });

    await waitFor(() => {
      const lastCall = onQueryParamsChange.mock.calls.at(-1)?.[0];
      expect(lastCall.find((p: any) => p.key === 'contentModeration[minConfidence]').value).toBe('80');
      expect(lastCall.find((p: any) => p.key === 'contentModeration[blur]').value).toBe('100');
      expect(lastCall.find((p: any) => p.key === 'contentModeration[moderationLabels][0]').value).toBe('Cat');
      expect(lastCall.find((p: any) => p.key === 'contentModeration[moderationLabels][1]').value).toBe('Dog');
    });
  });
});
