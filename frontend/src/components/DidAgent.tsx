import React from 'react';

type DidAgentProps = {
  containerId?: string;
  style?: React.CSSProperties;
  mode?: 'full' | 'mini' | string;
  monitor?: boolean;
  agentId?: string;
  nameAttr?: string;
  height?: number | string;
  rounded?: boolean;
  shadow?: boolean;
  // Active un fallback WS backend si l'embed public échoue (CORS/401)
  enableWsFallback?: boolean;
};

const DidAgent: React.FC<DidAgentProps> = ({
  containerId = 'did-agent-root',
  style,
  mode = 'full',
  monitor = true,
  agentId = 'v2_agt_82taGvex',
  nameAttr = 'did-agent',
  height = 520,
  rounded = true,
  shadow = true,
  enableWsFallback = true,
}) => {
  const [fallbackActive, setFallbackActive] = React.useState(false);
  const wsRef = React.useRef<WebSocket | null>(null);

  // Injection de l'embed public D‑ID + détection d'erreurs
  React.useEffect(() => {
    const clientKey = import.meta.env.VITE_DID_CLIENT_KEY as string | undefined;

    const container = document.getElementById(containerId);
    if (!container) return;

    // Si déjà en fallback, ne pas injecter le script
    if (fallbackActive) return;

    if (!clientKey) {
      console.warn('[DidAgent] VITE_DID_CLIENT_KEY manquante → fallback WS backend si activé');
      if (enableWsFallback) {
        setFallbackActive(true);
      }
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://agent.d-id.com/v2/index.js';
    script.setAttribute('data-mode', mode);
    script.setAttribute('data-client-key', clientKey);
    script.setAttribute('data-agent-id', agentId || '');
    script.setAttribute('data-name', nameAttr || 'did-agent');
    script.setAttribute('data-monitor', String(monitor));
    script.setAttribute('data-target-id', containerId);

    // Supprime doublon éventuel
    const existing = Array.from(document.querySelectorAll('script[src="https://agent.d-id.com/v2/index.js"]'))
      .find((el) => el.getAttribute('data-target-id') === containerId);
    if (existing && existing.parentElement) {
      existing.parentElement.removeChild(existing);
    }

    // Gestion d'erreur de chargement du script
    const onScriptError = (e: Event) => {
      console.error('[DidAgent] Échec de chargement du script D-ID', e);
      if (enableWsFallback) setFallbackActive(true);
    };
    script.addEventListener('error', onScriptError as EventListener);

    // Heuristique: intercepter erreurs CORS/401
    const onRejection = (ev: PromiseRejectionEvent) => {
      const msg = String(ev.reason || '');
      if (/CORS|Unauthorized|401/i.test(msg)) {
        console.warn('[DidAgent] Erreur amont (CORS/401) détectée → fallback WS');
        if (enableWsFallback) setFallbackActive(true);
      }
    };
    const onError = (ev: ErrorEvent) => {
      const msg = String(ev.message || '');
      if (/CORS|Unauthorized|401/i.test(msg)) {
        console.warn('[DidAgent] Erreur script (CORS/401) → fallback WS');
        if (enableWsFallback) setFallbackActive(true);
      }
    };

    window.addEventListener('unhandledrejection', onRejection);
    window.addEventListener('error', onError);

    document.body.appendChild(script);

    return () => {
      try {
        script.removeEventListener('error', onScriptError as EventListener);
        if (script.parentElement) {
          script.parentElement.removeChild(script);
        }
      } catch {}
      window.removeEventListener('unhandledrejection', onRejection);
      window.removeEventListener('error', onError);
      const container = document.getElementById(containerId);
      if (container && !fallbackActive) container.innerHTML = '';
    };
  }, [containerId, mode, monitor, agentId, nameAttr, enableWsFallback, fallbackActive]);

  // Fallback WS backend /ws/agent/{agent_id}
  React.useEffect(() => {
    if (!fallbackActive) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    // Nettoyer et afficher un panneau de statut minimal
    container.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'flex flex-col items-center justify-center w-full h-full p-4 text-slate-200';
    panel.innerHTML = `
      <div class="text-sm mb-2 opacity-80">Mode fallback sécurisé (proxy backend)</div>
      <div class="text-lg font-semibold">Agent connecté via WebSocket</div>
      <div class="text-xs mt-2 opacity-70">ID: ${agentId}</div>
      <div id="${containerId}-status" class="text-xs mt-3 text-amber-300">Connexion...</div>
    `;
    container.appendChild(panel);

    const statusEl = document.getElementById(`${containerId}-status`);
    // Construire URL WS à partir de l'origine actuelle
    const origin = window.location.origin.replace(/\/$/, '');
    const wsUrl =
      (origin.startsWith('https://') ? origin.replace('https://', 'wss://') : origin.replace('http://', 'ws://')) +
      `/ws/agent/${agentId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (statusEl) statusEl.textContent = 'Connecté. Initialisation...';
        ws.send(JSON.stringify({ type: 'agent.start' }));
      };
      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          if (data?.type === 'agent.meta') {
            if (statusEl) statusEl.textContent = 'Agent: ' + JSON.stringify(data.data);
          } else if (data?.type === 'agent.started') {
            if (statusEl) statusEl.textContent = 'Agent prêt.';
          } else if (data?.type === 'agent.upstream') {
            if (statusEl) statusEl.textContent = 'Flux: ' + JSON.stringify(data.data).slice(0, 120) + '...';
          } else if (data?.type === 'agent.error') {
            if (statusEl) statusEl.textContent = 'Erreur: ' + (data.message || data.code);
          } else if (data?.type === 'agent.end') {
            if (statusEl) statusEl.textContent = 'Terminé.';
          }
        } catch {
          // Non JSON, ignorer
        }
      };
      ws.onerror = () => {
        if (statusEl) statusEl.textContent = 'Erreur WS.';
      };
      ws.onclose = () => {
        if (statusEl) statusEl.textContent = 'Déconnecté.';
      };
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Erreur ouverture WS.';
      console.error('[DidAgent Fallback] Erreur WS:', e);
    }

    return () => {
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
  }, [fallbackActive, agentId, containerId]);

  // Wrapper stylé pour meilleur rendu visuel
  return (
    <div
      className={[
        shadow ? 'shadow-2xl shadow-black/20' : '',
        rounded ? 'rounded-xl overflow-hidden' : '',
        'bg-black/20 border border-white/10 backdrop-blur-sm',
      ].join(' ')}
      style={{
        width: '100%',
        maxWidth: 800,
        margin: '0 auto',
        ...style,
      }}
    >
      <div
        id={containerId}
        style={{
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          background:
            'radial-gradient(1200px 200px at 50% 0%, rgba(99,102,241,0.25), transparent), radial-gradient(1200px 200px at 50% 100%, rgba(168,85,247,0.2), transparent)',
        }}
      />
      {fallbackActive && (
        <div className="absolute top-2 right-3 text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30">
          Fallback proxy
        </div>
      )}
      {!import.meta.env.VITE_DID_CLIENT_KEY && !fallbackActive && (
        <div className="p-2 text-amber-300 text-xs">
          VITE_DID_CLIENT_KEY absente. Bascule automatique possible via proxy backend.
        </div>
      )}
    </div>
  );
};

export default DidAgent;