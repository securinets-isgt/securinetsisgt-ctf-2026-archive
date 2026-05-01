import Alpine from "alpinejs";
import CTFd from "../index";
import { createUserGraphs } from "./user-graphs";

window.Alpine = Alpine;
window.CTFd = CTFd;

Alpine.data("UserGraphs", () =>
  createUserGraphs({
    userId: window.USER?.id || CTFd.user?.id,
    userName: window.USER?.name || CTFd.user?.name,
  }),
);

Alpine.start();
