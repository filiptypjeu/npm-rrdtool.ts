type Timestamp = number;

export interface RrdtoolData {
  [key: string]: number;
}
export interface RrdtoolDatapoint<D extends RrdtoolData = any> {
    timestamp: Timestamp;
    values: Partial<D>;
}

export type Duration = number | `${number}${"s" | "m" | "h" | "d" | "w" | "M" | "y"}`;

type DataSourceType_ = "GAUGE" | "COUNTER" | "DCOUNTER" | "DERIVE" | "DDERIVE" | "ABSOLUTE";
export type DataSourceType = DataSourceType_ | "COMPUTE";

// DS:ds-name:{GAUGE | COUNTER | DERIVE | DCOUNTER | DDERIVE | ABSOLUTE}:heartbeat:min:max
type DataSource_<D extends RrdtoolData> = `DS:${keyof D & string}:${DataSourceType_}:${Duration}:${number}:${number}`;

// XXX: Enhance rpn-expression type
// DS:ds-name:COMPUTE:rpn-expression
type DataSourceCompute<D extends RrdtoolData> = `DS:${keyof D & string}:COMPUTE:${string}`;

/**
 * https://oss.oetiker.ch/rrdtool/doc/rrdcreate.en.html
 *
 * Data sources:
 *  - `"DS:ds-name:{GAUGE | COUNTER | DERIVE | DCOUNTER | DDERIVE | ABSOLUTE}:heartbeat:min:max"`
 *  - `"DS:ds-name:COMPUTE:rpn-expression"`
 *
 * Variable types:
 *  - `ds-name`: string
 *  - `heartbeat`: number (seconds) OR duration string
 *  - `min`: number (data range)
 *  - `max`: number (data range)
 *  - `rpn-expression`: string
 */
export type DataSource<D extends RrdtoolData = any> = DataSource_<D> | DataSourceCompute<D>;

export type ConsolidationFunction = "AVERAGE" | "MIN" | "MAX" | "LAST";

// RRA:{AVERAGE | MIN | MAX | LAST}:xff:steps:rows
type RoundRobinArchive_ = `RRA:${ConsolidationFunction}:${number}:${Duration}:${Duration}`;

// RRA:{HWPREDICT | MHWPREDICT}:rows:alpha:beta:seasonal period[:rra-num]
type RoundRobinArchiveHWPredict = `RRA:${"HWPREDICT" | "MHWPREDICT"}:${Duration}:${number}:${number}:${Duration}${
  | ""
  | `:${number}`}`;

// RRA:{SEASONAL | DEVSEASONAL}:seasonal period:gamma:rra-num[:smoothing-window]
type RoundRobinArchiveSeasonal = `RRA:${"SEASONAL" | "DEVSEASONAL"}:${Duration}:${number}:${number}${
  | ""
  | `:${number}`}`;

// RRA:DEVPREDICT:rows:rra-num
type RoundRobinArchiveDevPredict = `RRA:DEVPREDICT:${Duration}:${number}`;

// RRA:FAILURES:rows:threshold:window length:rra-num
type RoundRobinArchiveFailures = `RRA:FAILURES:${Duration}:${number}:${number}:${number}`;

/**
 * https://oss.oetiker.ch/rrdtool/doc/rrdcreate.en.html
 *
 * Round robin archives:
 *  - `"RRA:{AVERAGE | MIN | MAX | LAST}:xff:steps:rows"`
 *  - `"RRA:HWPREDICT:rows:alpha:beta:seasonal period[:rra-num]"`
 *  - `"RRA:MHWPREDICT:rows:alpha:beta:seasonal period[:rra-num]"`
 *  - `"RRA:SEASONAL:seasonal period:gamma:rra-num[:smoothing-window]"`
 *  - `"RRA:DEVSEASONAL:seasonal period:gamma:rra-num[:smoothing-window]"`
 *  - `"RRA:DEVPREDICT:rows:rra-num"`
 *  - `"RRA:FAILURES:rows:threshold:window length:rra-num"`
 *
 * Variable types:
 *  - `xff`: number (between 0 and 1)
 *  - `steps`: number (seconds) OR duration string
 *  - `rows`: number (seconds) OR duration string
 *  - `alpha`: number (between 0 and 1)
 *  - `beta`: number (between 0 and 1)
 *  - `gamma`: number (between 0 and 1)
 *  - `seasonal period`: number (seconds) OR duration string
 *  - `rra-num`: number (1-based RRA index)
 *  - `smoothing-window`: number (between 0 and 1)
 */
export type RoundRobinArchive =
  | RoundRobinArchive_
  | RoundRobinArchiveHWPredict
  | RoundRobinArchiveSeasonal
  | RoundRobinArchiveDevPredict
  | RoundRobinArchiveFailures;

export type RrdtoolDefinition<D extends RrdtoolData = any> = DataSource<D> | RoundRobinArchive;

// XXX: Probably incomplete
export interface RrdtoolInfo<D extends RrdtoolData = any> {
  filename: string;
  rrd_version: string;
  step: number;
  last_update: Timestamp;
  header_size: number;
  ds: {
    name: keyof D & string;
    index: number;
    type: DataSourceType;
    minimal_heartbeat: number;
    min: number;
    max: number;
    last_ds: string;
    value: number;
    unknown_sec: number;
  }[];
  rra: {
    cf: ConsolidationFunction;
    rows: number;
    cur_row: number;
    pdp_per_row: number;
    xff: number;
    cdp_prep: {
      value: number;
      unknown_datapoints: number;
    }[];
  }[];
}

export interface RrdToolCreateOptions {
  start?: Timestamp;
  step?: Duration;
  overwrite?: boolean;
  templateFile?: string;
  sourceFile?: string;
}

type Unit = "SECOND" | "MINUTE" | "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";
// G = base grid, M = major grid, L = labels
// G unit:G interval:M unit:M interval:L unit:L interval:L position:L strftime
type XGrid = `${Unit}:${number}:${Unit}:${number}:${Unit}:${number}:${number}:${string}`;
type AxisFormatter = "numeric" | "timestamp" | "duration";
export type Color = [number, number, number] | [number, number, number, number];
export type Font = string | number | { size: number, name: string };

export interface RrdToolGraphOptions {
  output?: {
    width?: number;
    height?: number;
    onlyGraph?: boolean;
    fullSizeMode?: boolean;
    lazy?: boolean;
    returnStringFormat?: string; // XXX: printfstr
    format?: "PNG" | "SVG" | "EPS" | "PDF" | "XML" | "XMLENUM" | "JSON" | "JSONTIME" | "CSV" | "TSV" | "SSV";
    interlaced?: boolean;
  };
  border?: number | {
    width?: number;
    colorNW?: Color;
    colorSE?: Color;
  };
  x?: {
    start?: Timestamp;
    end?: Timestamp;
    step?: number; // XXX: Duration?
    // Default: "Week %V"
    weekFormat?: string; // XXX: strftime format
    font?: Font;
  };
  y?: {
    label?: string;
    lower?: number;
    upper?: number;
    rigid?: boolean;
    allowShrink?: boolean;
    // [min, max] or both
    altAutoscale?: [boolean, boolean];
    noGridFit?: boolean;
    formatter?: AxisFormatter;
    format?: string;
    logarithmic?: boolean;
    unitsExponent?: number;
    unitsLength?: number;
    siUnits?: boolean;
    // Tied to the left axis via [scale, shift]
    rightAxis?: [number, number];
    rightLabel?: string;
    rightFormatter?: AxisFormatter;
    rightFormat?: string;
    base?: number;
    font?: Font;
  };
  grid?: {
    x?: XGrid | false;
    // [grid step, label factor]
    y?: [number, number] | false | "alternative";
    baseColor?: Color;
    majorColor?: Color;
    axisColor?: Color;
    arrowColor?: Color;
    // [on, off]
    dashed?: [number, number];
  };
  text?: {
    color?: Color;
    defaultFont?: Font;
    fontRenderMode?: "normal" | "light" | "mono";
    fontSmoothingThreshold?: number;
    tabWidth?: number;
    usePangoMarkup?: boolean;
  };
  legend?: {
    forceRulesLegend?: boolean;
    font?: Font;
    position?: "north" | "south" | "west" | "east";
    direction?: "topdown" | "bottomup" | "bottomup2";
  } | false;
  title?: string | {
    text: string;
    font?: Font;
  };
  watermark?: string | {
    text: string;
    font?: Font;
  };
  graph?: { // XXX: Not the best fit
    backgroundColor?: Color;
    canvasColor?: Color;
    renderMode?: "normal" | "mono";
    slopeMode?: boolean;
    useNanForMissingData?: boolean;
    zoomFactor?: number;
  };
  frameColor?: Color; // XXX: What is this?
  dynamicLabels?: boolean; // XXX: What is this?
}

export interface RrdToolUpdateOptions {
  timestamp?: Timestamp;
  verbose?: boolean;
  skipPastUpdates?: boolean;
}

export interface RrdToolFetchOptions {
  start?: Timestamp; // XXX: Allow at-time notation?
  end?: Timestamp;
  resolution?: Duration;
  alignStart?: boolean;
}
