import CTFd from "../index";

import Alpine from "alpinejs";
import { createTeamGraphs } from "./team-graphs";

window.Alpine = Alpine;
window.CTFd = CTFd;

Alpine.data("TeamGraphs", () =>
  createTeamGraphs({
    teamId: window.TEAM?.id,
    teamName: window.TEAM?.name,
  }),
);

Alpine.start();
