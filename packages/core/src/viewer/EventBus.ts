import type { ViewerEventMap, ViewerEventType } from "./types.js";

type Handler<K extends ViewerEventType> = (event: ViewerEventMap[K]) => void;

/**
 * 型付き pub/sub（domain-entities.md E4 / logical-components.md L2 Observer）。
 * emit はハンドラを登録順に同期実行する（BR-A-07）。ハンドラの例外は隔離される（BR-A-08）。
 */
export class EventBus {
  private readonly handlers: { [K in ViewerEventType]?: Handler<K>[] } = {};

  on<K extends ViewerEventType>(type: K, handler: Handler<K>): void {
    const list = (this.handlers[type] ??= []);
    list.push(handler);
  }

  off<K extends ViewerEventType>(type: K, handler: Handler<K>): void {
    const list = this.handlers[type];
    if (!list) return;
    const index = list.indexOf(handler);
    if (index !== -1) list.splice(index, 1);
  }

  once<K extends ViewerEventType>(type: K, handler: Handler<K>): void {
    const wrapped: Handler<K> = (event) => {
      this.off(type, wrapped);
      handler(event);
    };
    this.on(type, wrapped);
  }

  emit<K extends ViewerEventType>(type: K, event: ViewerEventMap[K]): void {
    const list = this.handlers[type];
    if (!list) return;
    for (const handler of [...list]) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[perisphere] handler for "${type}" threw an error:`, error);
      }
    }
  }

  clear(): void {
    for (const key of Object.keys(this.handlers) as ViewerEventType[]) {
      delete this.handlers[key];
    }
  }
}
