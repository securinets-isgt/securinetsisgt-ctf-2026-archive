import CTFd from "../index";
import { getOption as getUserScoreOption } from "../utils/graphs/echarts/userscore";
import { embed } from "../utils/graphs/echarts";
import { skillBreakdownMixin } from "../teams/skill-breakdown";

const USER_PROFILE_UPDATE_INTERVAL = window.userProfileUpdateInterval || 60000;

function readCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function formatDate(dateString) {
  if (!dateString) {
    return "No activity yet";
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return "No activity yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function sortEntriesByDate(entries = [], direction = "asc") {
  const factor = direction === "desc" ? -1 : 1;
  return [...entries].sort(
    (left, right) => factor * (new Date(left.date).getTime() - new Date(right.date).getTime()),
  );
}

export function createUserGraphs({ userId, userName }) {
  const context = window.USER_CONTEXT || {};
  const resolvedUserId = Number(userId || context.id || 0);
  const resolvedUserName = userName || context.name || "User";

  return {
    solves: { data: [], meta: { count: 0 } },
    fails: { data: [], meta: { count: 0 } },
    awards: { data: [], meta: { count: 0 } },
    standings: [],
    solveCount: 0,
    failCount: 0,
    awardCount: 0,
    place: context.place || null,
    score: Number(context.score || 0),
    scoreVisible: Boolean(context.score_visible),
    liveSyncedAt: null,
    loading: true,
    pollingHandle: null,
    ...skillBreakdownMixin,

    formatNumber,

    getSolvePercentage() {
      const total = this.solveCount + this.failCount;
      if (!total) return "0";
      return Math.round((this.solveCount / total) * 100).toString();
    },

    getFailPercentage() {
      const total = this.solveCount + this.failCount;
      if (!total) return "0";
      return Math.round((this.failCount / total) * 100).toString();
    },

    getAccuracyLabel() {
      return `${this.getSolvePercentage()}%`;
    },

    getAverageSolveValue() {
      const solves = this.solves?.data || [];
      if (!solves.length) return "0";
      const total = solves.reduce((sum, solve) => sum + Number(solve?.challenge?.value || 0), 0);
      return formatNumber(Math.round(total / solves.length));
    },

    getActiveCategoriesCount() {
      return this.getSkillBreakdown().filter(category => category.count > 0).length;
    },

    getTopCategory() {
      return this.getSkillBreakdown()
        .filter(category => category.count > 0)
        .sort((left, right) => right.count - left.count)[0] || null;
    },

    getLastSolve() {
      return sortEntriesByDate(this.solves?.data || [], "desc")[0] || null;
    },

    getLastSolveLabel() {
      return this.getLastSolve()?.challenge?.name || "No solves yet";
    },

    getLastSolveTimeLabel() {
      return formatDate(this.getLastSolve()?.date);
    },

    getRecentSolves(limit = 5) {
      return sortEntriesByDate(this.solves?.data || [], "desc").slice(0, limit);
    },

    hasTimelineData() {
      return (this.solves?.data?.length || 0) + (this.awards?.data?.length || 0) > 0;
    },

    hasAwards() {
      return (this.awards?.data?.length || 0) > 0;
    },

    getSortedAwards() {
      return sortEntriesByDate(this.awards?.data || [], "desc");
    },

    getSyncLabel() {
      return this.liveSyncedAt ? formatDate(this.liveSyncedAt) : "Syncing…";
    },

    formatSolveDate(dateString) {
      return formatDate(dateString);
    },

    challengeHref(solve) {
      if (!solve?.challenge?.id) {
        return `${CTFd.config.urlRoot}/challenges`;
      }

      const name = encodeURIComponent(solve.challenge.name || "challenge");
      return `${CTFd.config.urlRoot}/challenges#${name}-${solve.challenge.id}`;
    },

    getScoreLabel() {
      return formatNumber(this.score);
    },

    getPlaceLabel() {
      if (!this.place) {
        return "—";
      }
      return `#${this.place}`;
    },

    getStandingEntry() {
      if (!Array.isArray(this.standings) || !this.standings.length) {
        return null;
      }

      return this.standings.find((standing, index) => {
        const accountId = Number(standing?.account_id ?? standing?.id ?? 0);
        if (accountId === resolvedUserId) {
          if (!standing.pos) {
            standing.pos = index + 1;
          }
          return true;
        }
        return false;
      }) || null;
    },

    async loadStanding() {
      if (!this.scoreVisible) {
        return;
      }

      try {
        this.standings = await CTFd.pages.scoreboard.getScoreboard();
        const standing = this.getStandingEntry();

        if (standing) {
          this.place = Number(standing.pos || this.place || 0) || null;
          this.score = Number(standing.score || this.score || 0);
        }
      } catch (error) {
        console.warn("Unable to refresh user standing", error);
      }
    },

    buildScoreChartOption() {
      const accent = readCssVar("--accent", "#22c55e");
      const accentRgb = readCssVar("--accent-rgb", "34, 197, 94");
      const option = getUserScoreOption(
        resolvedUserId,
        resolvedUserName,
        this.solves?.data || [],
        this.awards?.data || [],
      );

      option.title = { show: false };
      option.legend = { show: false };
      option.toolbox = { show: false };
      option.dataZoom = [];
      option.grid = {
        ...option.grid,
        top: 28,
        right: 20,
        bottom: 28,
        left: 30,
        containLabel: true,
      };

      option.tooltip = {
        trigger: "axis",
        backgroundColor: "rgba(8, 10, 12, 0.96)",
        borderColor: `rgba(${accentRgb}, 0.26)`,
        borderWidth: 1,
        textStyle: {
          color: "#e6ebf0",
          fontFamily: "Manrope, sans-serif",
        },
      };

      option.xAxis[0] = {
        ...option.xAxis[0],
        axisLine: {
          lineStyle: { color: "rgba(255, 255, 255, 0.12)" },
        },
        axisTick: { show: false },
        axisLabel: {
          color: "rgba(191, 198, 207, 0.58)",
          margin: 12,
          formatter: value =>
            new Intl.DateTimeFormat(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            }).format(new Date(value)),
        },
        splitLine: { show: false },
      };

      option.yAxis[0] = {
        ...option.yAxis[0],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "rgba(191, 198, 207, 0.58)",
        },
        splitLine: {
          lineStyle: {
            color: "rgba(255, 255, 255, 0.08)",
            type: "dashed",
          },
        },
      };

      if (option.series?.[0]) {
        option.series[0] = {
          ...option.series[0],
          smooth: 0.35,
          symbol: "circle",
          symbolSize: 8,
          showSymbol: true,
          label: { show: false },
          lineStyle: {
            width: 3,
            color: accent,
          },
          itemStyle: {
            color: accent,
            borderColor: "#0b0d0f",
            borderWidth: 2,
          },
          areaStyle: {
            color: `rgba(${accentRgb}, 0.16)`,
          },
        };
      }

      return option;
    },

    renderScoreGraph() {
      if (!this.$refs.scoregraph || !this.hasTimelineData()) {
        return;
      }

      const target = this.$refs.scoregraph;
      const mountChart = (attempt = 0) => {
        if (!document.body.contains(target)) {
          return;
        }

        const { width, height } = target.getBoundingClientRect();
        if ((width < 40 || height < 40) && attempt < 8) {
          window.requestAnimationFrame(() => mountChart(attempt + 1));
          return;
        }

        const chart = embed(target, this.buildScoreChartOption());
        window.requestAnimationFrame(() => {
          chart?.resize?.();
        });
      };

      window.requestAnimationFrame(() => mountChart());
    },

    async refreshData() {
      if (this.loading === "refreshing") {
        return;
      }

      this.loading = this.liveSyncedAt ? "refreshing" : true;

      try {
        const [solves, fails, awards] = await Promise.all([
          CTFd.pages.users.userSolves(resolvedUserId),
          CTFd.pages.users.userFails(resolvedUserId),
          CTFd.pages.users.userAwards(resolvedUserId),
        ]);

        this.solves = solves || { data: [], meta: { count: 0 } };
        this.fails = fails || { data: [], meta: { count: 0 } };
        this.awards = awards || { data: [], meta: { count: 0 } };

        this.solveCount = Number(this.solves?.meta?.count || this.solves?.data?.length || 0);
        this.failCount = Number(this.fails?.meta?.count || this.fails?.data?.length || 0);
        this.awardCount = Number(this.awards?.meta?.count || this.awards?.data?.length || 0);

        await this.loadStanding();

        this.liveSyncedAt = new Date().toISOString();
        await this.$nextTick();
        this.renderScoreGraph();
        this.renderSkillChart();
      } finally {
        this.loading = false;
      }
    },

    async init() {
      await this.refreshData();

      this.pollingHandle = window.setInterval(() => {
        this.refreshData();
      }, USER_PROFILE_UPDATE_INTERVAL);
    },
  };
}
