import Alpine from "alpinejs";
import CTFd from "./index";

window.Alpine = Alpine;
window.CTFd = CTFd;

const wallboardUpdateInterval = window.wallboardUpdateInterval || 10000;
const wallboardAlertInterval = window.wallboardAlertInterval || 3000;
const wallboardTableLimit = window.wallboardTableLimit || 12;
const wallboardSolveFeedLimit = window.wallboardSolveFeedLimit || 10;
const wallboardFirstBloodStorageKey = "wallboard-first-blood-effects-enabled";

Alpine.data("ScoreboardWallboard", () => ({
  loading: true,
  standings: [],
  challengeDirectory: {},
  pendingBloodChallengeIds: [],
  firstBloodMap: {},
  recentSolves: [],
  firstBloodNotice: null,
  firstBloodEffectsEnabled: true,
  audioArmed: false,
  clockDisplay: "--:--:--",
  lastSyncDisplay: "--",
  livePulse: false,
  notificationAudio: null,
  firstBloodAudio: null,
  firstBloodNoticeTimeout: null,
  refreshInFlight: false,
  alertCheckInFlight: false,

  async init() {
    this.loadFirstBloodPreference();
    this.setupAudioUnlock();
    this.updateClock();
    setInterval(() => this.updateClock(), 1000);

    await this.preloadChallenges();
    await this.refresh(true);

    setInterval(() => {
      this.refresh(false);
    }, wallboardUpdateInterval);

    setInterval(() => {
      this.pollFirstBloods();
    }, wallboardAlertInterval);
  },

  async preloadChallenges() {
    const challenges = await CTFd.pages.challenges.getChallenges();
    this.challengeDirectory = Object.fromEntries(
      challenges.map(challenge => [Number(challenge.id), challenge]),
    );
    this.pendingBloodChallengeIds = challenges.map(challenge => Number(challenge.id));
  },

  async refresh(initial = false) {
    if (this.refreshInFlight) {
      return;
    }

    this.refreshInFlight = true;

    try {
      const previousStandings = new Map(
        this.standings.map(standing => [
          Number(standing.account_id),
          {
            score: Number(standing.score),
            display_pos: Number(standing.display_pos),
          },
        ]),
      );
      const previousSolveIds = new Set(
        this.recentSolves.map(solve => solve.id),
      );

      const [standings, detail] = await Promise.all([
        CTFd.pages.scoreboard.getScoreboard(),
        CTFd.pages.scoreboard.getScoreboardDetail(50),
      ]);

      const newFirstBloodEvents = await this.refreshFirstBloods(initial);

      const solveCounts = this.buildSolveCounts(detail);
      const bloodCounts = this.buildBloodCounts();

      this.standings = standings.map((standing, index) => {
        const accountId = Number(standing.account_id);
        const previous = previousStandings.get(accountId);
        const displayPos = index + 1;
        const score = Number(standing.score) || 0;
        const movement = this.getMovement(previous?.display_pos, displayPos);
        const justUpdated = Boolean(previous) && previous.score !== score;

        return {
          ...standing,
          display_pos: displayPos,
          score,
          solve_count: solveCounts[accountId] || 0,
          first_bloods: bloodCounts[accountId] || 0,
          movement,
          justUpdated,
        };
      });

      this.recentSolves = this.buildRecentSolves(detail, previousSolveIds, initial);

      if (!initial && this.recentSolves.some(solve => solve.fresh)) {
        setTimeout(() => {
          this.recentSolves = this.recentSolves.map(solve => ({
            ...solve,
            fresh: false,
          }));
        }, 4500);
      }

      if (!initial && newFirstBloodEvents.length) {
        this.triggerFirstBloodNotice(newFirstBloodEvents[newFirstBloodEvents.length - 1]);
      }

      this.lastSyncDisplay = this.formatClockTime(new Date());
      this.flashLivePulse();
      this.loading = false;
    } catch (error) {
      console.log("Unable to refresh wallboard");
      console.log(error);
    } finally {
      this.refreshInFlight = false;
    }
  },

  async pollFirstBloods() {
    if (this.alertCheckInFlight || this.loading || !this.firstBloodEffectsEnabled) {
      return;
    }

    this.alertCheckInFlight = true;

    try {
      const newFirstBloodEvents = await this.refreshFirstBloods(false);

      if (newFirstBloodEvents.length) {
        this.triggerFirstBloodNotice(newFirstBloodEvents[newFirstBloodEvents.length - 1]);
      }
    } catch (error) {
      console.log("Unable to fast-check first blood events");
      console.log(error);
    } finally {
      this.alertCheckInFlight = false;
    }
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

  buildRecentSolves(detail, previousSolveIds, initial) {
    const solves = [];

    Object.values(detail || {}).forEach(entry => {
      const accountId = Number(entry?.id);
      const teamName = entry?.name || "Unknown Team";
      const accountSolves = Array.isArray(entry?.solves) ? entry.solves : [];

      accountSolves.forEach(solve => {
        if (solve?.challenge_id === null || !solve?.date) {
          return;
        }

        const challengeId = Number(solve.challenge_id);
        const challenge = this.challengeDirectory[challengeId];
        const firstBloodEvent = this.firstBloodMap[challengeId];
        const solveId = `${accountId}-${challengeId}-${solve.date}`;
        const firstBlood =
          Boolean(firstBloodEvent) &&
          Number(firstBloodEvent.accountId) === accountId &&
          firstBloodEvent.date === solve.date;

        solves.push({
          id: solveId,
          team: teamName,
          challenge: challenge?.name || solve?.challenge || "Unknown Challenge",
          category: challenge?.category || solve?.category || "Open Case",
          time: this.formatClockTime(new Date(solve.date)),
          fresh: !initial && !previousSolveIds.has(solveId),
          firstBlood,
          date: solve.date,
        });
      });
    });

    return solves
      .sort((left, right) => new Date(right.date) - new Date(left.date))
      .slice(0, wallboardSolveFeedLimit);
  },

  async refreshFirstBloods(initial = false) {
    if (!this.pendingBloodChallengeIds.length) {
      return [];
    }

    const challengeIds = [...this.pendingBloodChallengeIds];
    const solveLists = await Promise.all(
      challengeIds.map(challengeId =>
        CTFd.pages.challenge.loadSolves(challengeId).catch(() => []),
      ),
    );

    const nextPending = [];
    const newEvents = [];

    solveLists.forEach((solves, index) => {
      const challengeId = challengeIds[index];
      const earliestSolve = (Array.isArray(solves) ? solves : [])
        .filter(solve => solve?.account_id && solve?.date)
        .sort((left, right) => new Date(left.date) - new Date(right.date))[0];

      if (!earliestSolve) {
        nextPending.push(challengeId);
        return;
      }

      const existing = this.firstBloodMap[challengeId];
      const event = {
        challengeId,
        accountId: Number(earliestSolve.account_id),
        date: earliestSolve.date,
      };
      this.firstBloodMap[challengeId] = event;

      if (!initial && !existing) {
        newEvents.push(event);
      }
    });

    this.pendingBloodChallengeIds = nextPending;
    return newEvents;
  },

  buildBloodCounts() {
    const counts = {};

    Object.values(this.firstBloodMap).forEach(event => {
      const accountId = Number(event.accountId);
      counts[accountId] = (counts[accountId] || 0) + 1;
    });

    return counts;
  },

  triggerFirstBloodNotice(event) {
    if (!this.firstBloodEffectsEnabled || !event) {
      return;
    }

    const challenge = this.challengeDirectory[event.challengeId];
    const standing = this.standings.find(
      item => Number(item.account_id) === Number(event.accountId),
    );

    this.firstBloodNotice = {
      id: `${event.challengeId}-${event.date}`,
      team: standing?.name || "Unknown Team",
      challenge: challenge?.name || "Unknown Challenge",
      time: this.formatClockTime(new Date(event.date)),
    };

    if (this.firstBloodNoticeTimeout) {
      clearTimeout(this.firstBloodNoticeTimeout);
    }

    this.playFirstBloodSound();

    this.firstBloodNoticeTimeout = setTimeout(() => {
      this.dismissFirstBloodNotice();
    }, 7000);
  },

  dismissFirstBloodNotice() {
    if (this.firstBloodNoticeTimeout) {
      clearTimeout(this.firstBloodNoticeTimeout);
      this.firstBloodNoticeTimeout = null;
    }

    this.firstBloodNotice = null;
  },

  loadFirstBloodPreference() {
    const stored = localStorage.getItem(wallboardFirstBloodStorageKey);
    this.firstBloodEffectsEnabled = stored !== "0";
  },

  toggleFirstBloodEffects(forceValue = null) {
    const nextValue =
      typeof forceValue === "boolean" ? forceValue : !this.firstBloodEffectsEnabled;

    this.firstBloodEffectsEnabled = nextValue;
    localStorage.setItem(wallboardFirstBloodStorageKey, nextValue ? "1" : "0");

    if (nextValue) {
      this.armFirstBloodAudio(false);
    }

    if (!nextValue) {
      this.dismissFirstBloodNotice();
    }
  },

  disableFirstBloodEffects() {
    this.toggleFirstBloodEffects(false);
  },

  setupAudioUnlock() {
    const unlock = () => {
      this.armFirstBloodAudio(false);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  },

  async armFirstBloodAudio(playPreview = false) {
    try {
      if (!this.firstBloodAudio) {
        this.firstBloodAudio = new Audio(window.init.firstBloodSound);
        this.firstBloodAudio.preload = "auto";
        this.firstBloodAudio.volume = 0.7;
      }

      if (!this.audioArmed) {
        this.firstBloodAudio.muted = true;
        await this.firstBloodAudio.play();
        this.firstBloodAudio.pause();
        this.firstBloodAudio.currentTime = 0;
        this.firstBloodAudio.muted = false;
        this.audioArmed = true;
      }

      if (playPreview) {
        await this.playFirstBloodSound();
      }
    } catch (error) {
      this.audioArmed = false;
      console.log("Unable to arm first blood sound");
      console.log(error);
    }
  },

  async playFirstBloodSound() {
    try {
      if (!this.firstBloodAudio) {
        this.firstBloodAudio = new Audio(window.init.firstBloodSound);
        this.firstBloodAudio.preload = "auto";
        this.firstBloodAudio.volume = 0.7;
      }

      if (!this.audioArmed) {
        await this.armFirstBloodAudio(false);
      }

      this.firstBloodAudio.currentTime = 0;
      await this.firstBloodAudio.play();
      this.audioArmed = true;
    } catch (error) {
      this.audioArmed = false;
      console.log("Unable to play first blood sound");
      console.log(error);
    }
  },

  flashLivePulse() {
    this.livePulse = true;
    setTimeout(() => {
      this.livePulse = false;
    }, 1200);
  },

  updateClock() {
    this.clockDisplay = this.formatClockTime(new Date());
  },

  formatClockTime(value) {
    return new Intl.DateTimeFormat(
      localStorage.getItem("language") || navigator.language,
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      },
    ).format(value);
  },

  displayStandings() {
    return this.standings.slice(0, wallboardTableLimit);
  },

  placeDisplay(position) {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return `#${position}`;
  },

  podiumClass(position) {
    if (position === 1) return "is-gold";
    if (position === 2) return "is-silver";
    if (position === 3) return "is-bronze";
    return "";
  },

  getMovement(previousPosition, nextPosition) {
    if (!previousPosition || previousPosition === nextPosition) {
      return "steady";
    }

    return nextPosition < previousPosition ? "up" : "down";
  },

  movementClass(movement) {
    if (movement === "up") return "is-up";
    if (movement === "down") return "is-down";
    return "is-steady";
  },

  movementLabel(movement) {
    if (movement === "up") return "Rising";
    if (movement === "down") return "Dropped";
    return "Holding";
  },
}));

Alpine.start();
