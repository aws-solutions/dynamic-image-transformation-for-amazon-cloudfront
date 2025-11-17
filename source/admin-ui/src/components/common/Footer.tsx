import React from 'react';

// Styles
const styles = {
  footer: {
    backgroundColor: '#16191f',
    borderTop: '1px solid var(--color-border-header, #414d5c)',
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    padding: '8px 16px',
    display: 'flex',
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    fontSize: '12px',
    color: 'var(--color-text-header-primary, #ffffff)'
  },
  disclaimer: {
    fontSize: '12px'
  },
  copyright: {
    fontSize: '12px'
  }
};

// Component
const Footer: React.FC = () => {
  return (
    <div style={styles.footer}>
      <div style={styles.disclaimer}>
        <strong>Disclaimer:</strong> Use of Dynamic Image Transformation is subject to the Terms of Use. 
        For your security, only process images from sources you own or trust.
      </div>
      <div style={styles.copyright}>
        <span>© 2025, Amazon Web Services, Inc. or its affiliates.</span>
      </div>
    </div>
  );
};

export default Footer;
