export type ReadingPosition = number | null;

type ReadingPositionOperation = {
  readingTextId: string;
  paragraphIndex: ReadingPosition;
};

type TimerHandle = ReturnType<typeof setTimeout>;

type ReadingPositionSyncOptions = {
  save: (
    readingTextId: string,
    paragraphIndex: ReadingPosition,
  ) => Promise<unknown>;
  onError: (error: unknown, operation: ReadingPositionOperation) => void;
  onSaved?: (operation: ReadingPositionOperation) => void;
  debounceMs?: number;
  retryDelayMs?: number;
  delay?: (milliseconds: number) => Promise<void>;
  setTimer?: (callback: () => void, milliseconds: number) => TimerHandle;
  clearTimer?: (timer: TimerHandle) => void;
};

const NO_POSITION = Symbol("no-position");

const positionsAreEqual = (
  left: ReadingPosition | typeof NO_POSITION,
  right: ReadingPosition,
): boolean => left !== NO_POSITION && left === right;

const defaultDelay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

export class ReadingPositionSync {
  private readonly save: ReadingPositionSyncOptions["save"];
  private readonly onError: ReadingPositionSyncOptions["onError"];
  private readonly onSaved?: ReadingPositionSyncOptions["onSaved"];
  private readonly debounceMs: number;
  private readonly retryDelayMs: number;
  private readonly delay: (milliseconds: number) => Promise<void>;
  private readonly setTimer: NonNullable<ReadingPositionSyncOptions["setTimer"]>;
  private readonly clearTimer: NonNullable<
    ReadingPositionSyncOptions["clearTimer"]
  >;
  private activeReadingTextId: string | null = null;
  private lastScheduledPosition: ReadingPosition | typeof NO_POSITION =
    NO_POSITION;
  private failedOperation: ReadingPositionOperation | null = null;
  private debounceTimer: TimerHandle | null = null;
  private operationChain: Promise<void> = Promise.resolve();

  constructor(options: ReadingPositionSyncOptions) {
    this.save = options.save;
    this.onError = options.onError;
    this.onSaved = options.onSaved;
    this.debounceMs = options.debounceMs ?? 700;
    this.retryDelayMs = options.retryDelayMs ?? 350;
    this.delay = options.delay ?? defaultDelay;
    this.setTimer = options.setTimer ?? setTimeout;
    this.clearTimer = options.clearTimer ?? clearTimeout;
  }

  setActiveText(
    readingTextId: string | null,
    confirmedPosition: ReadingPosition = null,
  ): void {
    this.cancelScheduled();
    this.activeReadingTextId = readingTextId;
    this.lastScheduledPosition =
      readingTextId === null ? NO_POSITION : confirmedPosition;
    this.failedOperation = null;
  }

  schedule(paragraphIndex: number): void {
    if (
      !this.activeReadingTextId ||
      positionsAreEqual(this.lastScheduledPosition, paragraphIndex)
    ) {
      return;
    }

    this.cancelScheduled();
    this.debounceTimer = this.setTimer(() => {
      this.debounceTimer = null;
      this.enqueue(paragraphIndex);
    }, this.debounceMs);
  }

  reset(): void {
    this.cancelScheduled();
    this.enqueue(null);
  }

  retryFailed(): boolean {
    const failedOperation = this.failedOperation;
    if (
      !failedOperation ||
      failedOperation.readingTextId !== this.activeReadingTextId
    ) {
      return false;
    }

    this.failedOperation = null;
    this.enqueue(failedOperation.paragraphIndex, true);
    return true;
  }

  cancelScheduled(): void {
    if (this.debounceTimer !== null) {
      this.clearTimer(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  dispose(): void {
    this.cancelScheduled();
    this.activeReadingTextId = null;
    this.failedOperation = null;
  }

  waitForIdle(): Promise<void> {
    return this.operationChain;
  }

  private enqueue(paragraphIndex: ReadingPosition, force = false): void {
    const readingTextId = this.activeReadingTextId;
    if (
      !readingTextId ||
      (!force &&
        positionsAreEqual(this.lastScheduledPosition, paragraphIndex))
    ) {
      return;
    }

    const operation = { readingTextId, paragraphIndex };
    this.lastScheduledPosition = paragraphIndex;
    this.operationChain = this.operationChain.then(() =>
      this.runOperation(operation),
    );
  }

  private async runOperation(
    operation: ReadingPositionOperation,
  ): Promise<void> {
    if (operation.readingTextId !== this.activeReadingTextId) {
      return;
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.save(operation.readingTextId, operation.paragraphIndex);
        if (operation.readingTextId === this.activeReadingTextId) {
          this.failedOperation = null;
          this.onSaved?.(operation);
        }
        return;
      } catch (error) {
        lastError = error;
        if (attempt === 0) {
          await this.delay(this.retryDelayMs);
          if (operation.readingTextId !== this.activeReadingTextId) {
            return;
          }
        }
      }
    }

    if (operation.readingTextId !== this.activeReadingTextId) {
      return;
    }

    this.lastScheduledPosition = NO_POSITION;
    this.failedOperation = operation;
    this.onError(lastError, operation);
  }
}
