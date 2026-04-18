import { getWorkerHealth } from "./health";

export interface WorkerServerState {
  started: boolean;
}

export function createWorkerServerState(): WorkerServerState {
  return {
    started: false
  };
}

export function getHealthResponse() {
  return getWorkerHealth();
}