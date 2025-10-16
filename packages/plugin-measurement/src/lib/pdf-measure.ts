import { PdfMeasurementConversion, PdfMeasurementDictionary } from '@embedpdf/models';

import { MeasurementKind } from './types';

interface PdfMeasureOptions {
  unit: string;
  pointsPerUnit: number;
  precision: number;
  kind: Exclude<MeasurementKind, 'calibration'>;
}

interface NumberSeparators {
  decimal: string;
  thousands?: string;
}

function squaredUnit(unit: string): string {
  return `${unit}\u00B2`;
}

function getNumberSeparators(): NumberSeparators {
  const formatter = new Intl.NumberFormat(undefined, {
    useGrouping: true,
    maximumFractionDigits: 2,
  });

  const decimalPart = formatter.formatToParts(1.1).find((part) => part.type === 'decimal');
  const groupPart = formatter.formatToParts(1000).find((part) => part.type === 'group');

  return {
    decimal: decimalPart?.value ?? '.',
    thousands: groupPart?.value,
  };
}

function formatRatio(value: number, precision: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  });
}

const DEFAULT_POINTS_PER_UNIT: Record<string, number> = {
  in: 72,
  inch: 72,
  inches: 72,
  ft: 72 * 12,
  foot: 72 * 12,
  feet: 72 * 12,
  yd: 72 * 36,
  yard: 72 * 36,
  yards: 72 * 36,
  mi: 72 * 63360,
  mile: 72 * 63360,
  miles: 72 * 63360,
  pt: 1,
  mm: 72 / 25.4,
  millimeter: 72 / 25.4,
  millimeters: 72 / 25.4,
  cm: 72 / 2.54,
  centimetre: 72 / 2.54,
  centimetres: 72 / 2.54,
  centimeter: 72 / 2.54,
  centimeters: 72 / 2.54,
  m: 72 / 0.0254,
  metre: 72 / 0.0254,
  metres: 72 / 0.0254,
  meter: 72 / 0.0254,
  meters: 72 / 0.0254,
};

function getScaleString(
  unit: string,
  pointsPerUnit: number,
  precision: number,
): string | undefined {
  if (!pointsPerUnit || !Number.isFinite(pointsPerUnit)) {
    return undefined;
  }

  const baseline = DEFAULT_POINTS_PER_UNIT[unit.toLowerCase()] ?? pointsPerUnit;
  const ratio = pointsPerUnit / baseline;

  return `1 ${unit} = ${formatRatio(ratio, precision)} ${unit}`;
}

function createConversion(
  unit: string,
  conversionFactor: number,
  precision: number,
  separators: NumberSeparators,
): PdfMeasurementConversion {
  return {
    unit,
    conversionFactor,
    precision: Math.pow(10, precision),
    format: 'D',
    decimalSeparator: separators.decimal,
    thousandSeparator: separators.thousands,
  };
}

export function buildPdfMeasureDictionary({
  unit,
  pointsPerUnit,
  precision,
  kind,
}: PdfMeasureOptions): PdfMeasurementDictionary {
  const separators = getNumberSeparators();
  const scale = getScaleString(unit, pointsPerUnit, precision);

  const distanceConversion = createConversion(unit, 1, precision, separators);
  const crossConversion = createConversion(
    unit,
    pointsPerUnit ? 1 / pointsPerUnit : 0,
    precision,
    separators,
  );

  const measure: PdfMeasurementDictionary = {
    type: 'Measure',
    scale,
    distance: [distanceConversion],
    cross: [crossConversion],
  };

  if (kind === 'area') {
    const areaConversion = createConversion(squaredUnit(unit), 1, precision, separators);
    measure.area = [areaConversion];
  }

  return measure;
}
