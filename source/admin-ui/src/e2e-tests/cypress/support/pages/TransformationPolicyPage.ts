// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class TransformationPolicyPage {
  // Navigation
  static navigateToTransformationPolicies() {
    cy.get('a[href="/transformation-policies"]').click();
  }

  static clickCreatePolicy() {
    cy.get('button').contains('Create policy').click();
  }

  // Form filling
  static fillPolicyForm(data: {
    name: string;
    description?: string;
    isDefault?: boolean;
    transformations?: Array<{ type: string; config?: any }>;
    outputs?: Array<{ type: string; config?: any }>;
  }) {
    cy.get('input[placeholder="e.g., Mobile Optimization Policy"]').type(data.name, { force: true });
    
    if (data.description) {
      cy.get('textarea[placeholder="Describe the purpose and use case for this transformation policy..."]').type(data.description, { force: true });
      
      // Wait for DOM to stabilize after description entry
      cy.wait(3000);
      cy.get('body').should('be.visible');
    }

    if (data.isDefault) {
      cy.get('input[type="checkbox"][aria-labelledby*="label"]').check({ force: true });
    }

    // Add transformations
    if (data.transformations) {
      data.transformations.forEach((transformation) => {
        cy.get('button').contains('Add Transformation').click();
        
        // Wait for transformation selection modal
        cy.get('[role="dialog"]').should('be.visible');
        
        // Click on the transformation by title - use first dialog if multiple exist
        cy.get('[role="dialog"]').first().within(() => {
          cy.contains('strong', this.getTransformationTitle(transformation.type)).click();
        });
        
        // Wait for configuration modal
        cy.contains('Add Transformation - Step 2 of 2').should('be.visible');
        
        // Fill configuration if provided
        if (transformation.config) {
          this.fillTransformationConfig(transformation.type, transformation.config);
        }
        
        // Add to policy
        cy.get('button').contains('Add to Policy').click();
        
        // Wait for modal to close
        cy.get('[role="dialog"]').should('not.be.visible');
      });
    }

    // Add outputs
    if (data.outputs) {
      data.outputs.forEach((output) => {
        cy.get('button').contains('Add Output Optimization').click();
        
        // Wait for output selection modal to be visible and fully loaded
        cy.get('[role="dialog"]').should('be.visible');
        cy.wait(1000);
        
        // Search at body level since modal is a portal
        cy.get('body').within(() => {
          cy.contains('Quality Optimization').should('be.visible');
          const radioIndex = this.getOutputOptimizationIndex(output.type);
          
          // Check if enough radio buttons exist, otherwise use first one
          cy.get('input[type="radio"]').then(($radios) => {
            const indexToUse = $radios.length > radioIndex ? radioIndex : 0;
            cy.get('input[type="radio"]').eq(indexToUse).click({ force: true });
          });
        });
        
        // Wait for second modal (configuration modal) to load
        cy.wait(1000);
        cy.contains('Add to Policy').should('be.visible');
        
        // Fill configuration if provided
        if (output.config) {
          this.fillOutputConfig(output.type, output.config);
        }
               
        // Add to policy (search at body level)
        cy.get('body').contains('Add to Policy').click();
        
        // Wait for modal to close
        cy.get('[role="dialog"]').should('not.be.visible');
      });
    }
  }

  static getOutputOptimizationIndex(type: string): number {
    // Based on the order: Quality Optimization (0), Format Optimization (1), Auto Sizing (2)
    const outputTypes = {
      'webp': 0,    // Quality Optimization
      'avif': 0,    // Quality Optimization  
      'jpeg': 0,    // Quality Optimization
      'format': 1,  // Format Optimization
      'autoSizing': 2  // Auto Sizing
    };
    return outputTypes[type as keyof typeof outputTypes] || 0;
  }

  static getTransformationTitle(type: string): string {
    const titles = {
      'resize': 'Resize',
      'quality': 'Quality', 
      'format': 'Format',
      'rotate': 'Rotate',
      'flip': 'Flip',
      'flop': 'Flop',
      'blur': 'Blur',
      'sharpen': 'Sharpen',
      'grayscale': 'Grayscale',
      'tint': 'Tint',
      'normalize': 'Normalize',
      'smartCrop': 'Smart Crop',
      'extract': 'Extract',
      'convolve': 'Convolve',
      'flatten': 'Flatten',
      'stripExif': 'Strip EXIF',
      'stripIcc': 'Strip ICC',
      'animated': 'Animated'
    };
    return titles[type as keyof typeof titles] || type;
  }

  static fillTransformationConfig(type: string, config: any) {
    switch (type) {
      case 'quality':
        if (config.quality) {
          cy.get('input[type="number"]').first().type(config.quality.toString(), { force: true });
        }
        break;
      case 'resize':
        if (config.width) {
          cy.get('input[type="number"]').first().type(config.width.toString(), { force: true });
        }
        if (config.height) {
          cy.get('input[type="number"]').eq(1).type(config.height.toString(), { force: true });
        }
        if (config.fit) {
          cy.get('[role="button"]').contains('cover').click();
          cy.get(`[data-value="${config.fit}"]`).click();
        }
        break;
      case 'format':
        if (config.format) {
          cy.get('[role="button"]').contains('webp').click();
          cy.get(`[data-value="${config.format}"]`).click();
        }
        break;
      case 'blur':
        if (config.blur) {
          cy.get('input[type="number"]').first().type(config.blur.toString(), { force: true });
        }
        break;
      case 'rotate':
        if (config.rotate) {
          cy.get('input[type="number"]').first().type(config.rotate.toString(), { force: true });
        }
        break;
      case 'tint':
        if (config.tint) {
          cy.get('input[id*="formField"][type="text"]').should('be.visible').first().clear().type(config.tint, { force: true });
        }
        break;
      case 'flatten':
        if (config.flatten) {
          cy.get('input[type="text"]').first().type(config.flatten, { force: true });
        }
        break;
      case 'extract':
        if (config.left) cy.get('input[type="number"]').eq(0).type(config.left.toString(), { force: true });
        if (config.top) cy.get('input[type="number"]').eq(1).type(config.top.toString(), { force: true });
        if (config.width) cy.get('input[type="number"]').eq(2).type(config.width.toString(), { force: true });
        if (config.height) cy.get('input[type="number"]').eq(3).type(config.height.toString(), { force: true });
        break;
      case 'convolve':
        // No configuration needed for Edge Detection
        break;
      // For transformations without config (grayscale, flip, flop, etc.), no action needed
    }
  }

  static fillOutputConfig(type: string, config: any) {
    // Fill config - search for any text input that appears in the modal
    if (config.quality) {
      // Try to find input that's NOT the policy name field
      cy.get('input[type="text"]').then(($inputs) => {
        // Find input that doesn't have the policy name placeholder
        const modalInput = $inputs.filter((i, el) => !el.placeholder.includes('Mobile Optimization Policy'));
        if (modalInput.length > 0) {
          cy.wrap(modalInput.last()).clear({ force: true }).type(config.quality.toString(), { force: true });
        } else {
          // Fallback to last input
          cy.get('input[type="text"]').last().clear({ force: true }).type(config.quality.toString(), { force: true });
        }
      });
    }
  }

  // Actions
  static submitCreatePolicy() {
    cy.get('button').contains('Create Policy').click();
  }

  static submitUpdatePolicy() {
    cy.get('button').contains('Update Policy').click();
  }

  static editPolicy(policyName: string) {
    // Select the policy by clicking its radio button - find the row containing the policy name
    cy.contains('tr', policyName).find('input[type="radio"]').click();
    
    // Click Edit button
    cy.get('button').contains('Edit').click();
  }

  static deletePolicy(policyName: string) {
    // Select the policy by clicking its radio button - find the row containing the policy name
    cy.contains('tr', policyName).find('input[type="radio"]').click();
    
    // Click Delete button
    cy.get('button').contains('Delete').click();
    
    // Confirm deletion in modal
    cy.get('[role="dialog"]').should('be.visible');
    cy.get('[role="dialog"]').within(() => {
      cy.get('button').contains('Delete').click();
    });
  }

  // Getters for direct access in tests
  static getPolicyDescriptionInput() {
    return cy.get('textarea[placeholder="Describe the purpose and use case for this transformation policy..."]');
  }
}
