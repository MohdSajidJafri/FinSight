import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtitle = false,
  className = ''
}) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-8 h-8'
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl'
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Intentional FinSight Forward Financial Vision Glyph */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={`${iconSizes[size]} text-black flex-shrink-0`}
      >
        {/* Abstract upward trajectory + financial clarity lens */}
        <path d="M12 2C12 2 13.5 6.5 17 8C20.5 9.5 22 13 22 13C22 13 17.5 13.5 15 11.5C12.5 9.5 12 2 12 2Z" />
        <path d="M12 2C12 2 10.5 6.5 7 8C3.5 9.5 2 13 2 13C2 13 6.5 13.5 9 11.5C11.5 9.5 12 2 12 2Z" />
        <path d="M12 9C12 9 13 13 16 15.5C19 18 20 22 20 22C20 22 16 21 13.5 18.5C11 16 12 9 12 9Z" />
        <path d="M12 9C12 9 11 13 8 15.5C5 18 4 22 4 22C4 22 8 21 10.5 18.5C13 16 12 9 12 9Z" />
      </svg>

      <div className="flex flex-col">
        <span className={`font-bold tracking-tight text-black ${textSizes[size]}`}>
          FinSight
        </span>
        {showSubtitle && (
          <span className="text-[11px] font-medium text-neutral-500 tracking-normal">
            Intelligent insights. Smarter finances.
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandLogo;
