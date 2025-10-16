import { BasePlugin, PluginRegistry, createBehaviorEmitter } from '@embedpdf/core';
import {
  ignore,
  PdfAnnotationObject,
  PdfAnnotationSubtype,
  PdfAnnotationLineEnding,
  PdfLineAnnoObject,
  PdfPolygonAnnoObject,
} from '@embedpdf/models';
import {
  AnnotationCapability,
  AnnotationPlugin,
  AnnotationTool,
  AnnotationEvent,
} from '@embedpdf/plugin-annotation';

import {
  CalibrationRequest,
  MeasurementCapability,
  MeasurementDisplayData,
  MeasurementKind,
  MeasurementPluginConfig,
  MeasurementState,
  MeasurementFormatContext,
} from './types';

interface MeasurementAnnotationCustom {
  measurement?: MeasurementDisplayData;
  [key: string]: unknown;
}

export class MeasurementPlugin extends BasePlugin<MeasurementPluginConfig, MeasurementCapability> {
  static readonly id = 'measurement' as const;

  private readonly state$ = createBehaviorEmitter<MeasurementState>();
  private readonly config: MeasurementPluginConfig;
  private state: MeasurementState;
  private annotation: AnnotationCapability | null;
  private unsubscribeAnnotation?: () => void;

  constructor(id: string, registry: PluginRegistry, config: MeasurementPluginConfig) {
    super(id, registry);

    this.config = config;
    this.annotation = registry.getPlugin<AnnotationPlugin>('annotation')?.provides() ?? null;

    const precision = Math.max(0, config.precision ?? 2);
    const pointsPerUnit = this.normalisePointsPerUnit(config.pointsPerUnit ?? 72);

    this.state = {
      enabled: config.enabled ?? true,
      unit: config.unit ?? 'in',
      precision,
      pointsPerUnit,
      lastCalibration: undefined,
    };
  }

  async initialize(): Promise<void> {
    if (!this.state.enabled) return;

    if (!this.annotation) {
      this.logger.warn(
        'MeasurementPlugin',
        'MissingDependency',
        'Annotation plugin is required for measurement tools.',
      );
      return;
    }

    this.registerMeasurementTools();
    this.unsubscribeAnnotation = this.annotation.onAnnotationEvent((event) =>
      this.handleAnnotationEvent(event),
    );

    // Process existing annotations if a document is already loaded
    if (this.coreState.core.document) {
      this.recalculateAll();
    }
  }

  async destroy(): Promise<void> {
    this.unsubscribeAnnotation?.();
    await super.destroy();
  }

  protected buildCapability(): MeasurementCapability {
    return {
      getState: () => this.state,
      onStateChange: this.state$.on,
      setUnit: (unit: string) => {
        if (!unit || unit === this.state.unit) return;
        this.setState({ unit });
        this.recalculateAll();
      },
      setPrecision: (precision: number) => {
        const next = Math.max(0, precision);
        if (next === this.state.precision) return;
        this.setState({ precision: next });
        this.recalculateAll();
      },
      setPointsPerUnit: (ppu: number) => {
        const next = this.normalisePointsPerUnit(ppu);
        if (next === this.state.pointsPerUnit) return;
        this.setState({ pointsPerUnit: next });
        this.recalculateAll();
      },
      formatDistance: (value: number, unit?: string) =>
        this.formatValue(value, unit ?? this.state.unit, 'distance'),
      formatArea: (value: number, unit?: string) =>
        this.formatValue(value, unit ?? this.areaUnit(this.state.unit), 'area'),
      formatPerimeter: (value: number, unit?: string) =>
        this.formatValue(value, unit ?? this.state.unit, 'perimeter'),
      recalculateAll: () => this.recalculateAll(),
    };
  }

  private setState(patch: Partial<MeasurementState>) {
    this.state = { ...this.state, ...patch };
    this.state$.emit(this.state);
  }

  private normalisePointsPerUnit(value: number): number {
    if (!Number.isFinite(value) || value <= 0) {
      return 72; // Default to points-per-inch
    }
    return value;
  }

  private registerMeasurementTools() {
    if (!this.annotation) return;

    const tools = this.annotation.getTools();
    const existing = new Set(tools.map((tool) => tool.id));

    const toRegister: AnnotationTool[] = [];

    if (!existing.has('manualCalibration')) {
      toRegister.push(this.createManualCalibrationTool());
    }
    if (!existing.has('measureDistance')) {
      toRegister.push(this.createDistanceTool());
    }
    if (!existing.has('measureArea')) {
      toRegister.push(this.createAreaTool());
    }
    if (!existing.has('measurePerimeter')) {
      toRegister.push(this.createPerimeterTool());
    }

    toRegister.forEach((tool) => this.annotation?.addTool(tool));
  }

  private createManualCalibrationTool(): AnnotationTool<PdfLineAnnoObject> {
    return {
      id: 'manualCalibration',
      name: 'Calibrate',
      matchScore: (annotation) => {
        const kind = this.getCustomMeasurementKind(annotation);
        if (annotation.type === PdfAnnotationSubtype.LINE && kind === 'calibration') {
          return 100;
        }
        return 0;
      },
      interaction: {
        exclusive: false,
        cursor: 'crosshair',
        isDraggable: false,
        isResizable: false,
        lockAspectRatio: false,
      },
      defaults: {
        type: PdfAnnotationSubtype.LINE,
        intent: 'LineDimension',
        color: 'transparent',
        opacity: 1,
        strokeWidth: 2,
        strokeColor: '#2E7D32',
        lineEndings: {
          start: PdfAnnotationLineEnding.None,
          end: PdfAnnotationLineEnding.None,
        },
        custom: {
          measurement: {
            kind: 'calibration',
          },
        } as MeasurementAnnotationCustom,
      },
      behavior: {
        deactivateToolAfterCreate: true,
      },
    };
  }

  private createDistanceTool(): AnnotationTool<PdfLineAnnoObject> {
    return {
      id: 'measureDistance',
      name: 'Distance',
      matchScore: (annotation) => {
        if (annotation.type !== PdfAnnotationSubtype.LINE) return 0;
        const kind = this.getCustomMeasurementKind(annotation);
        if (kind === 'calibration') return 0;
        return annotation.intent === 'LineDimension' ? 90 : 0;
      },
      interaction: {
        exclusive: false,
        cursor: 'crosshair',
        isDraggable: true,
        isResizable: false,
        lockAspectRatio: false,
      },
      defaults: {
        type: PdfAnnotationSubtype.LINE,
        intent: 'LineDimension',
        color: 'transparent',
        opacity: 1,
        strokeWidth: 2,
        strokeColor: '#1E88E5',
        lineEndings: {
          start: PdfAnnotationLineEnding.None,
          end: PdfAnnotationLineEnding.None,
        },
        custom: {
          measurement: {
            kind: 'distance',
          },
        } as MeasurementAnnotationCustom,
      },
      clickBehavior: {
        enabled: true,
        defaultLength: 100,
        defaultAngle: 0,
      },
    };
  }

  private createAreaTool(): AnnotationTool<PdfPolygonAnnoObject> {
    return {
      id: 'measureArea',
      name: 'Area',
      matchScore: (annotation) => {
        if (annotation.type !== PdfAnnotationSubtype.POLYGON) return 0;
        const kind = this.getCustomMeasurementKind(annotation);
        if (kind && kind !== 'area') return 0;
        return annotation.intent === 'PolygonDimension' ? 80 : 0;
      },
      interaction: {
        exclusive: false,
        cursor: 'crosshair',
        isDraggable: true,
        isResizable: false,
        lockAspectRatio: false,
      },
      defaults: {
        type: PdfAnnotationSubtype.POLYGON,
        intent: 'PolygonDimension',
        color: '#1E88E5',
        opacity: 0.15,
        strokeWidth: 2,
        strokeColor: '#1565C0',
        custom: {
          measurement: {
            kind: 'area',
          },
        } as MeasurementAnnotationCustom,
      },
    };
  }

  private createPerimeterTool(): AnnotationTool<PdfPolygonAnnoObject> {
    return {
      id: 'measurePerimeter',
      name: 'Perimeter',
      matchScore: (annotation) => {
        if (annotation.type !== PdfAnnotationSubtype.POLYGON) return 0;
        const kind = this.getCustomMeasurementKind(annotation);
        return kind === 'perimeter' ? 90 : 0;
      },
      interaction: {
        exclusive: false,
        cursor: 'crosshair',
        isDraggable: true,
        isResizable: false,
        lockAspectRatio: false,
      },
      defaults: {
        type: PdfAnnotationSubtype.POLYGON,
        intent: 'PolygonDimension',
        color: 'transparent',
        opacity: 1,
        strokeWidth: 2,
        strokeColor: '#F4511E',
        custom: {
          measurement: {
            kind: 'perimeter',
          },
        } as MeasurementAnnotationCustom,
      },
    };
  }

  private handleAnnotationEvent(event: AnnotationEvent) {
    if (!this.state.enabled || !this.annotation) return;

    switch (event.type) {
      case 'create':
        this.processAnnotation(event.annotation, event.pageIndex);
        break;
      case 'update': {
        const merged: PdfAnnotationObject = {
          ...event.annotation,
          ...event.patch,
        } as PdfAnnotationObject;
        this.processAnnotation(merged, event.pageIndex);
        break;
      }
      case 'loaded':
        this.recalculateAll();
        break;
      default:
        break;
    }
  }

  private processAnnotation(annotation: PdfAnnotationObject, pageIndex: number) {
    const kind = this.resolveMeasurementKind(annotation);
    if (!kind) return;

    if (kind === 'calibration' && annotation.type === PdfAnnotationSubtype.LINE) {
      this.handleCalibration(pageIndex, annotation as PdfLineAnnoObject);
      return;
    }

    if (kind === 'distance' && annotation.type === PdfAnnotationSubtype.LINE) {
      const measurement = this.computeDistanceMeasurement(annotation as PdfLineAnnoObject);
      this.applyMeasurementResult(pageIndex, annotation, measurement);
      return;
    }

    if (annotation.type === PdfAnnotationSubtype.POLYGON) {
      if (kind === 'area') {
        const measurement = this.computeAreaMeasurement(annotation as PdfPolygonAnnoObject);
        this.applyMeasurementResult(pageIndex, annotation, measurement);
        return;
      }
      if (kind === 'perimeter') {
        const measurement = this.computePerimeterMeasurement(annotation as PdfPolygonAnnoObject);
        this.applyMeasurementResult(pageIndex, annotation, measurement);
        return;
      }
    }
  }

  private applyMeasurementResult(
    pageIndex: number,
    annotation: PdfAnnotationObject,
    measurement: MeasurementDisplayData | null,
  ) {
    if (!this.annotation) return;

    const existingCustom = (annotation.custom ?? {}) as MeasurementAnnotationCustom;
    const currentMeasurement = existingCustom.measurement;

    if (!measurement) {
      if (currentMeasurement) {
        const restCustom: MeasurementAnnotationCustom = { ...existingCustom };
        delete restCustom.measurement;
        const newCustom = Object.keys(restCustom).length > 0 ? restCustom : undefined;
        this.annotation.updateAnnotation(pageIndex, annotation.id, {
          custom: newCustom,
          contents: '',
        });
      }
      return;
    }

    const labelsMatch = annotation.contents === measurement.label;
    const measurementUnchanged = this.areMeasurementsEqual(currentMeasurement, measurement);

    if (measurementUnchanged && labelsMatch) {
      return;
    }

    const newCustom: MeasurementAnnotationCustom = {
      ...existingCustom,
      measurement,
    };

    this.annotation.updateAnnotation(pageIndex, annotation.id, {
      custom: newCustom,
      contents: measurement.label,
    });
  }

  private areMeasurementsEqual(a?: MeasurementDisplayData, b?: MeasurementDisplayData): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private handleCalibration(pageIndex: number, annotation: PdfLineAnnoObject) {
    const pdfDistance = this.measureLineLength(annotation);
    if (pdfDistance <= 0) {
      this.annotation?.deleteAnnotation(pageIndex, annotation.id);
      return;
    }

    const request: CalibrationRequest = {
      pageIndex,
      annotation,
      pdfDistance,
      unit: this.state.unit,
      pointsPerUnit: this.state.pointsPerUnit,
    };

    const responder =
      this.config.onCalibrationRequest ??
      ((req: CalibrationRequest) => this.promptForCalibration(req));

    Promise.resolve(responder(request))
      .then((actual) => {
        if (!actual || !Number.isFinite(actual) || actual <= 0) return;
        const pointsPerUnit = pdfDistance / actual;
        const nextScale = this.normalisePointsPerUnit(pointsPerUnit);

        this.setState({
          pointsPerUnit: nextScale,
          lastCalibration: {
            pageIndex,
            pdfDistance,
            actualDistance: actual,
            unit: this.state.unit,
            timestamp: new Date().toISOString(),
          },
        });
        this.recalculateAll();
      })
      .finally(() => {
        // Ensure the calibration line does not persist even if calibration was cancelled
        this.annotation?.deleteAnnotation(pageIndex, annotation.id);
      })
      .catch((error) => {
        this.logger.warn('MeasurementPlugin', 'CalibrationFailed', String(error));
      });
  }

  private promptForCalibration(request: CalibrationRequest): number | null {
    const promptValue =
      typeof globalThis === 'object' && globalThis !== null && 'prompt' in globalThis
        ? (globalThis as { prompt?: unknown }).prompt
        : undefined;

    if (typeof promptValue !== 'function') {
      return null;
    }

    // eslint-disable-next-line no-unused-vars
    const promptFn = promptValue as (..._parameters: [string, string?]) => string | null;

    const current = this.formatValue(
      request.pdfDistance / this.state.pointsPerUnit,
      this.state.unit,
      'distance',
      { annotation: request.annotation, kind: 'distance' },
    );

    const input = promptFn(
      `Enter the actual distance (${this.state.unit}) for the reference line.\n` +
        `Current scale distance: ${current}`,
    );
    if (!input) return null;
    const parsed = Number.parseFloat(input);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private recalculateAll() {
    if (!this.annotation) return;

    const document = this.coreState.core.document;
    if (!document) return;

    for (const page of document.pages) {
      this.annotation.getPageAnnotations({ pageIndex: page.index }).wait((annotations) => {
        annotations.forEach((annotation) => this.processAnnotation(annotation, page.index));
      }, ignore);
    }
  }

  private resolveMeasurementKind(annotation: PdfAnnotationObject): MeasurementKind | null {
    const customKind = this.getCustomMeasurementKind(annotation);
    if (customKind) return customKind;

    if (annotation.type === PdfAnnotationSubtype.LINE && annotation.intent === 'LineDimension') {
      return 'distance';
    }

    if (
      annotation.type === PdfAnnotationSubtype.POLYGON &&
      annotation.intent === 'PolygonDimension'
    ) {
      return 'area';
    }

    return null;
  }

  private getCustomMeasurementKind(annotation: PdfAnnotationObject): MeasurementKind | undefined {
    const custom = annotation.custom as MeasurementAnnotationCustom | undefined;
    const kind = custom?.measurement?.kind;
    if (kind === 'distance' || kind === 'area' || kind === 'perimeter' || kind === 'calibration') {
      return kind;
    }
    return undefined;
  }

  private computeDistanceMeasurement(annotation: PdfLineAnnoObject): MeasurementDisplayData | null {
    const pdfLength = this.measureLineLength(annotation);
    if (pdfLength <= 0) return null;

    const value = pdfLength / this.state.pointsPerUnit;
    const unit = this.state.unit;

    const context: MeasurementFormatContext = { annotation, kind: 'distance' };
    const formatted = this.formatDistance(value, unit, context);

    const measurement: MeasurementDisplayData = {
      kind: 'distance',
      scale: this.getScale(),
      label: `Distance: ${formatted}`,
      labelLines: [`Distance: ${formatted}`],
      distance: {
        raw: pdfLength,
        value,
        unit,
        formatted,
      },
      lastUpdated: new Date().toISOString(),
    };

    return measurement;
  }

  private computeAreaMeasurement(annotation: PdfPolygonAnnoObject): MeasurementDisplayData | null {
    if (annotation.vertices.length < 3) return null;

    const pdfArea = this.measurePolygonArea(annotation.vertices);
    const pdfPerimeter = this.measurePolygonPerimeter(annotation.vertices);
    if (pdfArea <= 0 || pdfPerimeter <= 0) return null;

    const areaValue = pdfArea / (this.state.pointsPerUnit * this.state.pointsPerUnit);
    const perimeterValue = pdfPerimeter / this.state.pointsPerUnit;

    const areaUnit = this.areaUnit(this.state.unit);
    const perimeterUnit = this.state.unit;

    const context: MeasurementFormatContext = { annotation, kind: 'area' };
    const areaFormatted = this.formatArea(areaValue, areaUnit, context);
    const perimeterFormatted = this.formatPerimeter(perimeterValue, perimeterUnit, {
      annotation,
      kind: 'perimeter',
    });

    const labelLines = [`Area: ${areaFormatted}`, `Perimeter: ${perimeterFormatted}`];

    const measurement: MeasurementDisplayData = {
      kind: 'area',
      scale: this.getScale(),
      label: labelLines.join(' · '),
      labelLines,
      area: {
        raw: pdfArea,
        value: areaValue,
        unit: areaUnit,
        formatted: areaFormatted,
      },
      perimeter: {
        raw: pdfPerimeter,
        value: perimeterValue,
        unit: perimeterUnit,
        formatted: perimeterFormatted,
      },
      lastUpdated: new Date().toISOString(),
    };

    return measurement;
  }

  private computePerimeterMeasurement(
    annotation: PdfPolygonAnnoObject,
  ): MeasurementDisplayData | null {
    if (annotation.vertices.length < 2) return null;

    const pdfPerimeter = this.measurePolygonPerimeter(annotation.vertices);
    if (pdfPerimeter <= 0) return null;

    const perimeterValue = pdfPerimeter / this.state.pointsPerUnit;
    const perimeterUnit = this.state.unit;

    const context: MeasurementFormatContext = { annotation, kind: 'perimeter' };
    const perimeterFormatted = this.formatPerimeter(perimeterValue, perimeterUnit, context);

    const measurement: MeasurementDisplayData = {
      kind: 'perimeter',
      scale: this.getScale(),
      label: `Perimeter: ${perimeterFormatted}`,
      labelLines: [`Perimeter: ${perimeterFormatted}`],
      perimeter: {
        raw: pdfPerimeter,
        value: perimeterValue,
        unit: perimeterUnit,
        formatted: perimeterFormatted,
      },
      lastUpdated: new Date().toISOString(),
    };

    return measurement;
  }

  private getScale() {
    return {
      unit: this.state.unit,
      pointsPerUnit: this.state.pointsPerUnit,
      precision: this.state.precision,
    };
  }

  private measureLineLength(annotation: PdfLineAnnoObject): number {
    const { start, end } = annotation.linePoints;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.hypot(dx, dy);
  }

  private measurePolygonPerimeter(vertices: { x: number; y: number }[]): number {
    if (vertices.length < 2) return 0;
    let sum = 0;
    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];
      sum += Math.hypot(next.x - current.x, next.y - current.y);
    }
    return sum;
  }

  private measurePolygonArea(vertices: { x: number; y: number }[]): number {
    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];
      area += current.x * next.y - next.x * current.y;
    }
    return Math.abs(area) / 2;
  }

  private areaUnit(unit: string): string {
    return `${unit}\u00B2`;
  }

  private formatDistance(value: number, unit: string, ctx: MeasurementFormatContext): string {
    if (this.config.formatDistance) {
      return this.config.formatDistance(value, unit, ctx);
    }
    return this.defaultFormat(value, unit);
  }

  private formatArea(value: number, unit: string, ctx: MeasurementFormatContext): string {
    if (this.config.formatArea) {
      return this.config.formatArea(value, unit, ctx);
    }
    return this.defaultFormat(value, unit);
  }

  private formatPerimeter(value: number, unit: string, ctx: MeasurementFormatContext): string {
    if (this.config.formatPerimeter) {
      return this.config.formatPerimeter(value, unit, ctx);
    }
    return this.defaultFormat(value, unit);
  }

  private formatValue(
    value: number,
    unit: string,
    kind: Exclude<MeasurementKind, 'calibration'>,
    context?: MeasurementFormatContext,
  ): string {
    const ctx: MeasurementFormatContext = context ?? { annotation: null, kind };

    switch (kind) {
      case 'distance':
        return this.formatDistance(value, unit, ctx);
      case 'area':
        return this.formatArea(value, unit, ctx);
      case 'perimeter':
        return this.formatPerimeter(value, unit, ctx);
    }
  }

  private defaultFormat(value: number, unit: string): string {
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: this.state.precision,
    });
    return `${formatted} ${unit}`.trim();
  }
}
