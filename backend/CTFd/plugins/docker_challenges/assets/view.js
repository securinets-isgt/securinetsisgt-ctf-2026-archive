(function () {
  const state = (window.__dockerChallengeViewState =
    window.__dockerChallengeViewState || {
      dockerStatusTimer: null,
      checkInterval: null,
      originalConnectionInfoHtml: null,
      dockerNoticeState: null,
    });

  CTFd._internal.challenge.data = undefined;
  CTFd._internal.challenge.renderer = CTFd._internal.markdown;

  CTFd._internal.challenge.preRender = function () {};

  CTFd._internal.challenge.render = function (markdown) {
    return CTFd._internal.challenge.renderer.parse(markdown);
  };

  CTFd._internal.challenge.postRender = function () {
    state.originalConnectionInfoHtml = null;
    state.dockerNoticeState = null;
    clearDockerStatusTimer();
    captureOriginalConnectionInfo();
    renderDockerIdleState();
    get_docker_status(CTFd._internal.challenge.data.docker_image);
    startCorrectFlagWatcher();
  };

  function captureOriginalConnectionInfo() {
    const $link = CTFd.lib.$(".challenge-connection-info");
    if ($link.length && state.originalConnectionInfoHtml === null) {
      state.originalConnectionInfoHtml = $link.html();
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function setDockerState(label, isLive) {
    const $state = CTFd.lib.$("[data-docker-state]");
    const $label = CTFd.lib.$("[data-docker-state-label]");
    $label.text(label);
    $state.toggleClass("is-live", !!isLive);
  }

  function clearDockerStatusTimer() {
    if (state.dockerStatusTimer) {
      clearInterval(state.dockerStatusTimer);
      state.dockerStatusTimer = null;
    }
  }

  function clearDockerNotice() {
    state.dockerNoticeState = null;
    const $notice = CTFd.lib.$("[data-docker-notice]");
    $notice.removeClass("is-visible is-success is-error");
    $notice.empty();
  }

  function showDockerNotice(variant, title, message) {
    state.dockerNoticeState = { variant, title, message };
    const icon = variant === "success" ? "fa-check" : "fa-triangle-exclamation";
    const $notice = CTFd.lib.$("[data-docker-notice]");
    $notice
      .removeClass("is-success is-error")
      .addClass("is-visible")
      .addClass(variant === "success" ? "is-success" : "is-error")
      .html(`
        <span class="docker-instance-card__notice-icon">
          <i class="fas ${icon}"></i>
        </span>
        <span class="docker-instance-card__notice-copy">
          <span class="docker-instance-card__notice-title">${escapeHtml(title)}</span>
          <span class="docker-instance-card__notice-text">${message}</span>
        </span>
      `);
  }

  function applyDockerNoticeState() {
    if (!state.dockerNoticeState) {
      const $notice = CTFd.lib.$("[data-docker-notice]");
      $notice.removeClass("is-visible is-success is-error");
      $notice.empty();
      return;
    }

    showDockerNotice(
      state.dockerNoticeState.variant,
      state.dockerNoticeState.title,
      state.dockerNoticeState.message,
    );
  }

  function getLinkTemplate() {
    captureOriginalConnectionInfo();
    const html = state.originalConnectionInfoHtml;
    if (!html) {
      return null;
    }

    const match = html.match(/https?:\/\/host:port[^\s<"]*/i);
    return match ? match[0] : null;
  }

  function applyConnectionInfo(host, port) {
    const $link = CTFd.lib.$(".challenge-connection-info");
    if (!$link.length) {
      return;
    }

    const template = getLinkTemplate();
    const finalLink = template
      ? template.replace(/host/gi, host).replace(/port/gi, port)
      : `http://${host}:${port}/`;

    $link.html(`<a href="${finalLink}" target="_blank" rel="noopener noreferrer">${finalLink}</a>`);
  }

  function buildPortLinks(host, ports) {
    return ports
      .map(port => {
        const portText = String(port).split("/")[0];
        const href = `http://${host}:${portText}/`;
        return `
          <a class="docker-instance-card__port-link" href="${href}" target="_blank" rel="noopener noreferrer">
            <i class="fas fa-satellite-dish"></i>
            ${escapeHtml(host)}:${escapeHtml(portText)}
          </a>
        `;
      })
      .join("");
  }

  window.handleUnavailableAction = function (message) {
    showDockerNotice("error", "Action unavailable", message);
    return false;
  };

  function renderDockerIdleState() {
    clearDockerStatusTimer();
    setDockerState("Offline", false);
    if (state.originalConnectionInfoHtml !== null) {
      CTFd.lib.$(".challenge-connection-info").html(state.originalConnectionInfoHtml);
    }
    CTFd.lib.$("[data-docker-body]").html(`
      <div class="docker-instance-card__notice" data-docker-notice></div>
      <p class="docker-instance-card__hint">
        Start an instance to reveal the live service link and timers.
      </p>
      <div class="docker-instance-card__actions">
        <a onclick="return window.start_container('${CTFd._internal.challenge.data.docker_image}');" class="docker-instance-card__button docker-instance-card__button--primary">
          <i class="fas fa-play"></i>
          Start Instance
        </a>
      </div>
    `);
    applyDockerNoticeState();
  }

  function renderDockerLoadingState() {
    setDockerState("Starting", true);
    CTFd.lib.$("[data-docker-body]").html(`
      <div class="docker-instance-card__notice" data-docker-notice></div>
      <div class="docker-instance-card__spinner">
        <i class="fas fa-circle-notch fa-spin"></i>
        Preparing your isolated challenge instance...
      </div>
    `);
    applyDockerNoticeState();
  }

  function renderDockerActiveState(item) {
    clearDockerStatusTimer();

    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const actionReadyIn = Math.max(0, item.revert_time - now);
      const expiresIn = Math.max(0, item.expires_at - now);
      const controlsReady = actionReadyIn <= 0;

      setDockerState("Live", true);

      const restartAction = controlsReady
        ? `return window.start_container('${item.docker_image}');`
        : `return window.handleUnavailableAction('Restart and stop unlock after 1 minute from instance creation.');`;
      const stopAction = controlsReady
        ? `return window.stop_container('${item.docker_image}');`
        : `return window.handleUnavailableAction('Restart and stop unlock after 1 minute from instance creation.');`;

      CTFd.lib.$("[data-docker-body]").html(`
        <div class="docker-instance-card__notice" data-docker-notice></div>
        <div class="docker-instance-card__meta">
          <div class="docker-instance-card__meta-box">
            <span class="docker-instance-card__meta-label">Reachable Host</span>
            <span class="docker-instance-card__meta-value">${escapeHtml(item.host)}</span>
          </div>
          <div class="docker-instance-card__meta-box">
            <span class="docker-instance-card__meta-label">Restart / Stop</span>
            <span class="docker-instance-card__meta-value">${controlsReady ? "Ready" : formatDuration(actionReadyIn)}</span>
          </div>
          <div class="docker-instance-card__meta-box">
            <span class="docker-instance-card__meta-label">Instance Expires In</span>
            <span class="docker-instance-card__meta-value">${formatDuration(expiresIn)}</span>
          </div>
        </div>
        <div class="docker-instance-card__ports">
          ${buildPortLinks(item.host, item.ports)}
        </div>
        <p class="docker-instance-card__hint">
          Instance lifetime: 2 hours. Restart and stop unlock after 1 minute.
        </p>
        <div class="docker-instance-card__actions">
          <a onclick="${restartAction}" class="docker-instance-card__button docker-instance-card__button--primary" ${controlsReady ? "" : "disabled"}>
            <i class="fas fa-rotate-right"></i>
            Restart Instance
          </a>
          <a onclick="${stopAction}" class="docker-instance-card__button docker-instance-card__button--danger" ${controlsReady ? "" : "disabled"}>
            <i class="fas fa-stop"></i>
            Stop Instance
          </a>
        </div>
      `);

      if (item.ports && item.ports.length) {
        applyConnectionInfo(item.host, String(item.ports[0]).split("/")[0]);
      }

      applyDockerNoticeState();

      if (expiresIn <= 0) {
        clearDockerStatusTimer();
        get_docker_status(item.docker_image);
      }
    };

    update();
    state.dockerStatusTimer = setInterval(update, 1000);
  }

  function get_docker_status(container) {
    const currentChallengeName = CTFd._internal.challenge.data.name;
    CTFd.fetch("/api/v1/docker_status")
      .then(response => response.json())
      .then(result => {
        const match = (result.data || []).find(
          item =>
            item.challenge === currentChallengeName ||
            (item.challenge == null && item.docker_image === container),
        );
        if (match) {
          renderDockerActiveState(match);
        } else {
          renderDockerIdleState();
        }
      })
      .catch(error => {
        console.error("Error fetching docker status:", error);
        renderDockerIdleState();
      });
  }

  window.stop_container = function (container) {
    CTFd.fetch(
      "/api/v1/container?name=" +
        encodeURIComponent(container) +
        "&challenge=" +
        encodeURIComponent(CTFd._internal.challenge.data.name) +
        "&stopcontainer=True",
      {
        method: "GET",
      },
    )
      .then(response =>
        response.json().then(json => {
          if (response.ok) {
            renderDockerIdleState();
            showDockerNotice(
              "success",
              "Instance stopped",
              "The challenge instance has been stopped. You can start a fresh one whenever you need it.",
            );
          } else {
            throw new Error(json.message || "Failed to stop container");
          }
        }),
      )
      .catch(function (error) {
        showDockerNotice(
          "error",
          "Unable to stop instance",
          error.message || "An unknown error occurred while stopping the instance.",
        );
        get_docker_status(container);
      });

    return false;
  };

  window.start_container = function (container) {
    renderDockerLoadingState();

    CTFd.fetch(
      "/api/v1/container?name=" +
        encodeURIComponent(container) +
        "&challenge=" +
        encodeURIComponent(CTFd._internal.challenge.data.name),
      {
        method: "GET",
      },
    )
      .then(response =>
        response.json().then(json => {
          if (response.ok) {
            get_docker_status(container);
            setTimeout(() => {
              showDockerNotice(
                "success",
                "Instance ready",
                "Your container is live. Restart and stop unlock after 1 minute.",
              );
            }, 50);
          } else {
            throw new Error(json.message || "Failed to start container");
          }
        }),
      )
      .catch(function (error) {
        get_docker_status(container);
        setTimeout(() => {
          showDockerNotice(
            "error",
            "Unable to start instance",
            error.message || "An unknown error occurred when starting your Docker container.",
          );
        }, 50);
      });

    return false;
  };

  function startCorrectFlagWatcher() {
    if (state.checkInterval) {
      clearInterval(state.checkInterval);
    }

    state.checkInterval = setInterval(function checkForCorrectFlag() {
      const challengeWindow = document.querySelector("#challenge-window");
      if (!challengeWindow || getComputedStyle(challengeWindow).display === "none") {
        clearInterval(state.checkInterval);
        state.checkInterval = null;
        clearDockerStatusTimer();
        return;
      }

      const notification = document.querySelector(".notification-row .alert");
      if (!notification) return;

      const strong = notification.querySelector("strong");
      if (!strong) return;

      const message = strong.textContent.trim();
      if (message.includes("Correct")) {
        get_docker_status(CTFd._internal.challenge.data.docker_image);
        clearInterval(state.checkInterval);
        state.checkInterval = null;
      }
    }, 1500);
  }
})();
