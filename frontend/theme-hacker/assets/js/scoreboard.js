import Alpine from "alpinejs";
import CTFd from "./index";
import { getOption } from "./utils/graphs/echarts/scoreboard";
import { embed } from "./utils/graphs/echarts";

window.Alpine = Alpine;
window.CTFd = CTFd;

// Default scoreboard polling interval to every 5 minutes
const scoreboardUpdateInterval = window.scoreboardUpdateInterval || 300000;

Alpine.data("ScoreboardDetail", () => ({
  data: {},
  show: true,
  activeBracket: null,

  async update() {
    this.data = await CTFd.pages.scoreboard.getScoreboardDetail(10, this.activeBracket);

    let optionMerge = window.scoreboardChartOptions;
    let option = getOption(CTFd.config.userMode, this.data, optionMerge);

    embed(this.$refs.scoregraph, option);
    this.show = Object.keys(this.data).length > 0;
  },

  async init() {
    this.update();

    setInterval(() => {
      this.update();
    }, scoreboardUpdateInterval);
  },
}));

Alpine.data("ScoreboardList", () => ({
  standings: [],
  brackets: [],
  activeBracket: null,
  firstBloods: {},
  firstBloodsLoaded: false,

  async update() {
    const [brackets, standings] = await Promise.all([
      CTFd.pages.scoreboard.getBrackets(CTFd.config.userMode),
      CTFd.pages.scoreboard.getScoreboard(),
    ]);

    this.brackets = brackets;
    this.standings = standings;

    await this.applyDerivedStats();
  },

  async applyDerivedStats() {
    const detailCount = Math.max(1, Math.min(this.standings.length, 50));
    const detail = await CTFd.pages.scoreboard.getScoreboardDetail(detailCount);
    const solveCounts = this.buildSolveCounts(detail);

    if (!this.firstBloodsLoaded) {
      await this.loadFirstBloodCounts();
    }

    this.standings = this.standings.map(standing => {
      const accountId = Number(standing.account_id);
      return {
        ...standing,
        solve_count: solveCounts[accountId] || 0,
        first_bloods: this.firstBloods[accountId] || 0,
      };
    });
  },

  buildSolveCounts(detail) {
    const counts = {};

    Object.values(detail || {}).forEach(entry => {
      const accountId = Number(entry?.id);
      const solves = Array.isArray(entry?.solves) ? entry.solves : [];
      counts[accountId] = solves.filter(item => item?.challenge_id !== null).length;
    });

    return counts;
  },

  async loadFirstBloodCounts() {
    try {
      const challenges = await CTFd.pages.challenges.getChallenges();
      const solveLists = await Promise.all(
        challenges.map(challenge =>
          CTFd.pages.challenge.loadSolves(challenge.id).catch(() => []),
        ),
      );

      const counts = {};

      solveLists.forEach(solves => {
        const firstSolve = (Array.isArray(solves) ? solves : [])
          .filter(solve => solve?.account_id && solve?.date)
          .sort((left, right) => new Date(left.date) - new Date(right.date))[0];

        if (!firstSolve) {
          return;
        }

        const accountId = Number(firstSolve.account_id);
        counts[accountId] = (counts[accountId] || 0) + 1;
      });

      this.firstBloods = counts;
      this.firstBloodsLoaded = true;
    } catch (error) {
      console.log("Unable to load first blood counts");
      console.log(error);
    }
  },

  filteredStandings() {
    return this.standings
      .filter(standing =>
        this.activeBracket ? standing.bracket_id == this.activeBracket : true,
      )
      .map((standing, index) => ({
        ...standing,
        display_pos: index + 1,
      }));
  },

  placeDisplay(position) {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return String(position);
  },

  rowThemeClass(position) {
    if (position === 1) return "scoreboard-row--gold";
    if (position === 2) return "scoreboard-row--silver";
    if (position === 3) return "scoreboard-row--bronze";
    return "";
  },

  bloodDisplay(count) {
    return count > 0 ? `${count}` : "—";
  },

  async init() {
    this.$watch("activeBracket", value => {
      this.$dispatch("bracket-change", value);
    });

    this.update();

    setInterval(() => {
      this.update();
    }, scoreboardUpdateInterval);
  },
}));

Alpine.start();
