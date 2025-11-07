// registerSW.js
export function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  // if (import.meta.env.DEV) {
  //   console.info("SW deshabilitado en desarrollo");
  //   return;
  // }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => console.log("SW registrado:", reg.scope))
      .catch((err) => console.error("Error registrando SW:", err));
  });
}
