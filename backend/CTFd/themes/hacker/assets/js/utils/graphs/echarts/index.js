import * as echarts from "echarts/core";
import { LineChart, RadarChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent,
  RadarComponent,
  GraphicComponent,
} from "echarts/components";
// Features like Universal Transition and Label Layout
import { LabelLayout, UniversalTransition } from "echarts/features";
// Import the Canvas renderer
// Note that introducing the CanvasRenderer or SVGRenderer is a required step
import { CanvasRenderer } from "echarts/renderers";

// Register the required components
echarts.use([
  LineChart,
  RadarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent,
  RadarComponent,
  GraphicComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
]);

export function embed(target, option) {
  let chart = echarts.getInstanceByDom(target);

  if (!chart) {
    chart = echarts.init(target);
  }

  // https://echarts.apache.org/en/api.html#echartsInstance.setOption
  // https://github.com/apache/echarts/issues/6202#issuecomment-315054637
  // https://stackoverflow.com/a/72211534
  chart.setOption(option, true);

  if (!target.dataset.chartResizeBound) {
    window.addEventListener("resize", () => {
      const instance = echarts.getInstanceByDom(target);
      if (instance) {
        instance.resize();
      }
    });
    target.dataset.chartResizeBound = "true";
  }

  return chart;
}
