import { JSX } from '@framework';

export interface MeasurementDisplayPayload {
  label?: string;
  labelLines?: string[];
  kind?: string;
}

export function normaliseMeasurementLines(
  measurement?: MeasurementDisplayPayload,
): string[] | undefined {
  if (!measurement) return undefined;
  if (measurement.labelLines && measurement.labelLines.length > 0) {
    return measurement.labelLines;
  }
  if (measurement.label) {
    return [measurement.label];
  }
  return undefined;
}

interface MeasurementLabelProps {
  lines: string[];
  position: { x: number; y: number };
  fontSize: number;
  strokePadding: number;
  fill: string;
  angleDegrees?: number;
}

export function MeasurementLabel({
  lines,
  position,
  fontSize,
  strokePadding,
  fill,
  angleDegrees,
}: MeasurementLabelProps): JSX.Element {
  const rotation =
    angleDegrees !== undefined
      ? `rotate(${angleDegrees}, ${position.x}, ${position.y})`
      : undefined;

  return (
    <text
      x={position.x}
      y={position.y}
      fontSize={fontSize}
      textAnchor="middle"
      dominantBaseline="middle"
      fill={fill}
      stroke="#FFFFFF"
      strokeWidth={strokePadding}
      paintOrder="stroke"
      transform={rotation}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {lines.map((line, index) => (
        <tspan key={index} x={position.x} dy={index === 0 ? 0 : fontSize * 1.2}>
          {line}
        </tspan>
      ))}
    </text>
  );
}
