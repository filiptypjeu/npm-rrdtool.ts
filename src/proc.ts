import child_process from "child_process";
import { ConsolidationFunction, RrdToolCreateOptions, RrdtoolData, RrdtoolDatapoint, RrdtoolDefinition, RrdToolFetchOptions, RrdToolGraphOptions, RrdtoolInfo, RrdToolUpdateOptions } from "./types";
import { now, parseInfo } from "./util";

type Argument = string | number;
class RrdtoolError extends Error {
    public override name = "RrdtoolError";
}

export type Color = [number, number, number] | [number, number, number, number];
type ColorTag = "BACK" | "CANVAS" | "SHADEA" | "SHADEB" | "GRID" | "MGRID" | "FONT" | "AXIS" | "FRAME" | "ARROW";

export type Font = string | number | { size: number, name: string };
type FontTag = "DEFAULT" | "TITLE" | "AXIS" | "UNIT" | "LEGEND" | "WATERMARK";

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

type Option = `--${string}`;
class Opts {
  public res: Argument[] = [];

  public flag(flag: Option, value: boolean | undefined): void {
    if (!value) return;
    this.res.push(flag);
  }

  public form = <T>(option: Option, value: T | undefined, formatter: (v: T) => Argument): void => {
    if (value === undefined) return;
    this.res.push(option, formatter(value));
  }

  public push = (option: Option, v: Argument | undefined): void => this.form(option, v, v => v);

  public color = (type: ColorTag, value: Color | undefined): void => this.form("--color", value, color => `${type}#${color.map(c => c.toString(16).toUpperCase().padStart(2, "0")).join("")}`);

  public font = (type: FontTag, value: Font | undefined): void => this.form("--font", value, font => {
    let f: { name?: string, size?: number } = {};
    if (typeof font === "string") f.name = font;
    else if (typeof font === "number") f.size = font;
    else f = { ...font };
    return `${type}:${f.size || 0}:${f.name || ""}`;
  });

  public xGrid = (value: XGrid | undefined): void => this.form("--x-grid", value, x => {
    if (x === false) return "none";
    else if (typeof x === "string") return x;
    return `${x.base.unit}:${x.base.interval}:${x.major.unit}:${x.major.interval}:${x.labels.unit}:${x.labels.interval}:${x.labels.position}:${x.labels.format}`;
  });

  public yGrid = (value: YGrid | undefined): void => {
    if (value === "alternative") return this.flag("--alt-y-grid", true);
    this.form("--y-grid", value, y => {
      if (y === false) return "none";
      if (typeof y === "string") return y;
      return y.join(":");
    });
  }
}

const exec = async (args: Argument[]): Promise<string> =>
  new Promise((resolve, reject) => {
    const strArgs = args.map(a => a.toString());
    if (strArgs.find(s => !s)) throw new Error(`Found null argument(s): ${strArgs.map(s => `"${s}"`).join(", ")}`);

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
  o: RrdToolCreateOptions,
): Promise<void> => {
  const opts = new Opts();

  // rrdtool dosen't allow inserting a value onto the start date, so we decrease it by one so we can do that
  opts.form("--start", o.start, v => v - 1);
  opts.push("--step", o.step);
  opts.flag("--no-overwrite", !o.overwrite); // Opt-out needed
  opts.push("--template", o.templateFile);
  opts.push("--source", o.sourceFile);

  return exec(["create", filename, ...opts.res, ...definitions]).then();
};

const dump = async (filename: string): Promise<string> => {
  // XXX: output file and --header?
  return exec(["dump", filename]);
};

const fetch = async (
  filename: string,
  cf: ConsolidationFunction,
  o: RrdToolFetchOptions
): Promise<RrdtoolDatapoint[]> => {
  const opts = new Opts();

  // rrdtool counts timestamp very strange, hence the -1
  opts.form("--start", o.start, v => v - 1);
  opts.form("--end", o.end, v => v - 1);
  opts.push("--resolution", o.resolution);
  opts.flag("--align-start", o.alignStart);

  const data = await exec(["fetch", filename, cf, ...opts.res]);
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

const graph = async (definitions: string[], o: RrdToolGraphOptions): Promise<string> => {
  const opts = new Opts();

  opts.push("--width", o.output?.width);
  opts.push("--height", o.output?.height);
  opts.flag("--only-graph", o.output?.onlyGraph);
  opts.flag("--full-size-mode", o.output?.fullSizeMode);
  opts.push("--imgformat", o.output?.format);
  opts.flag("--interlaced", o.output?.interlaced);
  opts.flag("--lazy", o.output?.lazy);
  opts.push("--imginfo", o.output?.returnStringFormat);

  if (typeof o.border === "number") opts.push("--border", o.border);
  else {
    opts.push("--border", o.border?.width);
    opts.color("SHADEA", o.border?.colorNW);
    opts.color("SHADEB", o.border?.colorNW);
  }

  opts.push("--start", o.x?.start);
  opts.push("--end", o.x?.end);
  opts.push("--step", o.x?.step);
  opts.push("--week-fmt", o.x?.weekFormat);
  opts.font("AXIS", o.x?.font);

  opts.push("--vertical-label", o.y?.label);
  opts.push("--lower-limit", o.y?.lower);
  opts.push("--upper-limit", o.y?.upper);
  opts.flag("--rigid", o.y?.rigid);
  opts.flag("--allow-shrink", o.y?.allowShrink);
  if (o.y?.altAutoscale) {
    opts.flag("--alt-autoscale-min", o.y.altAutoscale[0]);
    opts.flag("--alt-autoscale-max", o.y.altAutoscale[1]);
  }
  opts.flag("--no-gridfit", o.y?.noGridFit);
  opts.push("--left-axis-formatter", o.y?.formatter);
  opts.push("--left-axis-format", o.y?.format);
  opts.flag("--logarithmic", o.y?.logarithmic);
  opts.push("--units-exponent", o.y?.unitsExponent);
  opts.push("--units-length", o.y?.unitsLength);
  opts.flag("--units=si", o.y?.siUnits);
  opts.form("--right-axis", o.y?.rightAxis, v => typeof v === "string" ? v : v.join(":"));
  opts.push("--right-axis-label", o.y?.rightLabel);
  opts.push("--right-axis-formatter", o.y?.rightFormatter);
  opts.push("--right-axis-format", o.y?.rightFormat);
  opts.font("UNIT", o.y?.font);
  opts.push("--base", o.y?.base);

  opts.xGrid(o.grid?.x);
  opts.yGrid(o.grid?.y);
  opts.color("GRID", o.grid?.baseColor);
  opts.color("MGRID", o.grid?.majorColor);
  opts.color("AXIS", o.grid?.axisColor);
  opts.color("ARROW", o.grid?.arrowColor);
  opts.form("--grid-dash", o.grid?.dashed, v => v.join(":"));
  
  opts.color("FONT", o.text?.color);
  opts.font("DEFAULT", o.text?.defaultFont);
  opts.push("--font-render-mode", o.text?.fontRenderMode);
  opts.push("--font-smoothing-threshold", o.text?.fontSmoothingThreshold);
  opts.flag("--pango-markup", o.text?.usePangoMarkup);
  opts.push("--tabwidth", o.text?.tabWidth);

  if (o.legend === false) opts.flag("--no-legend", true);
  else {
    opts.flag("--force-rules-legend", o.legend?.forceRulesLegend);
    // opts.flag(`--legend-position=${o.legend?.position}`, o.legend?.position);
    // opts.flag(`--legend-direction=${o.legend?.direction}`, o.legend?.direction);
    opts.color("FRAME", o.legend?.iconFrameColor);
    opts.font("LEGEND", o.legend?.font);
    opts.flag("--dynamic-labels", o.legend?.dynamicIcons);
  }

  if (typeof o.title === "string") opts.push("--title", o.title);
  else {
    opts.push("--title", o.title?.text);
    opts.font("TITLE", o.title?.font);
  }

  if (typeof o.watermark === "string") opts.push("--watermark", o.watermark);
  else {
    opts.push("--watermark", o.watermark?.text);
    opts.font("WATERMARK", o.watermark?.font);
  }

  opts.color("BACK", o.graph?.backgroundColor);
  opts.color("CANVAS", o.graph?.canvasColor);
  opts.push("--zoom", o.graph?.zoomFactor);
  opts.push("--graph-render-mode", o.graph?.renderMode);
  opts.flag("--slope-mode", o.graph?.slopeMode);
  opts.flag("--use-nan-for-all-missing-data", o.graph?.useNanForMissingData);

  return exec([
    o.verbose ? "graphv" : "graph",
    o.output?.filename || "-",
    ...opts.res,
    ...definitions,
  ]);
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

const update = async (filename: string, values: Partial<RrdtoolData>, o: RrdToolUpdateOptions): Promise<string> => {
  const template: string[] = [];
  // "N" as the timestamp is also possible
  const data: number[] = [o.timestamp || now()];

  for (const key of Object.keys(values)) {
    const v = values[key]
    if (v === undefined) continue;
    data.push(v);
    template.push(key);
  }

  const opts: Argument[] = ["--template", template.join(":")]
  if (o.skipPastUpdates) opts.push("--skip-past-updates");

   return exec([o.verbose ? "updatev" : "update", filename, ...opts, data.join(":")]);
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
