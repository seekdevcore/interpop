/**
 * Testes de unicidade de id do título do Modal.
 *
 * Regressão: o Modal usava id="modal-title" hardcoded. Dois modais montados
 * ao mesmo tempo (ex.: Register tem "Termos" + "Privacidade") colidiam — id
 * duplicado no DOM e aria-labelledby ambíguo, quebrando leitores de tela.
 * Agora cada instância gera um id via useId().
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Modal } from '../Modal';

describe('Modal — id único de título', () => {
  it('dois modais abertos têm aria-labelledby distintos e válidos', () => {
    render(
      <>
        <Modal open onClose={() => {}} title="Termos">
          conteúdo A
        </Modal>
        <Modal open onClose={() => {}} title="Privacidade">
          conteúdo B
        </Modal>
      </>,
    );

    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(2);

    const ids = dialogs.map((d) => d.getAttribute('aria-labelledby'));
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBeTruthy();
    // Sem colisão entre instâncias
    expect(ids[0]).not.toBe(ids[1]);

    // Cada aria-labelledby aponta para o h2 correto
    expect(document.getElementById(ids[0]!)).toHaveTextContent('Termos');
    expect(document.getElementById(ids[1]!)).toHaveTextContent('Privacidade');
  });
});
