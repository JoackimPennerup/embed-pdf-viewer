/**
 * Vue-specific types for annotation plugin
 * These types are separate from React types to avoid JSX dependencies
 */

/** UI customization for resize handles (Vue) */
export interface ResizeHandleUI {
  /** Handle size in CSS px (default: 12) */
  size?: number;
  /** Default background color for the handle (used by default renderer) */
  color?: string;
  // Note: Use #resize-handle slot for custom rendering instead of component prop
}

/** UI customization for vertex handles (Vue) */
export interface VertexHandleUI {
  /** Handle size in CSS px (default: 12) */
  size?: number;
  /** Default background color for the handle (used by default renderer) */
  color?: string;
  // Note: Use #vertex-handle slot for custom rendering instead of component prop
}
