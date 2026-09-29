// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React, { useState, useEffect, useRef } from 'react';
import {
  SpaceBetween, ExpandableSection, FormField, Input, Select, Checkbox, ColumnLayout, RadioGroup, SegmentedControl, Popover, Link, Box
} from '@cloudscape-design/components';
import { PlaygroundQueryParam } from '../../types/playground';
import { validateTransformationValue } from '../../utils/transformationValidation';

// Validates a numeric input against the existing schema — allows empty (not set)
const isValidInput = (type: string, value: string, parseAs?: (v: string) => any): boolean => {
  if (value === '') return true;
  const parsed = parseAs ? parseAs(value) : Number(value);
  return validateTransformationValue(type, parsed).success;
};

interface TransformationControlsProps {
  onQueryParamsChange: (params: PlaygroundQueryParam[]) => void;
  resetTrigger?: number;
}

const TransformationControls: React.FC<TransformationControlsProps> = ({ onQueryParamsChange, resetTrigger }) => {
  const onChangeRef = useRef(onQueryParamsChange);
  useEffect(() => { onChangeRef.current = onQueryParamsChange; });

  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [fit, setFit] = useState('cover');
  const [format, setFormat] = useState('');
  const [quality, setQuality] = useState('');
  const [grayscale, setGrayscale] = useState(false);
  const [normalize, setNormalize] = useState(false);
  const [tint, setTint] = useState('');
  const [flip, setFlip] = useState(false);
  const [flop, setFlop] = useState(false);
  const [rotate, setRotate] = useState('');
  const [sharpen, setSharpen] = useState(false);
  const [stripExif, setStripExif] = useState(false);
  const [stripIcc, setStripIcc] = useState(false);
  const [blur, setBlur] = useState('');
  const [extractTop, setExtractTop] = useState('');
  const [extractLeft, setExtractLeft] = useState('');
  const [extractWidth, setExtractWidth] = useState('');
  const [extractHeight, setExtractHeight] = useState('');
  const [flatten, setFlatten] = useState('');
  const [animated, setAnimated] = useState(false);
  const [watermarkSource, setWatermarkSource] = useState('');
  const [watermarkXOffset, setWatermarkXOffset] = useState('');
  const [watermarkYOffset, setWatermarkYOffset] = useState('');
  const [watermarkWidthRatio, setWatermarkWidthRatio] = useState('');
  const [watermarkHeightRatio, setWatermarkHeightRatio] = useState('');
  const [watermarkOpacity, setWatermarkOpacity] = useState('');
  const [convolveKernel, setConvolveKernel] = useState('');
  const [smartCropMode, setSmartCropMode] = useState('');
  const [smartCropFaceIndex, setSmartCropFaceIndex] = useState('');
  const [smartCropPadding, setSmartCropPadding] = useState('');
  const [smartCropFaces, setSmartCropFaces] = useState(false);
  const [smartCropLabels, setSmartCropLabels] = useState('');
  const [smartCropAspectRatio, setSmartCropAspectRatio] = useState('');
  const [smartCropGravity, setSmartCropGravity] = useState('');
  const [smartCropFallback, setSmartCropFallback] = useState('');
  const [smartCropMinConfidence, setSmartCropMinConfidence] = useState('');
  const [smartCropPriority, setSmartCropPriority] = useState('aspectRatio');
  const [smartCropRetainText, setSmartCropRetainText] = useState(false);
  const [smartCropRetainLogo, setSmartCropRetainLogo] = useState(false);
  const [smartCropCustomModelArn, setSmartCropCustomModelArn] = useState('');
  const [contentModerationMode, setContentModerationMode] = useState('');
  const [contentModerationMinConfidence, setContentModerationMinConfidence] = useState('');
  const [contentModerationBlur, setContentModerationBlur] = useState('');
  const [contentModerationLabels, setContentModerationLabels] = useState('');

  useEffect(() => {
    if (!resetTrigger) return;
    setWidth(''); setHeight(''); setFit('cover');
    setFormat(''); setQuality('');
    setGrayscale(false); setNormalize(false); setTint('');
    setFlip(false); setFlop(false); setRotate('');
    setSharpen(false); setStripExif(false); setStripIcc(false); setBlur('');
    setExtractTop(''); setExtractLeft(''); setExtractWidth(''); setExtractHeight('');
    setFlatten(''); setAnimated(false); setWatermarkSource('');
    setWatermarkXOffset(''); setWatermarkYOffset(''); setWatermarkWidthRatio('');
    setWatermarkHeightRatio(''); setWatermarkOpacity(''); setConvolveKernel('');
    setSmartCropMode(''); setSmartCropFaceIndex(''); setSmartCropPadding('');
    setSmartCropFaces(false); setSmartCropLabels(''); setSmartCropAspectRatio('');
    setSmartCropGravity(''); setSmartCropFallback(''); setSmartCropMinConfidence(''); setSmartCropPriority('aspectRatio');
    setSmartCropRetainText(false); setSmartCropRetainLogo(false);
    setSmartCropCustomModelArn('');
    setContentModerationMode(''); setContentModerationMinConfidence(''); setContentModerationBlur(''); setContentModerationLabels('');
  }, [resetTrigger]);

  useEffect(() => {
    const params: PlaygroundQueryParam[] = [];
    const add = (key: string, value: string) => params.push({ id: key, key, value });

    if (width) add('resize.width', width);
    if (height) add('resize.height', height);
    if (width || height) add('resize.fit', fit);
    if (format) add('format', format);
    if (quality) add('quality', quality);
    if (grayscale) add('grayscale', 'true');
    if (normalize) add('normalize', 'true');
    if (tint) add('tint', tint);
    if (flip) add('flip', 'true');
    if (flop) add('flop', 'true');
    if (rotate) add('rotate', rotate);
    if (sharpen) add('sharpen.sigma', '1');
    if (stripExif) add('stripExif', 'true');
    if (stripIcc) add('stripIcc', 'true');
    if (blur) add('blur', blur);
    if (extractTop && extractLeft && extractWidth && extractHeight) {
      add('extract', `${extractLeft},${extractTop},${Number(extractLeft) + Number(extractWidth)},${Number(extractTop) + Number(extractHeight)}`);
    }
    if (flatten) add('flatten', flatten);
    if (animated) add('animated', 'true');
    if (watermarkSource && (watermarkWidthRatio || watermarkHeightRatio)) {
      const xOff = watermarkXOffset.includes('p') ? watermarkXOffset : (watermarkXOffset || '0');
      const yOff = watermarkYOffset.includes('p') ? watermarkYOffset : (watermarkYOffset || '0');
      const alpha = watermarkOpacity || '';
      const wRatio = watermarkWidthRatio || '';
      const hRatio = watermarkHeightRatio || '';
      add('watermark[0]', watermarkSource);
      add('watermark[1][0]', xOff);
      add('watermark[1][1]', yOff);
      if (alpha) add('watermark[1][2]', alpha);
      if (wRatio) add('watermark[1][3]', wRatio);
      if (hRatio) add('watermark[1][4]', hRatio);
    }
    if (convolveKernel) {
      const kernelArray = convolveKernel.split(',').map(Number);
      const convolveValue = { width: 3, height: 3, kernel: kernelArray };
      if (validateTransformationValue('convolve', convolveValue).success) {
        add('convolve.width', '3');
        add('convolve.height', '3');
        add('convolve.kernel', convolveKernel);
      }
    }
    if (smartCropMode === 'simple') {
      add('smartCrop', 'true');
    } else if (smartCropMode === 'advanced') {
      const hasDetection = smartCropFaces || smartCropFaceIndex || smartCropLabels || smartCropRetainText || smartCropRetainLogo || smartCropCustomModelArn;
      if (hasDetection) {
        const candidate: Record<string, unknown> = {};
        if (smartCropFaces) candidate.faces = true;
        if (smartCropFaceIndex) candidate.faceIndex = Number(smartCropFaceIndex);
        if (smartCropLabels) candidate.labels = smartCropLabels.split(',').map(l => l.trim()).filter(Boolean);
        if (smartCropCustomModelArn) candidate.customModelArn = smartCropCustomModelArn;
        if (smartCropRetainText) candidate.retainText = true;
        if (smartCropRetainLogo) candidate.retainLogo = true;
        if (smartCropAspectRatio) candidate.aspectRatio = smartCropAspectRatio;
        if (smartCropPadding) candidate.padding = /^\d+$/.test(smartCropPadding) ? Number(smartCropPadding) : smartCropPadding;
        if (smartCropGravity) candidate.gravity = smartCropGravity;
        if (smartCropFallback) candidate.fallback = smartCropFallback;
        if (smartCropMinConfidence) candidate.minConfidence = Number(smartCropMinConfidence);
        if (smartCropAspectRatio || smartCropPadding) {
          candidate.priorities = smartCropPriority === 'padding' ? ['padding', 'aspectRatio'] : ['aspectRatio', 'padding'];
        }

        if (validateTransformationValue('smartCrop', candidate).success) {
          if (smartCropFaces) add('smartCrop[faces]', 'true');
          if (smartCropFaceIndex) add('smartCrop[faceIndex]', smartCropFaceIndex);
          if (smartCropLabels) {
            smartCropLabels.split(',').map(l => l.trim()).filter(Boolean).forEach((label, i) => {
              add(`smartCrop[labels][${i}]`, label);
            });
          }
          if (smartCropCustomModelArn) add('smartCrop[customModelArn]', smartCropCustomModelArn);
          if (smartCropAspectRatio) add('smartCrop[aspectRatio]', smartCropAspectRatio);
          if (smartCropPadding) add('smartCrop[padding]', smartCropPadding);
          if (smartCropGravity) add('smartCrop[gravity]', smartCropGravity);
          if (smartCropFallback) add('smartCrop[fallback]', smartCropFallback);
          if (smartCropMinConfidence) add('smartCrop[minConfidence]', smartCropMinConfidence);
          if (smartCropAspectRatio || smartCropPadding) {
            if (smartCropPriority === 'padding') {
              add('smartCrop[priorities][0]', 'padding');
              add('smartCrop[priorities][1]', 'aspectRatio');
            } else {
              add('smartCrop[priorities][0]', 'aspectRatio');
              add('smartCrop[priorities][1]', 'padding');
            }
          }
          if (smartCropRetainText) add('smartCrop[retainText]', 'true');
          if (smartCropRetainLogo) add('smartCrop[retainLogo]', 'true');
        }
      }
    }
    if (contentModerationMode === 'simple') {
      add('contentModeration', 'true');
    } else if (contentModerationMode === 'advanced') {
      const candidate: Record<string, unknown> = {};
      if (contentModerationMinConfidence) candidate.minConfidence = Number(contentModerationMinConfidence);
      if (contentModerationBlur) candidate.blur = Number(contentModerationBlur);
      if (contentModerationLabels) candidate.moderationLabels = contentModerationLabels.split(',').map(l => l.trim()).filter(Boolean);
      if (Object.keys(candidate).length > 0 && validateTransformationValue('contentModeration', candidate).success) {
        if (contentModerationMinConfidence) add('contentModeration[minConfidence]', contentModerationMinConfidence);
        if (contentModerationBlur) add('contentModeration[blur]', contentModerationBlur);
        if (contentModerationLabels) {
          contentModerationLabels.split(',').map(l => l.trim()).filter(Boolean).forEach((label, i) => {
            add(`contentModeration[moderationLabels][${i}]`, label);
          });
        }
      }
    }

    onChangeRef.current(params.length > 0 ? params : [{ id: crypto.randomUUID(), key: '', value: '' }]);
  }, [width, height, fit, quality, format, grayscale, normalize, tint, flip, flop, rotate, sharpen, stripExif, stripIcc, blur,
      extractTop, extractLeft, extractWidth, extractHeight, flatten, animated, watermarkSource, watermarkXOffset, watermarkYOffset,
      watermarkWidthRatio, watermarkHeightRatio, watermarkOpacity, convolveKernel,
      smartCropMode, smartCropFaceIndex, smartCropPadding, smartCropFaces, smartCropLabels,
      smartCropAspectRatio, smartCropGravity, smartCropFallback, smartCropMinConfidence, smartCropPriority, smartCropRetainText, smartCropRetainLogo, smartCropCustomModelArn,
      contentModerationMode, contentModerationMinConfidence, contentModerationBlur, contentModerationLabels]);

  return (
    <SpaceBetween size="l">
      <ExpandableSection headerText="Resize">
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <FormField label="Width (px)">
              <Input value={width} onChange={({ detail }) => {
                if (isValidInput('resize', detail.value, (v) => ({ width: Number(v) }))) setWidth(detail.value);
              }} type="number" placeholder="e.g. 400" />
            </FormField>
            <FormField label="Height (px)">
              <Input value={height} onChange={({ detail }) => {
                if (isValidInput('resize', detail.value, (v) => ({ height: Number(v) }))) setHeight(detail.value);
              }} type="number" placeholder="e.g. 300" />
            </FormField>
          </ColumnLayout>
          <FormField label="Fit Mode">
            <Select selectedOption={{ label: fit.charAt(0).toUpperCase() + fit.slice(1), value: fit }}
              onChange={({ detail }) => setFit(detail.selectedOption.value!)}
              options={[
                { label: 'Cover', value: 'cover' }, { label: 'Contain', value: 'contain' },
                { label: 'Fill', value: 'fill' }, { label: 'Inside', value: 'inside' },
                { label: 'Outside', value: 'outside' },
              ]} />
          </FormField>
        </SpaceBetween>
      </ExpandableSection>

      <ExpandableSection headerText="Color & Filters">
        <SpaceBetween size="m">
          <Checkbox checked={grayscale} onChange={({ detail }) => setGrayscale(detail.checked)}>Grayscale</Checkbox>
          <Checkbox checked={normalize} onChange={({ detail }) => setNormalize(detail.checked)}>Normalize</Checkbox>
          <FormField label="Tint Color">
            <Input value={tint} onChange={({ detail }) => setTint(detail.value)} placeholder="#FF0000" />
          </FormField>
        </SpaceBetween>
      </ExpandableSection>

      <ExpandableSection headerText="Operations">
        <SpaceBetween size="m">
          <Checkbox checked={flip} onChange={({ detail }) => setFlip(detail.checked)}>Flip (vertical)</Checkbox>
          <Checkbox checked={flop} onChange={({ detail }) => setFlop(detail.checked)}>Flop (horizontal)</Checkbox>
          <FormField label="Rotation (degrees)">
            <Input value={rotate} onChange={({ detail }) => setRotate(detail.value)} type="number" placeholder="0-360" />
          </FormField>
        </SpaceBetween>
      </ExpandableSection>

      <ExpandableSection headerText="Format & Quality">
        <SpaceBetween size="m">
          <FormField label="Output Format" description="Leave unset to let the policy decide based on browser support">
            <Select selectedOption={format ? { label: format.toUpperCase(), value: format } : { label: 'Not set', value: '' }}
              onChange={({ detail }) => setFormat(detail.selectedOption.value!)}
              options={[
                { label: 'Not set', value: '' }, { label: 'JPEG', value: 'jpeg' },
                { label: 'PNG', value: 'png' }, { label: 'WebP', value: 'webp' },
                { label: 'AVIF', value: 'avif' },
              ]} />
          </FormField>
          <FormField label="Quality" description="Leave empty to let the policy decide based on DPR">
            <Input value={quality} onChange={({ detail }) => {
              if (isValidInput('quality', detail.value)) setQuality(detail.value);
            }} type="number" placeholder="1-100" />
          </FormField>
        </SpaceBetween>
      </ExpandableSection>

      <ExpandableSection headerText="Advanced">
        <SpaceBetween size="m">
          <Checkbox checked={sharpen} onChange={({ detail }) => setSharpen(detail.checked)}>Sharpen</Checkbox>
          <Checkbox checked={stripExif} onChange={({ detail }) => setStripExif(detail.checked)}>Strip EXIF metadata</Checkbox>
          <Checkbox checked={stripIcc} onChange={({ detail }) => setStripIcc(detail.checked)}>Strip ICC profile</Checkbox>
          <Checkbox checked={animated} onChange={({ detail }) => setAnimated(detail.checked)}>Animated (preserve GIF frames)</Checkbox>
          <FormField label="Blur (sigma)">
            <Input value={blur} onChange={({ detail }) => {
              if (isValidInput('blur', detail.value)) setBlur(detail.value);
            }} type="number" placeholder="0.3-1000" />
          </FormField>
          <FormField label="Flatten (background color)">
            <Input value={flatten} onChange={({ detail }) => setFlatten(detail.value)} placeholder="#FFFFFF or white" />
          </FormField>
        </SpaceBetween>
      </ExpandableSection>

      <ExpandableSection headerText="Extract Region">
        <SpaceBetween size="m">
          <ColumnLayout columns={2}>
            <FormField label="Top (px)">
              <Input value={extractTop} onChange={({ detail }) => {
                if (isValidInput('extract', detail.value, (v) => [Number(v), 0, 0, 0])) setExtractTop(detail.value);
              }} type="number" placeholder="0" />
            </FormField>
            <FormField label="Left (px)">
              <Input value={extractLeft} onChange={({ detail }) => {
                if (isValidInput('extract', detail.value, (v) => [0, Number(v), 0, 0])) setExtractLeft(detail.value);
              }} type="number" placeholder="0" />
            </FormField>
            <FormField label="Width (px)">
              <Input value={extractWidth} onChange={({ detail }) => {
                if (isValidInput('extract', detail.value, (v) => [0, 0, Number(v), 0])) setExtractWidth(detail.value);
              }} type="number" placeholder="100" />
            </FormField>
            <FormField label="Height (px)">
              <Input value={extractHeight} onChange={({ detail }) => {
                if (isValidInput('extract', detail.value, (v) => [0, 0, 0, Number(v)])) setExtractHeight(detail.value);
              }} type="number" placeholder="100" />
            </FormField>
          </ColumnLayout>
        </SpaceBetween>
      </ExpandableSection>

      <ExpandableSection headerText="Smart Crop">
        <SpaceBetween size="m">
          <FormField label="Mode">
            <RadioGroup value={smartCropMode} onChange={({ detail }) => setSmartCropMode(detail.value)}
              items={[{ value: 'simple', label: 'Simple (Face Detection)' }, { value: 'advanced', label: 'Advanced' }]} />
          </FormField>
          {smartCropMode === 'advanced' && (
            <SpaceBetween size="s">
              <Checkbox checked={smartCropRetainText} onChange={({ detail }) => setSmartCropRetainText(detail.checked)}>Retain Text</Checkbox>
              <Checkbox checked={smartCropRetainLogo} onChange={({ detail }) => setSmartCropRetainLogo(detail.checked)}>Retain Logo</Checkbox>
              <Checkbox checked={smartCropFaces} onChange={({ detail }) => {
                setSmartCropFaces(detail.checked);
                if (!detail.checked) setSmartCropFaceIndex('');
              }}>Detect Faces</Checkbox>
              {smartCropFaces && (
                <FormField label="Face Index" description="Index of a specific face (0-15)">
                  <Input value={smartCropFaceIndex} onChange={({ detail }) => setSmartCropFaceIndex(detail.value)} type="number" placeholder="0" />
                </FormField>
              )}
              <FormField label="Labels" description="Comma-separated Rekognition labels (e.g. Car,Person)">
                <Input value={smartCropLabels} onChange={({ detail }) => setSmartCropLabels(detail.value)} placeholder="Car,Person" />
              </FormField>
              <FormField label="Custom Model ARN" description="ARN of a custom Rekognition model">
                <Input value={smartCropCustomModelArn} onChange={({ detail }) => setSmartCropCustomModelArn(detail.value)} placeholder="arn:aws:rekognition:..." />
              </FormField>
              <FormField label="Aspect Ratio" description="Target crop ratio (e.g. 16:9)">
                <Input value={smartCropAspectRatio} onChange={({ detail }) => setSmartCropAspectRatio(detail.value)} placeholder="16:9" />
              </FormField>
              <FormField label="Padding" description="e.g. 10, 10%, 50px">
                <Input value={smartCropPadding} onChange={({ detail }) => setSmartCropPadding(detail.value)} placeholder="10" />
              </FormField>
              <FormField label="Gravity">
                <Select selectedOption={smartCropGravity ? { label: smartCropGravity, value: smartCropGravity } : null}
                  onChange={({ detail }) => setSmartCropGravity(detail.selectedOption.value === 'none' ? '' : detail.selectedOption.value!)}
                  placeholder="center"
                  options={[
                    { label: '— None (use default)', value: 'none' },
                    { label: 'top-left', value: 'top-left' }, { label: 'top-center', value: 'top-center' }, { label: 'top-right', value: 'top-right' },
                    { label: 'center-left', value: 'center-left' }, { label: 'center', value: 'center' }, { label: 'center-right', value: 'center-right' },
                    { label: 'bottom-left', value: 'bottom-left' }, { label: 'bottom-center', value: 'bottom-center' }, { label: 'bottom-right', value: 'bottom-right' },
                  ]} />
              </FormField>
              <FormField label="Fallback" description="Behavior when detection fails">
                <Select selectedOption={smartCropFallback ? { label: smartCropFallback, value: smartCropFallback } : null}
                  onChange={({ detail }) => setSmartCropFallback(detail.selectedOption.value === 'none' ? '' : detail.selectedOption.value!)}
                  placeholder="cover"
                  options={[
                    { label: '— None (use default)', value: 'none' },
                    { label: 'cover', value: 'cover' }, { label: 'contain', value: 'contain' },
                    { label: 'fill', value: 'fill' }, { label: 'inside', value: 'inside' },
                    { label: 'outside', value: 'outside' }, { label: 'no-crop', value: 'no-crop' },
                  ]} />
              </FormField>
              <FormField label="Priority">
                <SegmentedControl
                  selectedId={smartCropPriority}
                  onChange={({ detail }) => setSmartCropPriority(detail.selectedId)}
                  options={[{ id: 'aspectRatio', text: 'Aspect Ratio' }, { id: 'padding', text: 'Padding' }]}
                />
              </FormField>
              <FormField label="Min Confidence" description="Minimum detection confidence (0-100)">
                <Input value={smartCropMinConfidence} onChange={({ detail }) => setSmartCropMinConfidence(detail.value)} type="number" placeholder="80" />
              </FormField>
            </SpaceBetween>
          )}
        </SpaceBetween>
      </ExpandableSection>

      <ExpandableSection headerText="Content Moderation">
        <SpaceBetween size="m">
          <FormField label="Mode">
            <RadioGroup value={contentModerationMode} onChange={({ detail }) => setContentModerationMode(detail.value)}
              items={[{ value: 'simple', label: 'Simple (blur all inappropriate content)' }, { value: 'advanced', label: 'Advanced' }]} />
          </FormField>
          {contentModerationMode === 'advanced' && (
            <SpaceBetween size="s">
              <FormField label="Min Confidence" description="Minimum detection confidence (0-100)">
                <Input value={contentModerationMinConfidence} onChange={({ detail }) => setContentModerationMinConfidence(detail.value)} type="number" placeholder="75" />
              </FormField>
              <FormField label="Blur Amount" description="Blur sigma (0.3-1000)">
                <Input value={contentModerationBlur} onChange={({ detail }) => setContentModerationBlur(detail.value)} type="number" placeholder="50" />
              </FormField>
              <FormField label="Moderation Labels" description="Comma-separated labels (e.g. Label1,Label2)" info={
                <Popover content={
                  <Box>
                    Labels must match exactly what AWS Rekognition returns for your image. To find the correct labels:
                    (1) Upload your image in the AWS Rekognition Console under Image Moderation.
                    (2) Note the exact label names returned.
                    (3) Use those labels here.
                    {' '}<Link href="https://docs.aws.amazon.com/rekognition/latest/dg/labels.html" external>Learn more about Rekognition labels</Link>
                  </Box>
                } triggerType="custom">
                  <Link variant="info">Info</Link>
                </Popover>
              }>
                <Input value={contentModerationLabels} onChange={({ detail }) => setContentModerationLabels(detail.value)} placeholder="Label1, Label2" />
              </FormField>
            </SpaceBetween>
          )}
        </SpaceBetween>
      </ExpandableSection>

      <ExpandableSection headerText="Watermark">
        <SpaceBetween size="m">
          <FormField label="Watermark Source URL" description="HTTPS URL of the watermark image (must match a configured origin)">
            <Input value={watermarkSource} onChange={({ detail }) => setWatermarkSource(detail.value)} placeholder="https://example.com/logo.png" />
          </FormField>
          <ColumnLayout columns={2}>
            <FormField label="X Offset" description="Integer or percentage (e.g., 10 or 50p)">
              <Input value={watermarkXOffset} onChange={({ detail }) => setWatermarkXOffset(detail.value)} placeholder="10 or 50p" />
            </FormField>
            <FormField label="Y Offset" description="Integer or percentage (e.g., 10 or 50p)">
              <Input value={watermarkYOffset} onChange={({ detail }) => setWatermarkYOffset(detail.value)} placeholder="10 or 50p" />
            </FormField>
            <FormField label="Width Ratio" description="Width as ratio of base image (0-1)">
              <Input value={watermarkWidthRatio} onChange={({ detail }) => setWatermarkWidthRatio(detail.value)} type="number" placeholder="0.3" />
            </FormField>
            <FormField label="Height Ratio" description="Height as ratio of base image (0-1)">
              <Input value={watermarkHeightRatio} onChange={({ detail }) => setWatermarkHeightRatio(detail.value)} type="number" placeholder="0.3" />
            </FormField>
          </ColumnLayout>
          <FormField label="Transparency (Optional)" description="0 = fully visible, 1 = fully transparent">
            <Input value={watermarkOpacity} onChange={({ detail }) => setWatermarkOpacity(detail.value)} type="number" placeholder="0.2" />
          </FormField>
        </SpaceBetween>
      </ExpandableSection>

      <ExpandableSection headerText="Convolve">
        <FormField label="Kernel values" description="Comma-separated kernel values (e.g. -1,0,1,-2,0,2,-1,0,1 for edge detection)">
          <Input value={convolveKernel} onChange={({ detail }) => setConvolveKernel(detail.value)} placeholder="-1,0,1,-2,0,2,-1,0,1" />
        </FormField>
      </ExpandableSection>

    </SpaceBetween>
  );
};

export default TransformationControls;
