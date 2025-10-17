import { JSX } from '@framework';

import { Polygon, PolygonProps } from './polygon';
import {
  MeasurementDisplayPayload,
  MeasurementLabel,
  normaliseMeasurementLines,
} from './measurement-label';

export interface MeasurementPolygonProps extends Omit<PolygonProps, 'children'> {
  measurement?: MeasurementDisplayPayload;
}

function computeCentroid(points: { x: number; y: number }[]): { x: number; y: number } | null {
  if (points.length === 0) {
    return null;
  }

  let area = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    area += cross;
    centroidX += (current.x + next.x) * cross;
    centroidY += (current.y + next.y) * cross;
  }

  area *= 0.5;

  if (Math.abs(area) < 1e-6) {
    const sum = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 },
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
  }

  return {
    x: centroidX / (6 * area),
    y: centroidY / (6 * area),
  };
}

export function MeasurementPolygon({
  measurement,
  strokeColor = '#000000',
  rect,
  ...rest
}: MeasurementPolygonProps): JSX.Element {
  const labelColor = strokeColor !== 'transparent' ? strokeColor : '#000000';

  return (
    <Polygon {...rest} rect={rect} strokeColor={strokeColor}>
      {({ localPoints, isPreviewing }) => {
        if (isPreviewing) return null;

        const lines = normaliseMeasurementLines(measurement);
        if (!lines || lines.length === 0) return null;

        const centroid = computeCentroid(localPoints);
        if (!centroid) return null;

        const fontSize = Math.max(10, Math.min(rect.size.width, rect.size.height) * 0.1);
        const strokePadding = Math.max(0.75, fontSize / 6);

        return (
          <MeasurementLabel
            lines={lines}
            position={centroid}
            fontSize={fontSize}
            strokePadding={strokePadding}
            fill={labelColor}
          />
        );
      }}
    </Polygon>
  );
}
