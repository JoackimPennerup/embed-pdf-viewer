import { JSX } from '@framework';

import { Line, LineProps, LineRenderData } from './line';
import {
  MeasurementDisplayPayload,
  MeasurementLabel,
  normaliseMeasurementLines,
} from './measurement-label';

export interface MeasurementLineProps extends Omit<LineProps, 'children'> {
  measurement?: MeasurementDisplayPayload;
}

export function MeasurementLine({
  measurement,
  strokeWidth,
  strokeColor = '#000000',
  ...rest
}: MeasurementLineProps): JSX.Element {
  const labelColor = strokeColor !== 'transparent' ? strokeColor : '#000000';

  return (
    <Line {...rest} strokeWidth={strokeWidth} strokeColor={strokeColor}>
      {(data: LineRenderData) => {
        const lines = normaliseMeasurementLines(measurement);
        if (!lines || lines.length === 0) return null;

        const fontSize = Math.max(10, strokeWidth * 4);
        const strokePadding = Math.max(0.75, fontSize / 6);

        return (
          <MeasurementLabel
            lines={lines}
            position={{ x: data.midX, y: data.midY }}
            fontSize={fontSize}
            strokePadding={strokePadding}
            fill={labelColor}
            angleDegrees={data.angleDegrees}
          />
        );
      }}
    </Line>
  );
}
