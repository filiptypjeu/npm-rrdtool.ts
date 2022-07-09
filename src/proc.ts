import child_process from "child_process";
import { ConsolidationFunction, RrdToolCreateOptions, RrdtoolData, RrdtoolDatapoint, RrdtoolDefinition, RrdToolFetchOptions, RrdToolGraphOptions, RrdtoolInfo, RrdToolUpdateOptions } from "./types";
import { now, parseInfo } from "./util";

type Argument = string | number;
class RrdtoolError extends Error {
    public override name = "RrdtoolError";
}

export type Color = [number, number, number] | [number, number, number, number];
type ColorTag = "BACK" | "CANVAS" | "SHADEA" | "SHADEB" | "GRID" | "MGRID" | "FONT" | "AXIS" | "FRAME" | "ARROW";
const color = (type: ColorTag, color: Color): string[] => [
  "--color",
  `${type}#${color.map(c => c.toString(16).toUpperCase().padStart(2, "0")).join("")}`
];

export type Font = string | number | { size: number, name: string };
type FontTag = "DEFAULT" | "TITLE" | "AXIS" | "UNIT" | "LEGEND" | "WATERMARK";
const font = (type: FontTag, font: Font): string[] => {
  let f: { name?: string, size?: number } = {};
  if (typeof font === "string") f.name = font;
  else if (typeof font === "number") f.size = font;
  else f = { ...font };
  return [
    "--font",
    `${type}:${f.size || 0}:${f.name || ""}`
  ];
}

export type Unit = "SECOND" | "MINUTE" | "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";
interface UnitInterval {
  unit: Unit;
  interval: number;
}
interface LabelUnitInterval extends UnitInterval {
  position: number;
  format: string; // XXX: strftime format string
}
// G = base grid, M = major grid, L = labels
// G unit:G interval:M unit:M interval:L unit:L interval:L position:L strftime
export type XGrid = false | `${Unit}:${number}:${Unit}:${number}:${Unit}:${number}:${number}:${string}` | {
  base: UnitInterval;
  major: UnitInterval;
  labels: LabelUnitInterval;
};

// [grid step, label factor]
export type YGrid = `${number}:${number}` | [number, number] | false | "alternative";

const exec = async (args: Argument[]): Promise<string> =>
  new Promise((resolve, reject) => {
    const strArgs = args.map(a => a.toString());
    const p = child_process.spawn("rrdtool", strArgs, { env: { LANG: "C" } });

    const stdout: any[] = [];
    const stderr: any[] = [];
    p.stdout.on("data", chunk => stdout.push(chunk));
    p.stderr.on("data", chunk => stderr.push(chunk));

    p.on("close", code => {
      if (code !== 0) {
        const str = Buffer.concat(stderr).toString();
        const err = new RrdtoolError(str.replace(/^ERROR:/, "").trim());

        return reject(err);
      }

      return resolve(Buffer.concat(stdout).toString());
    });
  });

const create = async (
  filename: string,
  definitions: RrdtoolDefinition[],
  o?: RrdToolCreateOptions,
): Promise<void> => {
  const opts: Argument[] = [];

  // rrdtool dosen't allow inserting a value onto
  // the start date. Decrese it by one so we can do that.
  if (o?.start) opts.push("--start", o.start - 1);
  if (o?.step) opts.push("--step", o.step);
  if (!o?.overwrite) opts.push("--no-overwrite");
  if (o?.templateFile) opts.push("--template", o.templateFile);
  if (o?.sourceFile) opts.push("--source", o.sourceFile);

  return exec(["create", filename, ...opts, ...definitions]).then();
};

const dump = async (filename: string): Promise<string> => {
  // XXX: output file and --header?
  return exec(["dump", filename]);
};

const fetch = async (
  filename: string,
  cf: ConsolidationFunction,
  o?: RrdToolFetchOptions
): Promise<RrdtoolDatapoint[]> => {
  const opts: Argument[] = [];

  // rrdtool counts timestamp very strange, hence the -1
  if (o?.start) opts.push("--start", o.start - 1);
  if (o?.end) opts.push("--end", o.end - 1);
  if (o?.resolution) opts.push("--resolution", o.resolution);
  if (o?.alignStart) opts.push("--align-start");

  const data = await exec(["fetch", filename, cf, ...opts]);
  const rows = data.trim().split("\n");
  const header = rows[0].trim().split(/ +/);

  const parseRow = (row: string): RrdtoolDatapoint => {
    const [t, d] = row.split(":");

    return {
      timestamp: Number(t),
      values: d.trim().split(/ +/).reduce<Record<string, number>>((p, c, i) => {
        const n = Number(c);
        if (!Number.isNaN(n)) {
          p[header[i]] = n;
        }
        return p;
      }, {}),
    };
  };

  return rows.slice(2).map(parseRow);
};

const graph = async (filename: string, o?: RrdToolGraphOptions): Promise<string> => {
  const opts: Argument[] = [];

  if (o?.output?.width) opts.push("--width", o.output.width);
  if (o?.output?.height) opts.push("--height", o.output.height);
  if (o?.output?.onlyGraph) opts.push("--only-graph");
  if (o?.output?.fullSizeMode) opts.push("--full-size-mode");
  if (o?.output?.format) opts.push("--imgformat", o.output.format);
  if (o?.output?.interlaced) opts.push("--interlaced");
  if (o?.output?.lazy) opts.push("--lazy");
  if (o?.output?.returnStringFormat) opts.push("--imginfo", o.output.returnStringFormat);

  if (typeof o?.border === "number") opts.push("--border", o.border);
  else {
    if (o?.border?.width) opts.push("--border", o.border.width);
    if (o?.border?.colorNW) opts.push(...color("SHADEA", o.border.colorNW));
    if (o?.border?.colorNW) opts.push(...color("SHADEB", o.border.colorNW));
  }

  if (o?.x?.start) opts.push("--start", o.x.start);
  if (o?.x?.end) opts.push("--end", o.x.end);
  if (o?.x?.step) opts.push("--step", o.x.step);
  if (o?.x?.weekFormat) opts.push("--week-fmt", o.x.weekFormat);
  if (o?.x?.font) opts.push(...font("AXIS", o.x.font));

  if (o?.y?.label) opts.push("--vertical-label", o.y.label);
  if (o?.y?.lower) opts.push("--lower-limit", o.y.lower);
  if (o?.y?.upper) opts.push("--upper-limit", o.y.upper);
  if (o?.y?.rigid) opts.push("--rigid");
  if (o?.y?.allowShrink) opts.push("--allow-shrink");
  if (o?.y?.altAutoscale) {
    if (o.y.altAutoscale[0]) opts.push("--alt-autoscale-min");
    if (o.y.altAutoscale[1]) opts.push("--alt-autoscale-max");
  }
  if (o?.y?.noGridFit) opts.push("--no-gridfit");
  if (o?.y?.formatter) opts.push("--left-axis-formatter", o.y.formatter);
  if (o?.y?.format) opts.push("--left-axis-format", o.y.format);
  if (o?.y?.logarithmic) opts.push("--logarithmic");
  if (o?.y?.unitsExponent) opts.push("--units-exponent", o.y.unitsExponent);
  if (o?.y?.unitsLength) opts.push("--units-length", o.y.unitsLength);
  if (o?.y?.siUnits) opts.push("--units=si");
  if (o?.y?.rightAxis) opts.push("--right-axis", o.y.rightAxis.join(":"));
  if (o?.y?.rightLabel) opts.push("--right-axis-label", o.y.rightLabel);
  if (o?.y?.rightFormatter) opts.push("--right-axis-formatter", o.y.rightFormatter);
  if (o?.y?.rightFormat) opts.push("--right-axis-format", o.y.rightFormat);
  if (o?.y?.font) opts.push(...font("UNIT", o.y.font));
  if (o?.y?.base) opts.push("--base", o.y.base);

  return exec(["graph", filename, ...opts]);
};

const info = async (filename: string): Promise<RrdtoolInfo<any>> => {
  // XXX: --noflush?
  const str = await exec(["info", filename]);
  return parseInfo(str);
};

const last = async (filename: string): Promise<number> => {
  return Number(await exec(["last", filename]));
};

// XXX: lastUpdate

const update = async (filename: string, values: Partial<RrdtoolData>, o?: RrdToolUpdateOptions): Promise<void> => {
  const template: string[] = [];
  // "N" as the timestamp is also possible
  const data: number[] = [o?.timestamp || now()];

  for (const key of Object.keys(values)) {
    const v = values[key]
    if (v === undefined) continue;
    data.push(v);
    template.push(key);
  }

  const opts: Argument[] = ["--template", template.join(":")]
  if (o?.skipPastUpdates) opts.push("--skip-past-updates");

  return exec([o?.verbose ? "updatev" : "update", filename, ...opts, data.join(":")]).then();
};

export default {
  create,
  dump,
  fetch,
  graph,
  info,
  last,
  update,
};
