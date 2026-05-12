import React, { useEffect, useMemo, useRef, useState } from 'react';

const formatTime = (value) => {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getAudioPositionStorageKey = (src) => `fomo_audio_progress:${src || ''}`;

export default function ChatAudioMessage({ src, onEnded }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleLoadedMetadata = () => {
      const nextDuration = audio.duration || 0;
      setDuration(nextDuration);
      if (typeof window === 'undefined' || !src || !Number.isFinite(nextDuration) || nextDuration <= 0) return;
      const rawSavedTime = window.localStorage.getItem(getAudioPositionStorageKey(src));
      const savedTime = Number(rawSavedTime || 0);
      if (!Number.isFinite(savedTime) || savedTime <= 0) return;
      const clampedTime = Math.min(savedTime, Math.max(0, nextDuration - 0.25));
      audio.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    };
    const handleTimeUpdate = () => {
      const nextTime = audio.currentTime || 0;
      setCurrentTime(nextTime);
      if (typeof window !== 'undefined' && src) {
        window.localStorage.setItem(getAudioPositionStorageKey(src), String(nextTime));
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (typeof window !== 'undefined' && src) {
        window.localStorage.removeItem(getAudioPositionStorageKey(src));
      }
      if (typeof onEnded === 'function') onEnded();
    };
    const handlePause = () => {
      setIsPlaying(false);
      if (typeof window !== 'undefined' && src) {
        window.localStorage.setItem(getAudioPositionStorageKey(src), String(audio.currentTime || 0));
      }
    };
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, [onEnded, src]);

  const timeLabel = useMemo(
    () => `${formatTime(currentTime)} / ${formatTime(duration)}`,
    [currentTime, duration],
  );

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
      return;
    }
    audio.pause();
  };

  const handleSeek = (event) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(event.target.value || 0);
    if (!Number.isFinite(nextTime)) return;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
    if (typeof window !== 'undefined' && src) {
      window.localStorage.setItem(getAudioPositionStorageKey(src), String(nextTime));
    }
  };

  return (
    <div className="thread-audio-card">
      <audio ref={audioRef} preload="metadata" src={src} />
      <button type="button" className="thread-audio-toggle" onClick={togglePlayback}>
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <input
        type="range"
        className="thread-audio-seek"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(currentTime, duration || 0)}
        onChange={handleSeek}
        aria-label="Перемотка голосового сообщения"
      />
      <div className="thread-audio-time">{timeLabel}</div>
    </div>
  );
}
