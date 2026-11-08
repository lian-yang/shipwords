import { useCallback, useEffect, useState } from 'react';
import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';

type Key = { id: string; name: string; createdAt: number };
const AGENT_SETUP_PROMPT =
  'Read https://www.freeaivideo.app/api-docs and help me set up Free AI Video API or MCP access.';

/** Keys are managed only from an authenticated browser session. */
export function AgentKeys() {
  const zh = getLocale() === 'zh';
  const [keys, setKeys] = useState<Key[]>([]);
  const [name, setName] = useState('');
  const [secret, setSecret] = useState<{ id: string; value: string } | null>(null);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [keyCopyStatus, setKeyCopyStatus] = useState<{ id: string; status: 'success' | 'error' } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/agent/keys/');
    if (!response.ok) throw new Error('load');
    const data = (await response.json()) as { keys: Key[] };
    setKeys(data.keys);
  }, []);
  useEffect(() => {
    void refresh().catch(() => setError(m.common_agent_load_error()));
  }, [refresh]);

  async function create() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/agent/keys/', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!response.ok) throw new Error('create');
      const data = (await response.json()) as { key: Key; secret: string };
      setSecret({ id: data.key.id, value: data.secret });
      setName('');
      await refresh();
    } catch {
      setError(m.common_agent_create_error());
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/agent/keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('revoke');
      setSecret((current) => (current?.id === id ? null : current));
      await refresh();
    } catch {
      setError(m.common_agent_revoke_error());
    } finally {
      setBusy(false);
    }
  }
  async function copySetupPrompt() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(AGENT_SETUP_PROMPT);
      setCopyStatus('success');
    } catch {
      setCopyStatus('error');
    }
  }
  async function copyKey() {
    if (!secret) return;
    const { id, value } = secret;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setKeyCopyStatus({ id, status: 'success' });
    } catch {
      setKeyCopyStatus({ id, status: 'error' });
    }
  }
  return (
    <div className="account-card account-agent-card">
      <div className="account-agent-heading">
        <div>
          <h3>{m.common_agent_title()}</h3>
          <p className="muted">{m.common_agent_description()}</p>
        </div>
        <a href="/api-docs" target="_blank" rel="noopener noreferrer">
          {m.common_agent_guide()}
        </a>
      </div>
      <div className="account-agent-copy">
        <button type="button" onClick={() => void copySetupPrompt()}>
          {m.common_agent_copy_prompt()}
        </button>
        <span role="status" aria-live="polite">
          {copyStatus === 'success'
            ? m.common_agent_copy_success()
            : copyStatus === 'error'
              ? m.common_agent_copy_error()
              : ''}
        </span>
        {copyStatus === 'error' && <code className="account-copy-fallback">{AGENT_SETUP_PROMPT}</code>}
      </div>
      <div className="account-key-form">
        <div className="account-key-field">
          <label htmlFor="agent-key-name">{m.common_agent_name()}</label>
          <input
            id="agent-key-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
          />
        </div>
        <button type="button" disabled={busy || !name.trim()} onClick={() => void create()}>
          {m.common_agent_create()}
        </button>
      </div>
      {secret && (
        <div className="account-key-secret">
          <p role="status">{m.common_agent_save()}</p>
          <code>{secret.value}</code>
          <div className="account-key-copy">
            <button type="button" onClick={() => void copyKey()}>
              {m.common_agent_copy_key()}
            </button>
            <span role="status" aria-live="polite">
              {keyCopyStatus?.id === secret.id
                ? keyCopyStatus.status === 'success'
                  ? m.common_agent_copy_key_success()
                  : m.common_agent_copy_key_error()
                : ''}
            </span>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="account-key-error">
          {error}
        </p>
      )}
      {keys.length > 0 && (
        <ul className="orders">
          {keys.map((key) => (
            <li key={key.id}>
              {key.name} · {new Date(key.createdAt).toLocaleDateString(zh ? 'zh-CN' : 'en-US')}{' '}
              <button
                type="button"
                className="link-button"
                disabled={busy}
                onClick={() => void revoke(key.id)}
              >
                {m.common_agent_revoke()}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
