import CTFd from "../index";

import Alpine from "alpinejs";
import { createUserGraphs } from "./user-graphs";

window.Alpine = Alpine;
window.CTFd = CTFd;

Alpine.data("UserGraphs", () =>
  createUserGraphs({
    userId: window.USER?.id,
    userName: window.USER?.name,
  }),
);

Alpine.start();
