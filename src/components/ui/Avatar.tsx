/**
 * Avatar — renderiza imagem do usuário OU a inicial como fallback.
 *
 * Usar em qualquer lugar que exiba autor (navbar, comentários, autor de
 * artigo). Centraliza a lógica de fallback (alt vazio, lazy loading, overflow)
 * e mantém o estilo consistente.
 *
 * Tamanho/cor vêm da `className` do container (ex.: `comment-item__avatar`,
 * `navbar-menu__avatar`) — o componente herda o visual já existente.
 */
import './Avatar.css';

interface AvatarProps {
  src: string | null | undefined;
  initial: string;
  className: string;
}

export function Avatar({ src, initial, className }: AvatarProps) {
  return (
    <div className={`${className} avatar`} aria-hidden="true">
      {src ? <img src={src} alt="" loading="lazy" /> : <span>{initial}</span>}
    </div>
  );
}
