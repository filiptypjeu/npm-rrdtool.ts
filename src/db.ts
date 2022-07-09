import proc from "./proc";
import Queue from "queue";
import EventEmitter from "events";
import { ConsolidationFunction, RrdtoolData, RrdtoolDatapoint, RrdToolFetchOptions, RrdToolGraphOptions, RrdtoolInfo, RrdToolUpdateOptions } from "./types";

export class RrdtoolDatabase<D extends RrdtoolData> extends EventEmitter {
  private m_queue: Queue;

  constructor(public readonly filename: string) {
    super();
    this.m_queue = new Queue({ concurrency: 1, autostart: true });
  }

  private async _addToQueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const worker = () => task().then(res => resolve(res)).catch(e => reject(e));
      this.m_queue.push(worker);
    });
  }

  public async dump(): Promise<string> {
    return this._addToQueue(() => proc.dump(this.filename));
  };

  public async fetch(cf: ConsolidationFunction, options?: RrdToolFetchOptions): Promise<RrdtoolDatapoint<D>[]> {
    return this._addToQueue(() => proc.fetch(this.filename, cf, options));
  }

  public async graph(options?: RrdToolGraphOptions): Promise<string> {
    return this._addToQueue(() => proc.graph(this.filename, options));
  }

  public async info(): Promise<RrdtoolInfo<D>> {
    return this._addToQueue(() => proc.info(this.filename));
  };

  public async update(values: Partial<D>, options?: RrdToolUpdateOptions): Promise<void> {
    return this._addToQueue(() => proc.update(this.filename, values, options));
  }
}
