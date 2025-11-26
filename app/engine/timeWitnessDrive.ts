export type CameraPauseReason = "editing";

export type TimeWitnessDrive = {
  pauseCamera: (reason: CameraPauseReason) => void;
  resumeCamera: (reason: CameraPauseReason) => void;
};

const noopTimeWitnessDrive: TimeWitnessDrive = {
  pauseCamera: () => {},
  resumeCamera: () => {},
};

export function createTimeWitnessDrive(): TimeWitnessDrive {
  if (typeof window === "undefined") {
    return noopTimeWitnessDrive;
  }

  const globalTarget = window as unknown as {
    timeWitnessDrive?: Partial<TimeWitnessDrive>;
    TimeWitnessDrive?: Partial<TimeWitnessDrive>;
  };

  const candidate =
    globalTarget.timeWitnessDrive ?? globalTarget.TimeWitnessDrive;

  if (
    candidate &&
    typeof candidate.pauseCamera === "function" &&
    typeof candidate.resumeCamera === "function"
  ) {
    return {
      pauseCamera: (reason) => candidate.pauseCamera?.(reason),
      resumeCamera: (reason) => candidate.resumeCamera?.(reason),
    };
  }

  return noopTimeWitnessDrive;
}
