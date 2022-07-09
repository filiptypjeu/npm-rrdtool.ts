import merge from "lodash/merge";
import { RrdtoolDatabase } from "./db";
import proc from "./proc";
import { RrdToolCreateOptions, RrdtoolData, RrdtoolDefinition, RrdtoolInfo } from "./types";
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

type Value = number | string | null;

export const parseInfo = (str: string): RrdtoolInfo => {
  const obj = (props: string[], value: Value): any => {
    if (props.length === 0) return value;

    const name = props[0];
    const index = Number(name);
    const v = props.length === 1 ? value : obj(props.slice(1), value);

    if (Number.isNaN(index)) {
      const o: any = {};
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
    if (str.toLowerCase() === "null") return null;
    return Number(str);
  };

  let info: any = { ds: [], rra: [] };
  const re = /([\w\[\]\.]+) =(.+)/g;
  str.replace(re, (_: string, name: string, value: string) => {
    const v = getValue(value.trim());
    // XXX: Be able to exclude NaN and null values?
    const props = name.split(/[.\[\]]/).filter(s => s);
    info = merge(info, obj(props, v));
    return "";
  });

  // Change data sources into an array
  info["ds"] = [...Object.keys(info["ds"])].map(k => ({ name: k, ...info["ds"][k] }));
  return info;
};
