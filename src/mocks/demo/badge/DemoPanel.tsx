/**
 * Painel flutuante do site demo (build `--mode demo`, Render). Fica fora da
 * árvore do <App> (raiz React própria, ver mount.tsx) e fala direto com o
 * banco local do MSW: troca de conta, logout e reset do seed. Toda ação
 * recarrega a página para o AuthContext reler `/auth/me/` do zero.
 *
 * Nunca entra no build de produção: só é importado dentro do ramo demo do
 * main.tsx (verificado por scripts/check-msw-bundle.mjs no CI).
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { DEMO_ACCOUNTS, type DemoDb } from '@/mocks/demo/db';
import { roleLabel } from '@/mocks/demo/fixtures';
import { fullName } from '@/mocks/demo/serializers';
import './DemoPanel.css';

export interface DemoPanelProps {
  db: DemoDb;
  reload?: () => void;
  confirm?: (message: string) => boolean;
}

function sessionKey(db: DemoDb) {
  const u = db.currentUser();
  return u ? `${u.id}|${fullName(u)}|${u.role}` : '';
}

export function DemoPanel({
  db,
  reload = () => window.location.reload(),
  confirm = (message) => window.confirm(message),
}: DemoPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  // Re-renderiza quando o app faz login/logout/edita perfil (via MSW). O
  // snapshot é uma string porque o perfil é editado no mesmo objeto.
  useSyncExternalStore(db.subscribe, () => sessionKey(db));
  const current = db.currentUser();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const signInAs = (email: string) => {
    const user = db.findUserByEmail(email);
    if (!user) return;
    db.setSession(user.id);
    reload();
  };

  const signOut = () => {
    db.setSession(null);
    reload();
  };

  const resetData = () => {
    if (
      !confirm(
        'Apagar tudo o que foi criado neste navegador e voltar aos dados iniciais?',
      )
    )
      return;
    db.reset();
    reload();
  };

  return (
    <aside className="demo-panel" aria-label="Painel do modo demo">
      <button
        ref={toggleRef}
        type="button"
        className="demo-panel__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="demo-panel__dot" aria-hidden="true" />
        Modo demo
        {current && (
          <span className="demo-panel__role"> · {roleLabel(current.role)}</span>
        )}
      </button>

      <div id={panelId} className="demo-panel__body" hidden={!open}>
        <p className="demo-panel__note">
          Dados fictícios, guardados só neste navegador. Nenhum e-mail é
          enviado.
        </p>
        <p className="demo-panel__status">
          {current ? (
            <>
              Conectado como <strong>{fullName(current)}</strong> (
              {roleLabel(current.role)})
            </>
          ) : (
            'Sem login'
          )}
        </p>

        <h2 className="demo-panel__heading" id={`${panelId}-accounts`}>
          Entrar como
        </h2>
        <ul
          className="demo-panel__accounts"
          aria-labelledby={`${panelId}-accounts`}
        >
          {DEMO_ACCOUNTS.map((a) => {
            const isCurrent = current?.email === a.email;
            return (
              <li key={a.email}>
                <button
                  type="button"
                  className="demo-panel__account"
                  disabled={isCurrent}
                  onClick={() => signInAs(a.email)}
                >
                  <span className="demo-panel__account-name">{a.name}</span>
                  <span className="demo-panel__account-role">
                    {roleLabel(a.role)}
                    {isCurrent && ' · atual'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="demo-panel__actions">
          {current && (
            <button
              type="button"
              className="demo-panel__action"
              onClick={signOut}
            >
              Sair
            </button>
          )}
          <button
            type="button"
            className="demo-panel__action demo-panel__action--danger"
            onClick={resetData}
          >
            Resetar dados
          </button>
        </div>
      </div>
    </aside>
  );
}
