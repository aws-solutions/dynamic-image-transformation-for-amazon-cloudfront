import React from 'react';
import { Button, Box } from '@cloudscape-design/components';

interface BreadcrumbBarProps {
  breadcrumbs: Array<{
    text: string;
    href?: string;
  }>;
  onHelpClick?: () => void;
}

export const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({ breadcrumbs, onHelpClick }) => (
  <div>
    <Box
      padding={{ horizontal: 'l', vertical: 'xs' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginLeft: '10px' }}>
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={index}>
              {crumb.href ? (
                <a href={crumb.href} style={{ color: '#0073bb', textDecoration: 'none' }}>
                  {crumb.text}
                </a>
              ) : (
                <span style={{ color: '#16191f' }}>{crumb.text}</span>
              )}
              {index < breadcrumbs.length - 1 && (
                <span style={{ color: '#5f6b7a' }}>›</span>
              )}
            </React.Fragment>
          ))}
        </div>
        {onHelpClick && (
          <Button
            variant="icon"
            iconName="status-info"
            onClick={onHelpClick}
            ariaLabel="Open help panel"
          />
        )}
      </div>
    </Box>
    <div style={{ 
      height: '1px', 
      backgroundColor: '#d5dbdb', 
      width: '100%' 
    }} />
  </div>
);
