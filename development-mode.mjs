// Acceso temporal para pruebas. Cambiar a false antes del lanzamiento.
// Nunca modificar estrellas, records ni los desbloqueos reales del usuario.
export const DEVELOPMENT_UNLOCKS = true;

export function visibleCampaignProgress(data, progress, enabled=DEVELOPMENT_UNLOCKS) {
  if (!enabled) return progress;
  return {...progress, unlocked: {
    days: data.days.map(d=>d.id),
    brotherhoods: data.brotherhoods.map(b=>b.id),
    routes: data.routes.filter(r=>r.playable!==false).map(r=>r.id)
  }};
}

// Los botones clásicos comprueban 'libre' para decidir si mostrar candados.
// Solo fingimos ese permiso en los menús del juego original: las partidas
// continúan siendo Clásicas y los tiempos/estampitas reales no se alteran.
export function developmentMenuPreference(menuName,key,enabled=DEVELOPMENT_UNLOCKS) {
  return enabled && key==='libre' && ['MenuEligePaso','MenuEligeMapa','MenuDefPasos'].includes(menuName) ? 1 : null;
}
