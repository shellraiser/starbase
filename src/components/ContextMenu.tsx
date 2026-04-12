import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  label?: string;
  icon?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: true;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Adjust position so menu stays inside the viewport
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;
  const menuW = 180;
  const menuH = items.length * 28 + 8;
  const left = x + menuW > vpW ? x - menuW : x;
  const top  = y + menuH > vpH ? y - menuH : y;

  useEffect(() => {
    const handle = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handle);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handle);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="context-menu animate-in"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="context-menu__sep" />;
        }
        return (
          <div
            key={i}
            className={`context-menu__item${item.danger ? ' context-menu__item--danger' : ''}${item.disabled ? ' context-menu__item--disabled' : ''}`}
            onClick={() => {
              if (item.disabled) return;
              item.onClick?.();
              onClose();
            }}
          >
            {item.icon && <span className="context-menu__icon">{item.icon}</span>}
            {item.label}
          </div>
        );
      })}
    </div>,
    document.body
  );
}
