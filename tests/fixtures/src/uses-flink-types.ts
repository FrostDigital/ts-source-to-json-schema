import type { FlinkContext, FlinkStatus } from "@flink-app/types";

export interface MyHandler {
  context: FlinkContext;
  status: FlinkStatus;
  data: string;
}
