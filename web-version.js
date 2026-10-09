/* Aviso de nuevas versiones. Nunca reinicia una partida en marcha. */
(() => {
  'use strict';
  const INSTALLED_VERSION = 'dev-2026.10.09.1';
  const VERSION_URL = '/version.json';
  const POLL_MS = 60000;
  let nextVersion = null;
  let banner;
  let button;
  let message;
  let busy = false;

  function inActiveGame() {
    const hud = document.getElementById('hud');
    return Boolean(hud && !hud.hidden);
  }
  function showIfSafe() {
    if (!nextVersion || !banner) return;
    banner.hidden = inActiveGame();
    if (!banner.hidden) {
      message.textContent = `Nueva versión ${nextVersion} disponible. Puedes actualizar sin borrar el progreso de este navegador.`;
    }
  }
  function mount() {
    banner = document.createElement('aside');
    banner.id = 'update-available';
    banner.hidden = true;
    banner.setAttribute('aria-live', 'polite');
    const icon = document.createElement('span');
    icon.textContent = '↻';
    icon.setAttribute('aria-hidden', 'true');
    message = document.createElement('span');
    message.className = 'update-message';
    button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Actualizar';
    button.addEventListener('click', () => {
      if (inActiveGame()) { showIfSafe(); return; }
      location.reload();
    });
    const dismiss = document.createElement('button');
    dismiss.type='button';
    dismiss.className='update-dismiss';
    dismiss.textContent='Ahora no';
    dismiss.addEventListener('click', () => { banner.hidden = true; });
    banner.append(icon, message, button, dismiss);
    document.body.appendChild(banner);
    const hud = document.getElementById('hud');
    if (hud) new MutationObserver(showIfSafe).observe(hud, {attributes:true,attributeFilter:['hidden']});
  }
  async function check() {
    if (busy || document.visibilityState === 'hidden') return;
    busy = true;
    try {
      const response = await fetch(VERSION_URL + '?t=' + Date.now(), {cache:'no-store'});
      if (!response.ok) return;
      const data = await response.json();
      if (typeof data.version === 'string' && data.version !== INSTALLED_VERSION) {
        nextVersion = data.version;
        showIfSafe();
      }
    } catch (_) { /* sin conexión: el juego continúa */ }
    finally { busy = false; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
  window.addEventListener('pageshow', check);
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(check, POLL_MS);
})();
