import React from 'react';

export default function DesktopWindow({
  id,
  title,
  img,
  hideTitle = false,
  visible,
  className,
  canClose = true,
  size,
  pos,
  zIndex,
  onClose,
  onMinimize,
  onStartResize,
  onStartMove,
  onFocus,
  body,
}) {
  if (!visible) return null;

  const style = { width: size.width, height: size.height, left: pos.x, top: pos.y, zIndex };

  return (
    <div
      className={`window${className ? ` ${className}` : ''}`}
      role="dialog"
      aria-label={title}
      style={style}
      onMouseDown={() => onFocus(id)}
    >
      <div className="window-header" onMouseDown={(e) => onStartMove(e, id)}>
        <div className="window-title">
          {img && <img src={img} alt="" />}
          {!hideTitle ? <span>{title}</span> : null}
        </div>
        <button
          className="window-minimize"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onMinimize(id)}
        >
          -
        </button>
        {canClose ? (
          <button
            className="window-close"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onClose(id)}
          >
            x
          </button>
        ) : null}
      </div>
      <div className="window-body">
        {body || (
          <p>
            Это окно для <strong>{title}</strong>. Его можно изменять по размеру и перемещать.
          </p>
        )}
      </div>
      <div className="resizer handle-n" onMouseDown={(e) => onStartResize(e, id, { x: 0, y: -1 })} />
      <div className="resizer handle-s" onMouseDown={(e) => onStartResize(e, id, { x: 0, y: 1 })} />
      <div className="resizer handle-e" onMouseDown={(e) => onStartResize(e, id, { x: 1, y: 0 })} />
      <div className="resizer handle-w" onMouseDown={(e) => onStartResize(e, id, { x: -1, y: 0 })} />
      <div className="resizer handle-ne" onMouseDown={(e) => onStartResize(e, id, { x: 1, y: -1 })} />
      <div className="resizer handle-nw" onMouseDown={(e) => onStartResize(e, id, { x: -1, y: -1 })} />
      <div className="resizer handle-se" onMouseDown={(e) => onStartResize(e, id, { x: 1, y: 1 })} />
      <div className="resizer handle-sw" onMouseDown={(e) => onStartResize(e, id, { x: -1, y: 1 })} />
    </div>
  );
}
