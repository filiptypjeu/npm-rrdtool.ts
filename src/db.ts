import proc from "./proc";
import Queue from "queue";
import EventEmitter from "events";
import { ConsolidationFunction, RrdtoolData, RrdtoolDatapoint, RrdToolFetchOptions, RrdtoolInfo, RrdToolUpdateOptions } from "./types";

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

  public dump(): Promise<string> {
    return this._addToQueue(() => proc.dump(this.filename));
  };

  public fetch(cf: ConsolidationFunction, options?: RrdToolFetchOptions): Promise<RrdtoolDatapoint<D>[]> {
    return this._addToQueue(() => proc.fetch(this.filename, cf, options));
  }

  public info(): Promise<RrdtoolInfo<keyof D & string>> {
    return this._addToQueue(() => proc.info(this.filename));
  };

  public async update(values: Partial<D>, options?: RrdToolUpdateOptions): Promise<void> {
    return this._addToQueue(() => proc.update(this.filename, values, options));
  }
}
