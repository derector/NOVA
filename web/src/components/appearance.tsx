'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

const tints = {
  ice: 'Лёд',
  ruby: 'Рубин',
  amethyst: 'Аметист',
  emerald: 'Изумруд',
  amber: 'Янтарь',
} as const;
const themes = { system: 'Как на устройстве', dark: 'Тёмная', light: 'Светлая' } as const;
const preferenceKey = 'nova.appearance';
const changeEvent = 'nova:appearance';

type Preferences = {
  theme: keyof typeof themes;
  tint: keyof typeof tints;
  atmosphere: boolean;
};

type Atmosphere = 'snow' | 'blossom' | 'sunlight' | 'leaves' | 'rain' | 'fog';
const defaults: Preferences = { theme: 'system', tint: 'emerald', atmosphere: true };
const defaultSnapshot = JSON.stringify(defaults);
let memorySnapshot = defaultSnapshot;

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

function getSnapshot() {
  try { return window.localStorage.getItem(preferenceKey) ?? defaultSnapshot; }
  catch { return memorySnapshot; }
}

function getPreferences(snapshot: string): Preferences {
  try {
    const value = JSON.parse(snapshot) as Partial<Preferences> | null;
    return {
      theme: value?.theme && Object.hasOwn(themes, value.theme) ? value.theme : defaults.theme,
      tint: value?.tint && Object.hasOwn(tints, value.tint) ? value.tint : defaults.tint,
      atmosphere: typeof value?.atmosphere === 'boolean' ? value.atmosphere : defaults.atmosphere,
    };
  } catch { return defaults; }
}

function usePreferences() {
  return getPreferences(useSyncExternalStore(subscribe, getSnapshot, () => defaultSnapshot));
}

function updatePreferences(changes: Partial<Preferences>) {
  memorySnapshot = JSON.stringify({ ...getPreferences(getSnapshot()), ...changes });
  try { window.localStorage.setItem(preferenceKey, memorySnapshot); } catch { /* This tab keeps the preference in memory. */ }
  window.dispatchEvent(new Event(changeEvent));
}

function seasonalAtmosphere(): Atmosphere {
  const month = new Date().getMonth();
  if (month === 11 || month < 2) return 'snow';
  if (month < 5) return 'blossom';
  if (month < 8) return 'sunlight';
  return 'leaves';
}

function conditionsForWeatherCode(code: number): Atmosphere | null {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return 'rain';
  if ([3, 45, 48].includes(code)) return 'fog';
  if ([0, 1].includes(code)) return 'sunlight';
  return null;
}

const atmosphericParticles = Array.from({ length: 13 }, (_, index) => ({
  left: `${(index * 47 + 17) % 100}%`,
  delay: `-${index * 1.71}s`,
  duration: `${13 + (index % 5) * 2.5}s`,
}));

export function Appearance({ children }: { children: ReactNode }) {
  const { tint, theme, atmosphere } = usePreferences();
  const seasonal = useSyncExternalStore(subscribe, seasonalAtmosphere, () => null);
  const [weather, setWeather] = useState<Atmosphere | null>(null);
  const [weatherState, setWeatherState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const weatherRequest = useRef(0);
  const weatherFetch = useRef<AbortController | null>(null);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  const ambience = atmosphere ? weather ?? seasonal : null;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.tint = tint;
  }, [theme, tint]);

  useEffect(() => {
    const open = () => setAppearanceOpen(true);
    window.addEventListener('nova:open-appearance', open);
    return () => window.removeEventListener('nova:open-appearance', open);
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (appearanceOpen && element && !element.open) element.showModal();
    if (!appearanceOpen && element?.open) element.close();
  }, [appearanceOpen]);

  useEffect(() => () => {
    weatherRequest.current += 1;
    weatherFetch.current?.abort();
  }, []);

  function resetWeather() {
    weatherRequest.current += 1;
    weatherFetch.current?.abort();
    setWeather(null);
    setWeatherState('idle');
  }

  function requestWeather() {
    resetWeather();
    if (!navigator.geolocation) {
      setWeatherState('error');
      return;
    }
    setWeatherState('loading');
    const request = weatherRequest.current;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (request !== weatherRequest.current) return;
      const controller = new AbortController();
      weatherFetch.current = controller;
      const query = new URLSearchParams({
        latitude: coords.latitude.toFixed(1),
        longitude: coords.longitude.toFixed(1),
        current: 'weather_code',
      });
      void fetch(`https://api.open-meteo.com/v1/forecast?${query}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]),
        referrerPolicy: 'no-referrer',
      }).then(async (response) => {
        if (!response.ok) throw new Error(`Weather HTTP ${response.status}`);
        const value = await response.json() as { current?: { weather_code?: number } };
        if (typeof value.current?.weather_code !== 'number') throw new Error('Weather code missing');
        if (request !== weatherRequest.current) return;
        setWeather(conditionsForWeatherCode(value.current.weather_code));
        setWeatherState('ready');
      }).catch(() => {
        if (request === weatherRequest.current) setWeatherState('error');
      });
    }, () => {
      if (request === weatherRequest.current) setWeatherState('error');
    }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 });
  }

  return <>
    {ambience && <div className="ambience" data-ambience={ambience} aria-hidden="true">
      {ambience !== 'fog' && ambience !== 'sunlight' && atmosphericParticles.map((particle) =>
        <i key={particle.left} style={{ left: particle.left, animationDelay: particle.delay, animationDuration: particle.duration }} />)}
    </div>}
    {children}
    <dialog className="glass-dialog appearance-dialog" ref={dialog} onClose={() => setAppearanceOpen(false)} aria-labelledby="appearance-title">
      <div className="modal-head"><h2 id="appearance-title">Оформление</h2><form method="dialog"><button className="icon-button" aria-label="Закрыть настройки">×</button></form></div>
      <div className="settings-group">
        <label className="settings-row">Тема <select value={theme} onChange={(event) => updatePreferences({ theme: event.target.value as Preferences['theme'] })}>
          {Object.entries(themes).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select></label>
        <label className="settings-row">Оттенок стекла <select value={tint} onChange={(event) => updatePreferences({ tint: event.target.value as Preferences['tint'] })}>
          {Object.entries(tints).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select></label>
      </div>
      <div className="settings-group">
        <label className="settings-row">Атмосфера <input type="checkbox" checked={atmosphere} onChange={(event) => {
          updatePreferences({ atmosphere: event.target.checked });
          if (!event.target.checked) resetWeather();
        }} /></label>
        {atmosphere && <div className="settings-weather">
          <p>По умолчанию фон меняется по сезону. Для местной погоды NOVA передаст Open-Meteo приблизительные координаты.</p>
          <button className="button button-secondary" type="button" disabled={weatherState === 'loading'} onClick={weatherState === 'ready' ? resetWeather : requestWeather}>
            {weatherState === 'loading' ? 'Получаем погоду…' : weatherState === 'ready' ? 'Вернуть сезонный фон' : 'Показать местную погоду'}
          </button>
          {weatherState === 'ready' && <p role="status">Погода обновлена для этой вкладки.</p>}
          {weatherState === 'error' && <p role="status">Погода недоступна. Сезонный фон включён.</p>}
        </div>}
      </div>
    </dialog>
  </>;
}

export function AppearanceButton() {
  return <button className="icon-button appearance-launch" type="button" onClick={() => window.dispatchEvent(new Event('nova:open-appearance'))} aria-label="Настройки оформления" title="Настройки оформления">
      <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/>
      </svg>
    </button>;
}
