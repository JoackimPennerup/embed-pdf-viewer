import { h } from 'preact';
import { IconProps } from './types';

export const MeasureAreaIcon = ({
  size = 24,
  strokeWidth = 2.2,
  primaryColor = 'currentColor',
  secondaryColor = 'currentColor',
  className,
  title,
}: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={primaryColor}
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
    role="img"
    aria-label={title}
  >
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path
      d="M6 17l2-10l6-3l4 5l-2 9z"
      fill={secondaryColor}
      fill-opacity="0.2"
    />
    <path d="M6 17l2-10l6-3l4 5l-2 9z" />
  </svg>
);
