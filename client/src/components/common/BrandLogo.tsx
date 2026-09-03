import React from 'react';
import finsightLogo from '../../images/finsight-logo.png';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = ''
}) => {
  // Configured precisely for the 1254x1254 square logo asset where the mark + wordmark artwork
  // is centered at 992x250. This preserves the 1:1 aspect ratio, prevents any distortion or clipping,
  // and gives the logo optimal optical breathing room.
  const sizeMap = {
    sm: {
      container: 'h-9 w-36',
      img: 'w-36 h-36'
    },
    md: {
      container: 'h-11 w-44',
      img: 'w-44 h-44'
    },
    lg: {
      container: 'h-16 w-64',
      img: 'w-64 h-64'
    }
  };

  const { container, img } = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center justify-start overflow-hidden select-none ${container} ${className}`}>
      <img
        src={finsightLogo}
        alt="FinSight"
        className={`${img} object-contain flex-shrink-0 pointer-events-none`}
        loading="eager"
        decoding="async"
      />
    </div>
  );
};

export default BrandLogo;
