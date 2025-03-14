// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GraphWidget,
  GraphWidgetProps,
  GraphWidgetView,
  LegendPosition,
  MathExpression,
  Metric,
  SingleValueWidget,
  SingleValueWidgetProps,
  Stats,
} from "aws-cdk-lib/aws-cloudwatch";
import { Duration } from "aws-cdk-lib";

/**
 * Represents standard widget sizes for CloudWatch dashboards
 * Values indicate the number of grid units the widget will occupy
 */
export enum Size {
  FULL_WIDTH = 24,
  HALF_WIDTH = 12,
  THIRD_WIDTH = 8,
  QUARTER_WIDTH = 6,
}

export interface WidgetProps {
  width: number;
  height: number;
}

export interface DefaultGraphWidgetProps extends GraphWidgetProps {
  title: string;
  width?: number;
  height?: number;
  metric: Metric;
  label: string;
  unit: string;
}

export interface DefaultSingleValueWidgetProps extends Omit<SingleValueWidgetProps, "metrics"> {
  title: string;
  width?: number;
  height?: number;
  metric: Metric | MathExpression;
  label: string;
}

/**
 * Creates a standardized graph widget which adds a RUNNING_SUM line to the metric being graphed
 * @augments GraphWidget
 */
export class RunningSumGraphWidget extends GraphWidget {
  constructor(props: GraphWidgetProps) {
    if (!props?.left?.length) {
      throw new Error("RunningSumGraphWidget requires at least one left metric to be defined");
    }
    if (!props.leftYAxis || !props.leftYAxis.label) {
      throw new Error("Left Y axis and Left Y axis label are required");
    }
    super({ ...props, rightYAxis: { ...props.leftYAxis, label: `Running-Total ${props.leftYAxis?.label}`, min: 0 } });
    this.addRightMetric(
      new MathExpression({
        expression: `RUNNING_SUM(metric)`,
        usingMetrics: {
          metric: props.left[0],
        },
      }).with({ label: "Total" })
    );
  }
}

/**
 * Creates a standardized graph widget with running sum functionality
 * @augments RunningSumGraphWidget
 */
export class DefaultGraphWidget extends RunningSumGraphWidget {
  constructor(props: DefaultGraphWidgetProps) {
    super({
      title: props.title,
      width: props.width || Size.HALF_WIDTH,
      height: props.height || Size.HALF_WIDTH,
      view: GraphWidgetView.TIME_SERIES,
      period: props.period || Duration.days(1),
      liveData: props.liveData ?? true,
      left: [
        props.metric.with({
          label: props.label,
        }),
      ],
      leftYAxis: {
        label: props.unit,
        showUnits: false,
        min: 0,
      },
      legendPosition: LegendPosition.BOTTOM,
      statistic: Stats.SUM,
    });
  }
}

/**
 * Creates a standardized single value widget which adds the provided label to the metric being graphed
 * and sets the period as time range by default.
 * @augments SingleValueWidget
 */
export class DefaultSingleValueWidget extends SingleValueWidget {
  constructor(props: DefaultSingleValueWidgetProps) {
    super({
      title: props.title,
      width: props.width || Size.HALF_WIDTH,
      height: props.height || Size.QUARTER_WIDTH,
      metrics: [
        props.metric.with({
          label: props.label,
        }),
      ],
      period: props.period,
      setPeriodToTimeRange: props.sparkline ? false : props.setPeriodToTimeRange ?? true,
      fullPrecision: props.fullPrecision,
      sparkline: props.sparkline,
    });
  }
}
