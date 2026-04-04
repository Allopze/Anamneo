'use client';

import Link from 'next/link';
import clsx from 'clsx';
import Tooltip from '@/components/common/Tooltip';
import type { IconType } from 'react-icons';

interface HeaderNavItemProps {
  href: string;
  icon: IconType;
  label: string;
  isActive: boolean;
  /** Visual tier — primary is larger, secondary is more subtle */
  tier?: 'primary' | 'secondary';
  onClick?: () => void;
}

export default function HeaderNavItem({
  href,
  icon: Icon,
  label,
  isActive,
  tier = 'primary',
  onClick,
}: HeaderNavItemProps) {
  const isPrimary = tier === 'primary';

  return (
    <Tooltip label={label} side="bottom">
      <Link
        href={href}
        onClick={onClick}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        className={clsx(
          'header-nav-item',
          isPrimary ? 'header-nav-item-primary' : 'header-nav-item-secondary',
          isActive && (isPrimary ? 'header-nav-item-active' : 'header-nav-item-secondary-active')
        )}
      >
        <Icon className={isPrimary ? 'w-[18px] h-[18px]' : 'w-4 h-4'} />
      </Link>
    </Tooltip>
  );
}
