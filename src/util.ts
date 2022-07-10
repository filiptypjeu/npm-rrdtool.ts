import merge from "lodash/merge";
import { RrdtoolDatabase } from "./db";
import proc from "./proc";
import { RrdToolCreateOptions, RrdtoolData, RrdtoolDefinition, RrdtoolGraphInfo, RrdToolGraphOptions } from "./types";
import fs from "fs";

export const now = () => {
  return Math.floor(Date.now() / 1000);
};

export const open = <D extends RrdtoolData>(filename: string): RrdtoolDatabase<D> => {
  if (!fs.existsSync(filename)) {
    throw new Error(`File "${filename}" does not exist`);
  }

  return new RrdtoolDatabase<D>(filename);
};

export const create = async <D extends RrdtoolData>(filename: string, definitions: RrdtoolDefinition<D>[], options?: RrdToolCreateOptions): Promise<RrdtoolDatabase<D>> => {
  if (!fs.existsSync(filename)) {
    await proc.create(filename, definitions, options || {});
  }

  return new RrdtoolDatabase<D>(filename);
};

type Null = Record<string, never>;
type HasImage<T extends RrdToolGraphOptions> = T extends { filename: string } ? Null : Pick<Required<RrdtoolGraphInfo>, "image">;
type HasImageInfo<T extends RrdToolGraphOptions> = T extends { imageInfoFormat: string } ? Pick<Required<RrdtoolGraphInfo>, "image_info"> : Null;
type HasHW<T extends RrdToolGraphOptions> = T extends { verbose: true } ? Pick<Required<RrdtoolGraphInfo>, "image_width" | "image_height"> : T extends { imageInfoFormat: string } ? Null : Pick<Required<RrdtoolGraphInfo>, "image_width" | "image_height">;
type Print = Pick<RrdtoolGraphInfo, "print">; // XXX: Is actually known
type GPrint = Pick<RrdtoolGraphInfo, "legend" | "coords">; // XXX: Is actually known
type Rest = Omit<RrdtoolGraphInfo, "image" | "image_info" | "image_width" | "image_height" | "print" | "legend" | "coords">;
type HasRest<T extends RrdToolGraphOptions> = T extends { verbose: true } ? Print & GPrint & Required<Rest> : Print;
type GraphInfo<T extends RrdToolGraphOptions> = HasImage<T> & HasImageInfo<T> & HasHW<T> & HasRest<T>;

export const graph = async <T extends RrdToolGraphOptions>(definitions: string[], options?: T): Promise<GraphInfo<T>> => {
  return proc.graph(definitions, options || {}) as any;
}

type Value = number | string;
type ValueExtended = Value | Info | ValueExtended[];
interface Info {
  [key: string]: ValueExtended | undefined;
}
export const parse = (str: string): Info => {
  const obj = (props: string[], value: Value): ValueExtended => {
    if (props.length === 0) return value;

    const name = props[0];
    const index = Number(name);
    const v = props.length === 1 ? value : obj(props.slice(1), value);

    if (Number.isNaN(index)) {
      const o: Info = {};
      o[name] = v;
      return o;
    } else {
      const o = [];
      o[index] = v;
      return o;
    }
  };

  const getValue = (str: string): Value => {
    if (str.startsWith('"') && str.endsWith('"') && str.length > 1) {
      return str.slice(1, str.length - 1);
    }
    // XXX: Allow null values?
    return Number(str);
  };

  let info: Info = {};
  const re = /([\w\[\]\.]+) =(.+)/g;
  str.replace(re, (_: string, name: string, value: string) => {
    const v = getValue(value.trim());
    // XXX: Be able to exclude NaN and null values?
    const props = name.split(/[.\[\]]/).filter(s => s);
    info = merge(info, obj(props, v));
    return "";
  });

  return info;
};
