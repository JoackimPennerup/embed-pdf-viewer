import { BasePluginConfig, EventHook } from '@embedpdf/core';
import {
  PdfLineAnnoObject,
  PdfMeasurementDictionary,
  PdfPolygonAnnoObject,
} from '@embedpdf/models';

export type MeasurementKind = 'distance' | 'area' | 'perimeter' | 'calibration';

export interface MeasurementValue {
  /** Raw measurement in PDF units (or squared PDF units). */
  raw: number;
  /** Measurement converted to the configured unit. */
  value: number;
  /** Unit label used for the formatted string. */
  unit: string;
  /** Formatted display string. */
  formatted: string;
}

export interface MeasurementScale {
  unit: string;
  pointsPerUnit: number;
  precision: number;
}

export interface MeasurementDisplayData {
  kind: MeasurementKind;
  scale: MeasurementScale;
  label: string;
  labelLines: string[];
  distance?: MeasurementValue;
  area?: MeasurementValue;
  perimeter?: MeasurementValue;
  pdfMeasure?: PdfMeasurementDictionary;
  lastUpdated: string;
}

export interface CalibrationRecord {
  pageIndex: number;
  pdfDistance: number;
  actualDistance: number;
  unit: string;
  timestamp: string;
}

export interface MeasurementState {
  enabled: boolean;
  unit: string;
  precision: number;
  pointsPerUnit: number;
  lastCalibration?: CalibrationRecord;
}

export interface MeasurementFormatContext {
  annotation: PdfLineAnnoObject | PdfPolygonAnnoObject | null;
  kind: Exclude<MeasurementKind, 'calibration'>;
}

export interface CalibrationRequest {
  pageIndex: number;
  annotation: PdfLineAnnoObject;
  pdfDistance: number;
  unit: string;
  pointsPerUnit: number;
}

export interface MeasurementPluginConfig extends BasePluginConfig {
  unit?: string;
  precision?: number;
  /**
   * Number of PDF points that equal one display unit. Defaults to 72 (1 inch).
   */
  pointsPerUnit?: number;
  formatDistance?: (value: number, unit: string, ctx: MeasurementFormatContext) => string;
  formatArea?: (value: number, unit: string, ctx: MeasurementFormatContext) => string;
  formatPerimeter?: (value: number, unit: string, ctx: MeasurementFormatContext) => string;
  onCalibrationRequest?: (request: CalibrationRequest) => number | null | Promise<number | null>;
}

export interface MeasurementCapability {
  getState(): MeasurementState;
  onStateChange: EventHook<MeasurementState>;
  setUnit(unit: string): void;
  setPrecision(precision: number): void;
  setPointsPerUnit(pointsPerUnit: number): void;
  formatDistance(value: number, unit?: string): string;
  formatArea(value: number, unit?: string): string;
  formatPerimeter(value: number, unit?: string): string;
  recalculateAll(): void;
}
