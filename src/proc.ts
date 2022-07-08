import child_process from "child_process";
import { ConsolidationFunction, RrdToolCreateOptions, RrdtoolData, RrdtoolDatapoint, RrdtoolDefinition, RrdToolFetchOptions, RrdtoolInfo, RrdToolUpdateOptions } from "./types";
import { parseInfo } from "./util";

type Argument = string | number;
class RrdtoolError extends Error {
    public override name = "RrdtoolError";
}

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

interface InfoDS {
  name: string;
  type: string;
}

interface InfoRRA {
  cf: string;
}

export interface Info {
  ds: InfoDS[];
  rra: InfoRRA[];
}

export type Data = Record<string, number>;
export interface Datapoint {
  ts: number;
  values: Data;
}

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
      values: d.trim().split(/ +/).reduce<Data>((p, c, i) => {
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

// XXX: graph

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
  const data: (number | string)[] = [o?.timestamp || "N"]; // XXX: "N" if no timestamp?

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
  info,
  last,
  update,
};
