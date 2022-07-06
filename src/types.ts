type Timestamp = number;
export type Duration = number | `${number}${"s" | "m" | "h" | "d" | "w" | "M" | "y"}`;

type DataSourceType_ = "GAUGE" | "COUNTER" | "DCOUNTER" | "DERIVE" | "DDERIVE" | "ABSOLUTE";
export type DataSourceType = DataSourceType_ | "COMPUTE";

// DS:ds-name:{GAUGE | COUNTER | DERIVE | DCOUNTER | DDERIVE | ABSOLUTE}:heartbeat:min:max
type DataSource_<N extends string = any> = `DS:${N}:${DataSourceType_}:${Duration}:${number}:${number}`;

// XXX: Enhance rpn-expression type
// DS:ds-name:COMPUTE:rpn-expression
type DataSourceCompute<N extends string = any> = `DS:${N}:COMPUTE:${string}`;

/**
 * https://oss.oetiker.ch/rrdtool/doc/rrdcreate.en.html
 *
 * Data sources:
 *  - `"DS:ds-name:{GAUGE | COUNTER | DERIVE | DCOUNTER | DDERIVE | ABSOLUTE}:heartbeat:min:max"`
 *  - `"DS:ds-name:COMPUTE:rpn-expression"`
 *
 * Variable types:
 *  - `ds-name`: string
 *  - `heartbeat`: number (seconds)
 *  - `min`: number (data range)
 *  - `max`: number (data range)
 *  - `rpn-expression`: string
 */
export type DataSource<N extends string = any> = DataSource_<N> | DataSourceCompute<N>;

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
 *  - `steps`: number
 *  - `rows`: number
 *  - `alpha`: number (between 0 and 1)
 *  - `beta`: number (between 0 and 1)
 *  - `gamma`: number (between 0 and 1)
 *  - `seasonal period`: number
 *  - `rra-num`: number (1-based RRA index)
 *  - `smoothing-window`: number (between 0 and 1)
 */
export type RoundRobinArchive =
  | RoundRobinArchive_
  | RoundRobinArchiveHWPredict
  | RoundRobinArchiveSeasonal
  | RoundRobinArchiveDevPredict
  | RoundRobinArchiveFailures;

export type RrdtoolDefinition<D extends RrdtoolData = any> = DataSource<keyof D & string> | RoundRobinArchive;

export interface RrdtoolData {
  [key: string]: number;
}
export interface RrdtoolDatapoint<D extends RrdtoolData = any> {
    timestamp: Timestamp;
    values: Partial<D>;
}

// XXX: Probably incomplete
export interface RrdtoolInfo<N extends string = any> {
  filename: string;
  rrd_version: string;
  step: number;
  last_update: Timestamp;
  header_size: number;
  ds: {
    name: N;
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
  start?: Timestamp,
  step?: Duration,
  overwrite?: boolean,
  templateFile?: string,
  sourceFile?: string,
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
