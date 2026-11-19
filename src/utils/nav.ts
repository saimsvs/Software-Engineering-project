import type { Href, useRouter } from "expo-router";

type Router = ReturnType<typeof useRouter>;

/**
 * Go to `href` and forget the screens behind it, so the back button can't
 * return there. Use when crossing the logged-in / logged-out boundary
 * (login success, logout) — otherwise e.g. Home stays under Login after
 * logging out and "back" lands a logged-out user inside the app.
 */
export function resetTo(router: Router, href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}

/**
 * Return to the Login screen that's already in the history (instead of pushing
 * a second copy on top), or open it if there isn't one.
 */
export function backToLogin(router: Router, params?: Record<string, string>) {
  router.dismissTo(params ? { pathname: "/login", params } : "/login");
}
