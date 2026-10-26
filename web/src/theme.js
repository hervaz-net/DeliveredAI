// Design directions under review. Choose with ?theme=<id>; the choice is remembered in this browser.
export const THEMES = {
  midnight: { name: 'Midnight Lime', fonts: 'Inter:wght@400;500;600;700;800' },
  freight: { name: 'Freight', fonts: 'Archivo:wght@400;500;600;700;800&family=Archivo+Black' },
  mint: { name: 'Mint', fonts: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
  blueprint: { name: 'Blueprint', fonts: 'IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600' },
  editorial: { name: 'Editorial', fonts: 'Inter:wght@400;500;600;700&family=Instrument+Serif' },
  sunset: { name: 'Sunset', fonts: 'DM+Sans:wght@400;500;600;700;800&family=DM+Serif+Display' },
  neon: { name: 'Neon', fonts: 'Space+Grotesk:wght@400;500;600;700' },
  hivis: { name: 'Hi-Vis', fonts: 'Barlow:wght@400;500;600;700;800&family=Barlow+Condensed:wght@700;800' },
  forest: { name: 'Forest', fonts: 'Manrope:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600' },
  ocean: { name: 'Ocean', fonts: 'Outfit:wght@400;500;600;700;800' },
};
export const DEFAULT_THEME = 'midnight';

export function applyTheme() {
  let id = new URLSearchParams(window.location.search).get('theme');
  try {
    if (id && THEMES[id]) localStorage.setItem('dai_theme', id);
    else id = localStorage.getItem('dai_theme');
  } catch {
    // storage unavailable; fall through to default
  }
  if (!THEMES[id]) id = DEFAULT_THEME;
  document.documentElement.dataset.theme = id;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${THEMES[id].fonts}&display=swap`;
  document.head.appendChild(link);
}
