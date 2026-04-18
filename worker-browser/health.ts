export interface WorkerHealth {
  ok: boolean;
  version: string;
}

export function getWorkerHealth(): WorkerHealth {
  return {
    ok: true,
    version: "0.0.0"
  };
}