import type { InputIntent, InputSource } from "./types.js";

/**
 * 複数の `InputSource` を集約する（domain-entities.md E2、`logical-components.md` L2）。
 * 組み込み3種（Pointer/Touch/Keyboard）と `registerInputSource` によるカスタム入力源を
 * 同一の `target`/`onIntent` で `attach` する（BR-D-01/02）。
 */
export class InputManager {
  private readonly sources: InputSource[] = [];

  constructor(
    private readonly target: HTMLElement,
    private readonly onIntent: (intent: InputIntent) => void,
  ) {}

  register(source: InputSource): void {
    source.attach(this.target, this.onIntent);
    this.sources.push(source);
  }

  /** 破棄時、組み込み・登録済みを問わず全 `InputSource` の `detach()` を呼ぶ（BR-D-03）。 */
  detachAll(): void {
    for (const source of this.sources) {
      source.detach();
    }
    this.sources.length = 0;
  }
}
