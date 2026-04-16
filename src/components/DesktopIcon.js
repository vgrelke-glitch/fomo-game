import React, { useEffect, useRef } from 'react';

export default function DesktopIcon({
  id,
  title,
  img,
  pos,
  hideLabel,
  onMouseDown,
  onOpen,
  onMeasure,
}) {
  const iconRef = useRef(null);

  useEffect(() => {
    if (onMeasure && iconRef.current) {
      onMeasure(iconRef.current);
    }
  }, [onMeasure]);

  const style = { left: pos.x, top: pos.y };

  return (
    <div
      className={`icon${img ? '' : ' icon--label-only'}`}
      data-icon-id={id}
      ref={iconRef}
      style={style}
      onMouseDown={(e) => onMouseDown(e, id)}
      onDoubleClick={() => onOpen(id)}
    >
      {img && <img src={img} alt={title} className="icon-img" />}
      {!hideLabel && <div className="icon-label">{title}</div>}
    </div>
  );
}
