import proc from "./proc";

import async, { QueueObject } from "async";
import EventEmitter from "events";
import { ConsolidationFunction, RrdtoolData, RrdtoolDatapoint, RrdToolFetchOptions, RrdtoolInfo, RrdToolUpdateOptions } from "./types";

enum M {
  DUMP,
  FETCH,
  INFO,
  UPDATE,
}

interface QBase<T> {
  method: M;
  cb: (err: Error | null, result: T | Promise<T>) => void;
}
interface QUpdate extends QBase<void> {
  method: M.UPDATE;
  values: Partial<RrdtoolData>;
  options?: RrdToolUpdateOptions;
}
interface QFetch extends QBase<RrdtoolDatapoint[]> {
  method: M.FETCH;
  cf: ConsolidationFunction;
  options?: RrdToolFetchOptions;
}
interface QInfo extends QBase<RrdtoolInfo> {
  method: M.INFO;
}
interface QDump extends QBase<string> {
  method: M.DUMP;
}

type Q = QDump | QFetch | QInfo | QUpdate;

type Callback = (err?: Error | null) => void;

export class RrdtoolDatabase<D extends RrdtoolData> extends EventEmitter {
  private m_dataSourceNames: (keyof D & string)[] = [];
  private queue: QueueObject<Q>;
  private readonly errorCallback: Callback;

  constructor(public readonly filename: string, errorCallback?: Callback) {
    super();
    this.errorCallback = errorCallback || (err => this.emit("error", err));
    this.queue = async.queue(this._worker.bind(this), 1);
    this.queue.pause();
    this._load(filename);
  }

  private async _load(filename: string) {
    const info = await proc.info(filename);
    this.m_dataSourceNames = info.ds.map(ds => ds.name);
    this.queue.resume();
  }

  private _addToQueue(q: Q): void {
    this.queue.push(q, this.errorCallback);
  }

  private _callback<T>(resolve: (result: T) => void, reject: (reason: any) => void) {
    return (err: Error | null, result: T) => {
      if (err) reject(err);
      resolve(result);
    }
  }

  private _worker(q: Q) {
    switch (q.method) {
      case M.UPDATE: {
        const unknownKeys = Object.keys(q.values).filter(k => !this.m_dataSourceNames.includes(k));

        if (unknownKeys.length > 0) {
            return q.cb(new Error(`Unknown data source(s): ${unknownKeys.join(", ")}`));
        }

        q.cb(null, proc.update(this.filename, q.values, q.options));
        break;
      }

      case M.INFO: {
        q.cb(null, proc.info(this.filename));
        break;
      }

      case M.FETCH: {
        q.cb(null, proc.fetch(this.filename, q.cf, q.options));
        break;
      }

      case M.DUMP:
        q.cb(null, proc.dump(this.filename));
        break;
    }
  }

  public dump(): Promise<string> {
    return new Promise((resolve, reject) => {
      const cb = this._callback(resolve, reject);
      this._addToQueue({ method: M.DUMP, cb });
    });
  };

  public fetch(cf: ConsolidationFunction, options?: RrdToolFetchOptions): Promise<RrdtoolDatapoint<D>[]> {
    return new Promise((resolve, reject) => {
      const cb = this._callback(resolve, reject);
      this._addToQueue({
        method: M.FETCH,
        cb,
        cf,
        options,
      });
    });
  }

  public info(): Promise<RrdtoolInfo<keyof D & string>> {
    return new Promise((resolve, reject) => {
      const cb = this._callback(resolve, reject);
      this._addToQueue({ method: M.INFO, cb });
    });
  };

  public async update(values: Partial<D>, options?: RrdToolUpdateOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const cb = this._callback(resolve, reject);
      this._addToQueue({
        method: M.UPDATE,
        cb,
        values,
        options,
      });
    });
  }
}
