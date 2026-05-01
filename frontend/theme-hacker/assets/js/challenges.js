import Alpine from "alpinejs";

import CTFd from "./index";

import { Modal, Tab, Tooltip } from "bootstrap";
import highlight from "./theme/highlight";
import { intl } from "./theme/times";

function addTargetBlank(html) {
  let dom = new DOMParser();
  let view = dom.parseFromString(html, "text/html");
  let links = view.querySelectorAll('a[href*="://"]');
  links.forEach(link => {
    link.setAttribute("target", "_blank");
  });
  return view.documentElement.outerHTML;
}

const DISCORD_TICKETS_URL = "https://discord.gg/fdFMEnCMw"; // TODO: replace with your Discord tickets channel URL

window.Alpine = Alpine;

Alpine.store("challenge", {
  data: {
    view: "",
  },
});

Alpine.data("Hint", () => ({
  id: null,
  html: null,

  async showHint(event) {
    if (event.target.open) {
      let response = await CTFd.pages.challenge.loadHint(this.id);

      // Hint has some kind of prerequisite or access prevention
      if (response.errors) {
        event.target.open = false;
        CTFd._functions.challenge.displayUnlockError(response);
        return;
      }
      let hint = response.data;
      if (hint.content) {
        this.html = addTargetBlank(hint.html);
      } else {
        let answer = await CTFd.pages.challenge.displayUnlock(this.id);
        if (answer) {
          let unlock = await CTFd.pages.challenge.loadUnlock(this.id);

          if (unlock.success) {
            let response = await CTFd.pages.challenge.loadHint(this.id);
            let hint = response.data;
            this.html = addTargetBlank(hint.html);
          } else {
            event.target.open = false;
            CTFd._functions.challenge.displayUnlockError(unlock);
          }
        } else {
          event.target.open = false;
        }
      }
    }
  },
}));

Alpine.data("Challenge", () => ({
  id: null,
  next_id: null,
  submission: "",
  tab: null,
  solves: [],
  submissions: [],
  solution: null,
  response: null,
  share_url: null,
  max_attempts: 0,
  attempts: 0,
  ratingValue: 0,
  selectedRating: 0,
  ratingReview: "",
  ratingSubmitted: false,
  openedAt: 0,
  challengeValue: 0,
  initialSolveCount: 0,
  supportLink: DISCORD_TICKETS_URL,
  originalSolveTimestamp: null,
  correctPanel: {
    isFirstBlood: false,
    points: 0,
    pointsDisplay: 0,
    rank: "--",
    solveTime: "00:00",
  },
  repeatSolvePanel: {
    variant: "",
    badge: "",
    title: "",
    subtitle: "",
    info: "",
    solvedAt: "--",
  },
  pointsAnimationFrame: null,
  particleAnimationFrame: null,

  getStyles() {
    let styles = {
      "modal-dialog": true,
    };
    try {
      let size = CTFd.config.themeSettings.challenge_window_size;
      switch (size) {
        case "sm":
          styles["modal-sm"] = true;
          break;
        case "lg":
          styles["modal-lg"] = true;
          break;
        case "xl":
          styles["modal-xl"] = true;
          break;
        default:
          break;
      }
    } catch (error) {
      // Ignore errors with challenge window size
      console.log("Error processing challenge_window_size");
      console.log(error);
    }
    return styles;
  },

  async init() {
    highlight();
  },

  async showChallenge() {
    new Tab(this.$el).show();
  },

  async showSolves() {
    this.solves = await CTFd.pages.challenge.loadSolves(this.id);
    this.solves.forEach(solve => {
      solve.date = intl.format(new Date(solve.date));
      return solve;
    });
    new Tab(this.$el).show();
  },

  async showSubmissions() {
    let response = await CTFd.pages.users.userSubmissions("me", this.id);
    this.submissions = response.data;
    this.submissions.forEach(s => {
      s.date = intl.format(new Date(s.date));
      return s;
    });
    new Tab(this.$el).show();
  },

  getSolutionId() {
    let data = Alpine.store("challenge").data;
    return data.solution_id;
  },

  getSolutionState() {
    let data = Alpine.store("challenge").data;
    return data.solution_state;
  },

  setSolutionId(solutionId) {
    Alpine.store("challenge").data.solution_id = solutionId;
  },

  async showSolution() {
    let solution_id = this.getSolutionId();
    CTFd._functions.challenge.displaySolution = solution => {
      this.solution = solution.html;
      new Tab(this.$el).show();
    };
    await CTFd.pages.challenge.displaySolution(solution_id);
  },

  getNextId() {
    let data = Alpine.store("challenge").data;
    return data.next_id;
  },

  async nextChallenge() {
    let modal = Modal.getOrCreateInstance("[x-ref='challengeWindow']");

    // TODO: Get rid of this private attribute access
    // See https://github.com/twbs/bootstrap/issues/31266
    modal._element.addEventListener(
      "hidden.bs.modal",
      event => {
        // Dispatch load-challenge event to call loadChallenge in the ChallengeBoard
        Alpine.nextTick(() => {
          this.$dispatch("load-challenge", this.getNextId());
        });
      },
      { once: true },
    );
    modal.hide();
  },

  async getShareUrl() {
    let body = {
      type: "solve",
      challenge_id: this.id,
    };
    const response = await CTFd.fetch("/api/v1/shares", {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await response.json();
    const url = data["data"]["url"];
    this.share_url = url;
  },

  copyShareUrl() {
    navigator.clipboard.writeText(this.share_url);
    let t = Tooltip.getOrCreateInstance(this.$el);
    t.enable();
    t.show();
    setTimeout(() => {
      t.hide();
      t.disable();
    }, 2000);
  },

  async submitChallenge() {
    this.response = await CTFd.pages.challenge.submitChallenge(
      this.id,
      this.submission,
    );

    // Challenges page might be visible to anonymous users, redirect to login on submit
    if (this.response.data.status === "authentication_required") {
      window.location = `${CTFd.config.urlRoot}/login?next=${CTFd.config.urlRoot}${window.location.pathname}${window.location.hash}`;
      return;
    }

    await this.renderSubmissionResponse();
  },

  async renderSubmissionResponse() {
    this.resetRepeatSolvePanel();

    if (this.response.data.status === "correct") {
      this.submission = "";
      await this.prepareCorrectPanel();
    } else if (this.isIncorrectAfterSolved()) {
      this.resetCorrectPanelAnimations();
      await this.prepareRepeatSolvePanel("incorrect_after_solved");
    } else if (this.isAlreadySolvedStatus()) {
      this.resetCorrectPanelAnimations();
      this.submission = "";
      await this.prepareRepeatSolvePanel("already_solved");
    } else if (this.response.data.status === "incorrect") {
      this.resetCorrectPanelAnimations();
      this.triggerIncorrectFeedback();
    } else {
      this.resetCorrectPanelAnimations();
    }

    // Decide whether to check for the solution
    if (this.getSolutionId() == null) {
      if (
        CTFd.pages.challenge.checkSolution(
          this.getSolutionState(),
          Alpine.store("challenge").data,
          this.response.data.status,
        )
      ) {
        let data = await CTFd.pages.challenge.getSolution(this.id);
        this.setSolutionId(data.id);
      }
    }

    // Increment attempts counter
    if (
      this.max_attempts > 0 &&
      this.response.data.status != "already_solved" &&
      this.response.data.status != "ratelimited"
    ) {
      this.attempts += 1;
    }

    // Dispatch load-challenges event to call loadChallenges in the ChallengeBoard
    this.$dispatch("load-challenges");
  },

  isIncorrectAfterSolved() {
    const status = this.response?.data?.status;
    const message = String(this.response?.data?.message || "").toLowerCase();
    return (
      status === "already_solved" &&
      message.includes("incorrect") &&
      message.includes("already solved")
    );
  },

  isAlreadySolvedStatus() {
    return (
      this.response?.data?.status === "already_solved" &&
      !this.isIncorrectAfterSolved()
    );
  },

  async prepareRepeatSolvePanel(mode) {
    const solvedAt = await this.fetchOriginalSolveDate();

    if (!this.response || (!this.isIncorrectAfterSolved() && !this.isAlreadySolvedStatus())) {
      return;
    }

    if (mode === "already_solved") {
      this.repeatSolvePanel = {
        variant: "green",
        badge: "check",
        title: "Correct flag",
        subtitle: "You've already claimed these points",
        info: "You solved this before - no additional points awarded. Your original solve still counts.",
        solvedAt,
      };
      return;
    }

    this.repeatSolvePanel = {
      variant: "indigo",
      badge: "x",
      title: "Wrong flag",
      subtitle: "But you already cracked this one",
      info: "Your points are safe - this submission won't affect your score.",
      solvedAt,
    };
  },

  async fetchOriginalSolveDate() {
    if (this.originalSolveTimestamp) {
      return this.formatSolveDate(this.originalSolveTimestamp);
    }

    try {
      const earliestSolveDate = await this.findOriginalSolveTimestamp();

      if (!earliestSolveDate) {
        return "--";
      }

      this.originalSolveTimestamp = earliestSolveDate;
      return this.formatSolveDate(earliestSolveDate);
    } catch (error) {
      console.log("Unable to load original solve timestamp");
      console.log(error);
      return "--";
    }
  },

  async findOriginalSolveTimestamp() {
    const accountId = this.getCurrentAccountId();
    const challengeSolves = await CTFd.pages.challenge.loadSolves(this.id);
    const matchingChallengeSolve = (Array.isArray(challengeSolves) ? challengeSolves : [])
      .filter(solve => Number(solve?.account_id) === accountId && solve?.date)
      .sort((left, right) => new Date(left.date) - new Date(right.date))[0];

    if (matchingChallengeSolve?.date) {
      return matchingChallengeSolve.date;
    }

    const solvesResponse =
      CTFd.config.userMode === "teams"
        ? await CTFd.pages.teams.teamSolves("me")
        : await CTFd.pages.users.userSolves("me");

    const solves = Array.isArray(solvesResponse?.data) ? solvesResponse.data : [];
    const earliestSolve = solves
      .filter(solve => Number(solve?.challenge_id) === Number(this.id) && solve?.date)
      .sort((left, right) => new Date(left.date) - new Date(right.date))[0];

    if (earliestSolve?.date) {
      return earliestSolve.date;
    }

    const submissionsResponse = await CTFd.pages.users.userSubmissions("me", this.id);
    const submissions = Array.isArray(submissionsResponse?.data)
      ? submissionsResponse.data
      : [];

    return submissions
      .filter(submission => submission?.type === "correct" && submission?.date)
      .sort((left, right) => new Date(left.date) - new Date(right.date))[0]?.date;
  },

  getCurrentAccountId() {
    if (CTFd.config.userMode === "teams" && CTFd.team?.id) {
      return Number(CTFd.team.id);
    }

    return Number(CTFd.user?.id);
  },

  formatSolveDate(dateValue) {
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    return intl.format(date);
  },

  resetRepeatSolvePanel() {
    this.repeatSolvePanel = {
      variant: "",
      badge: "",
      title: "",
      subtitle: "",
      info: "",
      solvedAt: "--",
    };
  },

  triggerIncorrectFeedback() {
    Alpine.nextTick(() => {
      const input = this.$refs.challengeInput;

      if (!input) {
        return;
      }

      input.classList.remove("challenge-input--shake");
      void input.offsetWidth;
      input.classList.add("challenge-input--shake");
      input.focus();

      setTimeout(() => {
        input.classList.remove("challenge-input--shake");
      }, 520);
    });
  },

  async prepareCorrectPanel() {
    const points = Number(this.challengeValue) || 0;

    this.correctPanel = {
      isFirstBlood: Number(this.initialSolveCount || 0) === 0,
      points,
      pointsDisplay: 0,
      rank: "...",
      solveTime: this.formatSolveDuration(Date.now() - this.openedAt),
    };

    const rank = await this.fetchCurrentRank();

    if (!this.response || this.response.data.status !== "correct") {
      return;
    }

    this.correctPanel.rank = rank ? `#${rank}` : "--";

    Alpine.nextTick(() => {
      this.animatePointsCounter(points);
      this.fireSuccessParticles();
    });
  },

  async fetchCurrentRank() {
    try {
      const standings = await CTFd.pages.scoreboard.getScoreboard();
      if (!Array.isArray(standings)) {
        return null;
      }

      const targetId =
        CTFd.config.userMode === "teams" && CTFd.team.id
          ? Number(CTFd.team.id)
          : Number(CTFd.user.id);

      const standing = standings.find(
        entry => Number(entry.account_id) === targetId,
      );

      return standing?.pos ?? null;
    } catch (error) {
      console.log("Unable to load updated rank");
      console.log(error);
      return null;
    }
  },

  formatSolveDuration(durationMs) {
    const totalSeconds = Math.max(1, Math.ceil(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return [hours, minutes, seconds]
        .map(value => String(value).padStart(2, "0"))
        .join(":");
    }

    return [minutes, seconds]
      .map(value => String(value).padStart(2, "0"))
      .join(":");
  },

  animatePointsCounter(targetValue) {
    if (this.pointsAnimationFrame) {
      cancelAnimationFrame(this.pointsAnimationFrame);
    }

    const startTime = performance.now();
    const duration = 900;

    const step = now => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.correctPanel.pointsDisplay = Math.round(targetValue * eased);

      if (progress < 1) {
        this.pointsAnimationFrame = requestAnimationFrame(step);
      } else {
        this.pointsAnimationFrame = null;
      }
    };

    this.pointsAnimationFrame = requestAnimationFrame(step);
  },

  fireSuccessParticles() {
    if (!this.$refs.solveSuccessPanel || !this.$refs.solveBurstCanvas || !this.$refs.solveBadge) {
      return;
    }

    if (this.particleAnimationFrame) {
      cancelAnimationFrame(this.particleAnimationFrame);
    }

    const panel = this.$refs.solveSuccessPanel;
    const canvas = this.$refs.solveBurstCanvas;
    const badge = this.$refs.solveBadge;
    const panelRect = panel.getBoundingClientRect();
    const badgeRect = badge.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = panelRect.width * dpr;
    canvas.height = panelRect.height * dpr;
    canvas.style.width = `${panelRect.width}px`;
    canvas.style.height = `${panelRect.height}px`;

    const context = canvas.getContext("2d");
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const originX = badgeRect.left - panelRect.left + badgeRect.width / 2;
    const originY = badgeRect.top - panelRect.top + badgeRect.height / 2;

    const particles = Array.from({ length: 26 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4.8;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 1.2),
        radius: 1.4 + Math.random() * 2.6,
        alpha: 0.95,
        decay: 0.014 + Math.random() * 0.012,
      };
    });

    const render = () => {
      context.clearRect(0, 0, panelRect.width, panelRect.height);

      particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.985;
        particle.vy = particle.vy * 0.985 + 0.03;
        particle.alpha -= particle.decay;

        if (particle.alpha <= 0) {
          return;
        }

        context.beginPath();
        context.fillStyle = `rgba(34, 197, 94, ${particle.alpha})`;
        context.shadowColor = "rgba(34, 197, 94, 0.7)";
        context.shadowBlur = 14;
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      });

      if (particles.some(particle => particle.alpha > 0)) {
        this.particleAnimationFrame = requestAnimationFrame(render);
      } else {
        context.clearRect(0, 0, panelRect.width, panelRect.height);
        this.particleAnimationFrame = null;
      }
    };

    this.particleAnimationFrame = requestAnimationFrame(render);
  },

  resetCorrectPanelAnimations() {
    if (this.pointsAnimationFrame) {
      cancelAnimationFrame(this.pointsAnimationFrame);
      this.pointsAnimationFrame = null;
    }

    if (this.particleAnimationFrame) {
      cancelAnimationFrame(this.particleAnimationFrame);
      this.particleAnimationFrame = null;
    }
  },

  async submitRating() {
    const response = await CTFd.pages.challenge.submitRating(
      this.id,
      this.selectedRating,
      this.ratingReview,
    );
    if (response.value) {
      this.ratingValue = this.selectedRating;
      this.ratingSubmitted = true;
    } else {
      alert("Error submitting rating");
    }
  },
}));

Alpine.data("ChallengeBoard", () => ({
  loaded: false,
  challenges: [],
  challenge: null,
  selectedStatus: "all",
  selectedCategory: "all",

  updateHeaderStats() {
    const solvedCount = this.challenges.filter(challenge => challenge.solved_by_me).length;
    const totalCount = this.challenges.length;
    const categoryCount = this.getCategories().length;
    const completionPercent = totalCount
      ? Math.round((solvedCount / totalCount) * 100)
      : 0;

    const solvedEl = document.getElementById("solved-count");
    const totalEl = document.getElementById("total-count");
    const categoryEl = document.getElementById("category-count");
    const progressFillEl = document.getElementById("challenge-progress-fill");
    const progressCopyEl = document.getElementById("challenge-progress-copy");

    if (solvedEl) solvedEl.textContent = solvedCount;
    if (totalEl) totalEl.textContent = totalCount;
    if (categoryEl) categoryEl.textContent = categoryCount;
    if (progressFillEl) progressFillEl.style.width = `${completionPercent}%`;
    if (progressCopyEl) {
      progressCopyEl.textContent = totalCount
        ? `${completionPercent}% complete`
        : "No cases loaded";
    }
  },

  async init() {
    this.challenges = await CTFd.pages.challenges.getChallenges();
    this.updateHeaderStats();
    this.loaded = true;

    if (window.location.hash) {
      let chalHash = decodeURIComponent(window.location.hash.substring(1));
      let idx = chalHash.lastIndexOf("-");
      if (idx >= 0) {
        let pieces = [chalHash.slice(0, idx), chalHash.slice(idx + 1)];
        let id = pieces[1];
        await this.loadChallenge(id);
      }
    }
  },

  getCategories() {
    return this.getSortedCategories(this.challenges);
  },

  getSortedCategories(challengeList) {
    const categories = [];

    challengeList.forEach(challenge => {
      const { category } = challenge;

      if (!categories.includes(category)) {
        categories.push(category);
      }
    });

    try {
      const f = CTFd.config.themeSettings.challenge_category_order;
      if (f) {
        const getSort = new Function(`return (${f})`);
        categories.sort(getSort());
      }
    } catch (error) {
      // Ignore errors with theme category sorting
      console.log("Error running challenge_category_order function");
      console.log(error);
    }

    return categories;
  },

  getVisibleCategories() {
    return this.getSortedCategories(this.getVisibleChallenges());
  },

  getVisibleChallenges() {
    let challenges = [...this.challenges];

    if (this.selectedStatus === "solved") {
      challenges = challenges.filter(challenge => challenge.solved_by_me);
    } else if (this.selectedStatus === "unsolved") {
      challenges = challenges.filter(challenge => !challenge.solved_by_me);
    }

    if (this.selectedCategory !== "all") {
      challenges = challenges.filter(
        challenge => challenge.category === this.selectedCategory,
      );
    }

    try {
      const f = CTFd.config.themeSettings.challenge_order;
      if (f) {
        const getSort = new Function(`return (${f})`);
        challenges.sort(getSort());
      }
    } catch (error) {
      // Ignore errors with theme challenge sorting
      console.log("Error running challenge_order function");
      console.log(error);
    }

    return challenges;
  },

  getChallenges(category) {
    let challenges = this.getVisibleChallenges();

    if (category !== null) {
      challenges = challenges.filter(challenge => challenge.category === category);
    }

    return challenges;
  },

  hasActiveFilters() {
    return this.selectedStatus !== "all" || this.selectedCategory !== "all";
  },

  clearFilters() {
    this.selectedStatus = "all";
    this.selectedCategory = "all";
  },

  async loadChallenges() {
    this.challenges = await CTFd.pages.challenges.getChallenges();
    this.updateHeaderStats();
  },

  async loadChallenge(challengeId) {
    await CTFd.pages.challenge.displayChallenge(challengeId, challenge => {
      challenge.data.view = addTargetBlank(challenge.data.view);
      Alpine.store("challenge").data = challenge.data;

      // nextTick is required here because we're working in a callback
      Alpine.nextTick(() => {
        let modal = Modal.getOrCreateInstance("[x-ref='challengeWindow']");
        // TODO: Get rid of this private attribute access
        // See https://github.com/twbs/bootstrap/issues/31266
        modal._element.addEventListener(
          "hidden.bs.modal",
          event => {
            // Remove location hash
            history.replaceState(null, null, " ");
          },
          { once: true },
        );
        modal.show();
        history.replaceState(null, null, `#${challenge.data.name}-${challengeId}`);
      });
    });
  },
}));

Alpine.start();
