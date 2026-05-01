import { embed } from "../utils/graphs/echarts";

function normalizeCategory(name) {
  if (!name) return null;

  const trimmed = String(name).trim();
  return trimmed.length ? trimmed : null;
}

function readCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function wrapRadarLabel(label, maxLength = 16) {
  if (!label || label.length <= maxLength) {
    return label;
  }

  const words = label.split(/\s+/);
  const lines = [];
  let current = "";

  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLength) {
      current = next;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  });

  if (current) {
    lines.push(current);
  }

  return lines.join("\n");
}

export const skillBreakdownMixin = {
  getSkillBreakdown() {
    const grouped = new Map();
    const solves = this.solves?.data || [];

    solves.forEach(solve => {
      const key = normalizeCategory(solve.challenge?.category);
      if (key) {
        grouped.set(key, (grouped.get(key) || 0) + 1);
      }
    });

    const total = solves.length || 1;
    const highestCount = Math.max(...Array.from(grouped.values()), 1);

    return Array.from(grouped.entries())
      .map(([name, count]) => {
        const percent = Math.round((count / total) * 100);

        return {
          name,
          count,
          percent,
          value: percent,
          radarValue: Math.max(Math.round((count / highestCount) * 100), count > 0 ? 12 : 0),
        };
      })
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.name.localeCompare(right.name);
      });
  },

  hasSkillData() {
    return this.getSkillBreakdown().some(category => category.count > 0);
  },

  buildSkillChartOption() {
    const breakdown = this.getSkillBreakdown();
    const accent = readCssVar("--accent", "#22c55e");
    const accentRgb = readCssVar("--accent-rgb", "34, 197, 94");
    const axisColor = "rgba(216, 223, 231, 0.74)";
    const gridColor = "rgba(176, 186, 196, 0.24)";

    return {
      animationDuration: 700,
      animationEasing: "cubicOut",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(8, 10, 12, 0.96)",
        borderColor: `rgba(${accentRgb}, 0.24)`,
        borderWidth: 1,
        textStyle: {
          color: "#eef3f7",
          fontFamily: "Manrope, sans-serif",
        },
        formatter: params => {
          const entry = breakdown[params.dataIndex] || {};
          return `${entry.name}<br/>${entry.count} solve${entry.count === 1 ? "" : "s"} - ${entry.percent}%`;
        },
      },
      radar: {
        center: ["50%", "52%"],
        radius: "68%",
        shape: "polygon",
        splitNumber: 4,
        startAngle: 90,
        axisName: {
          color: axisColor,
          fontFamily: "Rajdhani, Arial Narrow, sans-serif",
          fontSize: 12,
          fontWeight: 600,
          padding: [4, 10],
          formatter: value => wrapRadarLabel(value),
        },
        axisLine: {
          lineStyle: {
            color: "rgba(186, 194, 203, 0.32)",
            width: 1,
          },
        },
        splitLine: {
          lineStyle: {
            color: gridColor,
            width: 1,
          },
        },
        splitArea: {
          areaStyle: {
            color: [
              "rgba(255, 255, 255, 0.012)",
              "rgba(255, 255, 255, 0.004)",
            ],
          },
        },
        indicator: breakdown.map(category => ({
          name: category.name,
          max: 100,
        })),
      },
      series: [
        {
          type: "radar",
          symbol: "circle",
          symbolSize: 7,
          lineStyle: {
            color: accent,
            width: 2.4,
            shadowBlur: 18,
            shadowColor: `rgba(${accentRgb}, 0.18)`,
          },
          itemStyle: {
            color: accent,
            borderColor: "#090c10",
            borderWidth: 2,
          },
          areaStyle: {
            color: `rgba(${accentRgb}, 0.16)`,
          },
          data: [
            {
              value: breakdown.map(category => category.radarValue),
            },
          ],
        },
      ],
      graphic: [
        {
          type: "group",
          left: "center",
          top: "16%",
          children: [100, 75, 50, 25].map((value, index) => ({
            type: "text",
            left: 0,
            top: index * 18,
            style: {
              text: String(value),
              fill: "rgba(184, 191, 198, 0.48)",
              font: '10px "Space Mono", monospace',
            },
          })),
        },
      ],
    };
  },

  renderSkillChart() {
    if (!this.$refs.skillchart || !this.hasSkillData()) {
      return;
    }

    const target = this.$refs.skillchart;
    const mountChart = (attempt = 0) => {
      if (!document.body.contains(target)) {
        return;
      }

      const { width, height } = target.getBoundingClientRect();
      if ((width < 40 || height < 40) && attempt < 8) {
        window.requestAnimationFrame(() => mountChart(attempt + 1));
        return;
      }

      const chart = embed(target, this.buildSkillChartOption());
      window.requestAnimationFrame(() => {
        chart?.resize?.();
      });
    };

    window.requestAnimationFrame(() => mountChart());
  },
};
