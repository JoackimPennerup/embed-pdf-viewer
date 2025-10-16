import { useMemo, MouseEvent, TouchEvent, JSX } from '@framework';
import { Rect, LinePoints, LineEndings, PdfAnnotationBorderStyle } from '@embedpdf/models';
import { patching } from '@embedpdf/plugin-annotation';

/* ---------------------------------------------------------------- *\
|* Types                                                            *|
\* ---------------------------------------------------------------- */

export interface LineProps {
  /** interior colour */
  color?: string;
  /** 0 – 1 */
  opacity?: number;
  /** Stroke width in PDF units */
  strokeWidth: number;
  /** Stroke colour (falls back to PDFium default black) */
  strokeColor?: string;
  /** Stroke style */
  strokeStyle?: PdfAnnotationBorderStyle;
  /** Stroke dash array */
  strokeDashArray?: number[];
  /** Bounding box of the annotation */
  rect: Rect;
  /** Line start / end points (page units) */
  linePoints: LinePoints;
  /** Line endings (eg. OpenArrow / Butt) */
  lineEndings?: LineEndings;
  /** Current page zoom factor */
  scale: number;
  /** Click handler (used for selection) */
  onClick?: (e: MouseEvent<SVGElement> | TouchEvent<SVGElement>) => void;
  /** Whether the annotation is selected */
  isSelected: boolean;
  /** Optional custom payload (not used here but preserved for compatibility) */
  custom?: unknown;
  /** Optional child renderer for overlays (e.g. measurement labels) */
  children?: (data: LineRenderData) => JSX.Element | null;
}

export interface LineRenderData {
  rect: Rect;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  midX: number;
  midY: number;
  angleRadians: number;
  angleDegrees: number;
  strokeWidth: number;
}

/**
 * Renders a PDF Line annotation as SVG (with arrow/butt endings).
 */
export function Line(props: LineProps): JSX.Element {
  const {
    color = 'transparent',
    opacity = 1,
    strokeWidth,
    strokeColor = '#000000',
    strokeStyle = PdfAnnotationBorderStyle.SOLID,
    strokeDashArray,
    rect,
    linePoints,
    lineEndings,
    scale,
    onClick,
    isSelected,
    children,
  } = props;
  /* -------------------------------------------------------------- */
  /*  Localise the line within its own bounding box                 */
  /* -------------------------------------------------------------- */
  const geometry = useMemo(() => {
    const x1 = linePoints.start.x - rect.origin.x;
    const y1 = linePoints.start.y - rect.origin.y;
    const x2 = linePoints.end.x - rect.origin.x;
    const y2 = linePoints.end.y - rect.origin.y;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const angleRadians = Math.atan2(y2 - y1, x2 - x1);
    return {
      x1,
      y1,
      x2,
      y2,
      midX,
      midY,
      angleRadians,
      angleDegrees: (angleRadians * 180) / Math.PI,
    };
  }, [linePoints, rect]);

  /* -------------------------------------------------------------- */
  /*  Arrow-head path data via shared factory                       */
  /* -------------------------------------------------------------- */
  const endings = useMemo(() => {
    return {
      start: patching.createEnding(
        lineEndings?.start,
        strokeWidth,
        geometry.angleRadians + Math.PI,
        geometry.x1,
        geometry.y1,
      ),
      end: patching.createEnding(
        lineEndings?.end,
        strokeWidth,
        geometry.angleRadians,
        geometry.x2,
        geometry.y2,
      ),
    };
  }, [
    geometry.angleRadians,
    geometry.x1,
    geometry.x2,
    geometry.y1,
    geometry.y2,
    lineEndings,
    strokeWidth,
  ]);

  /* -------------------------------------------------------------- */
  /*  Absolute placement + scaling (same pattern as other shapes)   */
  /* -------------------------------------------------------------- */
  const width = rect.size.width * scale;
  const height = rect.size.height * scale;

  return (
    <svg
      style={{
        position: 'absolute',
        width,
        height,
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'visible',
      }}
      width={width}
      height={height}
      viewBox={`0 0 ${rect.size.width} ${rect.size.height}`}
    >
      {/* Main line */}
      <line
        x1={geometry.x1}
        y1={geometry.y1}
        x2={geometry.x2}
        y2={geometry.y2}
        opacity={opacity}
        onPointerDown={onClick}
        onTouchStart={onClick}
        style={{
          cursor: isSelected ? 'move' : 'pointer',
          pointerEvents: isSelected ? 'none' : 'visibleStroke',
          stroke: strokeColor,
          strokeWidth,
          strokeLinecap: 'butt',
          ...(strokeStyle === PdfAnnotationBorderStyle.DASHED && {
            strokeDasharray: strokeDashArray?.join(','),
          }),
        }}
      />

      {/* Optional arrowheads / butt caps */}
      {endings.start && (
        <path
          d={endings.start.d}
          transform={endings.start.transform}
          onPointerDown={onClick}
          onTouchStart={onClick}
          stroke={strokeColor}
          style={{
            cursor: isSelected ? 'move' : 'pointer',
            strokeWidth,
            strokeLinecap: 'butt',
            pointerEvents: isSelected ? 'none' : endings.start.filled ? 'visible' : 'visibleStroke',
            ...(strokeStyle === PdfAnnotationBorderStyle.DASHED && {
              strokeDasharray: strokeDashArray?.join(','),
            }),
          }}
          fill={endings.start.filled ? color : 'none'}
        />
      )}
      {endings.end && (
        <path
          d={endings.end.d}
          transform={endings.end.transform}
          stroke={strokeColor}
          onPointerDown={onClick}
          onTouchStart={onClick}
          style={{
            cursor: isSelected ? 'move' : 'pointer',
            strokeWidth,
            strokeLinecap: 'butt',
            pointerEvents: isSelected ? 'none' : endings.end.filled ? 'visible' : 'visibleStroke',
            ...(strokeStyle === PdfAnnotationBorderStyle.DASHED && {
              strokeDasharray: strokeDashArray?.join(','),
            }),
          }}
          fill={endings.end.filled ? color : 'none'}
        />
      )}

      {children?.({
        rect,
        x1: geometry.x1,
        y1: geometry.y1,
        x2: geometry.x2,
        y2: geometry.y2,
        midX: geometry.midX,
        midY: geometry.midY,
        angleRadians: geometry.angleRadians,
        angleDegrees: geometry.angleDegrees,
        strokeWidth,
      })}
    </svg>
  );
}
