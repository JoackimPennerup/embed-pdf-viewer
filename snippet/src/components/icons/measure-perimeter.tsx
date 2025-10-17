import { h } from 'preact';
import { IconProps } from './types';

export const MeasurePerimeterIcon = ({
  size = 24,
  strokeWidth = 2.2,
  primaryColor = 'currentColor',
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
    <path d="M6 17l2-10l6-3l4 5l-2 9z" />
    <circle cx="6" cy="17" r="0.6" fill={primaryColor} stroke="none" />
    <circle cx="8" cy="7" r="0.6" fill={primaryColor} stroke="none" />
    <circle cx="14" cy="4" r="0.6" fill={primaryColor} stroke="none" />
    <circle cx="18" cy="9" r="0.6" fill={primaryColor} stroke="none" />
    <circle cx="16" cy="18" r="0.6" fill={primaryColor} stroke="none" />
  </svg>
);
