'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import type { FormEvent } from 'react';
import { API_BASE_URL, apiPath } from '@/lib/api';
import type { NovaPublicUser, NovaUser } from '@/lib/types';

type MediaSlot = 'avatar' | 'cover';
type FetchProfile = <T>(path: string, options?: RequestInit) => Promise<T>;
const allowedMediaTypes = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm';
const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function ProfileMedia({ url, type, label }: { url: string; type?: string | null; label: string }) {
  const reduceMotion = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(reducedMotionQuery).matches, () => true);
  const src = new URL(url, API_BASE_URL);
  if (src.origin !== new URL(API_BASE_URL).origin || !src.pathname.startsWith('/api/v1/users/media/')) return null;
  if (type?.startsWith('video/')) return <video src={src.href} aria-label={label} muted loop playsInline autoPlay={!reduceMotion} preload={reduceMotion ? 'metadata' : 'auto'} />;
  if (reduceMotion && type === 'image/gif') return <span aria-label={label}>GIF</span>;
  // Media is served by NOVA API; a direct URL preserves animated GIF/WebP.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src.href} alt={label} referrerPolicy="no-referrer" />;
}

export function UserAvatar({ user, compact = false }: { user: NovaPublicUser; compact?: boolean }) {
  return <span className={`avatar${compact ? ' avatar-small' : ''}`} aria-hidden="true">
    {user.avatarUrl ? <ProfileMedia url={user.avatarUrl} type={user.avatarContentType} label="" />
      : (user.displayName || user.username || '?').slice(0, 1).toUpperCase()}
  </span>;
}

export function ProfileEditor({ user, request, onUpdate }: {
  user: NovaUser;
  request: FetchProfile;
  onUpdate: (profile: NovaUser) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [username, setUsername] = useState(user.username);
  const [name, setName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failed, setFailed] = useState(false);

  function openProfile() {
    setUsername(user.username);
    setName(user.displayName);
    setBio(user.bio ?? '');
    setNotice('');
    dialogRef.current?.showModal();
  }

  async function update(requestUpdate: () => Promise<NovaUser>, success: string) {
    setBusy(true);
    setNotice('');
    try {
      const updated = await requestUpdate();
      onUpdate(updated);
      setFailed(false);
      setNotice(success);
    } catch (error) {
      setFailed(true);
      setNotice(error instanceof Error ? error.message : 'Не удалось сохранить изменения.');
    } finally { setBusy(false); }
  }

  function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return update(() => request<NovaUser>(apiPath('/users/me'), {
      method: 'PATCH',
      body: JSON.stringify({ username: username.trim(), displayName: name.trim(), bio: bio.trim() }),
    }), 'Профиль сохранён.');
  }

  function updateMedia(slot: MediaSlot, file?: File) {
    if (file && (!allowedMediaTypes.split(',').includes(file.type) || file.size > 8 * 1024 * 1024 || !file.size)) {
      setFailed(true);
      setNotice('Выберите фото, GIF или видео в поддерживаемом формате размером до 8 МБ.');
      return;
    }
    const path = apiPath(`/users/me/media/${slot}`);
    if (file) {
      const body = new FormData();
      body.append('file', file);
      void update(() => request<NovaUser>(path, { method: 'POST', body }), 'Файл сохранён.');
    } else {
      void update(() => request<NovaUser>(path, { method: 'DELETE' }), 'Файл удалён.');
    }
  }

  return <>
    <button className="account-chip" type="button" aria-label="Редактировать профиль" title="Редактировать профиль" onClick={openProfile}>
      <UserAvatar user={user} compact /><span>{user.displayName || user.username}</span>
    </button>
    <dialog className="glass-dialog" ref={dialogRef} aria-labelledby="edit-profile-title">
      <div className="modal-head"><h2 id="edit-profile-title">Мой профиль</h2><form method="dialog"><button className="icon-button modal-close" aria-label="Закрыть профиль">×</button></form></div>
      <div className="profile-preview">
        {user.coverUrl && <div className="profile-cover"><ProfileMedia url={user.coverUrl} type={user.coverContentType} label="Обложка профиля" /></div>}
        <UserAvatar user={user} />
      </div>
      {notice && <p className={`notice${failed ? '' : ' notice-success'}`} role={failed ? 'alert' : 'status'}>{notice}</p>}
      <form className="form-stack" onSubmit={updateProfile}>
        <label htmlFor="edit-name">Имя</label>
        <input id="edit-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
        <label htmlFor="edit-handle">Имя пользователя</label>
        <input id="edit-handle" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" value={username} onChange={(event) => setUsername(event.target.value)} />
        <label htmlFor="edit-bio">О себе</label>
        <textarea id="edit-bio" maxLength={240} value={bio} onChange={(event) => setBio(event.target.value)} />
        <button className="button button-primary" type="submit" disabled={busy || !name.trim()}>Сохранить профиль</button>
      </form>
      <p className="field-hint">Аватар и обложка доступны по ссылке. Поддерживаются PNG, JPEG, GIF, WebP, MP4 и WebM до 8 МБ.</p>
      <div className="settings-group profile-media-settings">
        {([{ id: 'avatar', label: 'Аватар', url: user.avatarUrl }, { id: 'cover', label: 'Обложка', url: user.coverUrl }] as const).map(({ id, label, url }) =>
          <div className="profile-media-row" key={id}>
            <label htmlFor={`profile-${id}`}>{label}</label>
            <input id={`profile-${id}`} disabled={busy} type="file" accept={allowedMediaTypes} onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) updateMedia(id, file);
            }} />
            {url && <button className="button button-quiet" type="button" disabled={busy} onClick={() => updateMedia(id)}>Удалить {id === 'avatar' ? 'аватар' : 'обложку'}</button>}
          </div>)}
      </div>
    </dialog>
  </>;
}
