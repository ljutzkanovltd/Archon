"use client";

import { Gantt } from "@svar-ui/react-gantt";

export interface GanttChartProps {
  tasks: any[];
  links: any[];
  scales: any[];
  columns: any[];
  cellWidth: number;
  cellHeight: number;
  readonly?: boolean;
}

export function GanttChart(props: GanttChartProps) {
  return <Gantt {...props} />;
}
