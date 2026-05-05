import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const GRID_SIZE = 18;
const TICK_MS = 140;
const INITIAL_SNAKE = [
  { x: 8, y: 9 },
  { x: 7, y: 9 },
  { x: 6, y: 9 },
];
const INITIAL_DIRECTION = 'RIGHT';

const DIRECTION_VECTORS = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTION = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

const createRandomFood = (snake) => {
  const occupied = new Set(snake.map((segment) => `${segment.x}:${segment.y}`));
  const freeCells = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const key = `${x}:${y}`;
      if (!occupied.has(key)) {
        freeCells.push({ x, y });
      }
    }
  }

  if (freeCells.length === 0) return null;
  return freeCells[Math.floor(Math.random() * freeCells.length)];
};

export default function SnakeGame() {
  const boardRef = useRef(null);
  const directionRef = useRef(INITIAL_DIRECTION);
  const queuedDirectionRef = useRef(INITIAL_DIRECTION);
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState(() => createRandomFood(INITIAL_SNAKE));
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [status, setStatus] = useState('ready');
  const [score, setScore] = useState(0);

  const restartGame = useCallback(() => {
    directionRef.current = INITIAL_DIRECTION;
    queuedDirectionRef.current = INITIAL_DIRECTION;
    setSnake(INITIAL_SNAKE);
    setFood(createRandomFood(INITIAL_SNAKE));
    setDirection(INITIAL_DIRECTION);
    setScore(0);
    setStatus('ready');
    window.setTimeout(() => {
      boardRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    boardRef.current?.focus();
  }, []);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  const requestDirectionChange = useCallback((nextDirection) => {
    if (!nextDirection) return;

    const currentDirection = queuedDirectionRef.current || directionRef.current;
    if (snake.length > 1 && OPPOSITE_DIRECTION[currentDirection] === nextDirection) {
      return;
    }

    queuedDirectionRef.current = nextDirection;
    setDirection(nextDirection);
    if (status === 'ready') {
      setStatus('playing');
    }
  }, [snake.length, status]);

  const handleKeyDown = useCallback((event) => {
    const key = event.key;
    const nextDirection = {
      ArrowUp: 'UP',
      ArrowDown: 'DOWN',
      ArrowLeft: 'LEFT',
      ArrowRight: 'RIGHT',
      w: 'UP',
      W: 'UP',
      s: 'DOWN',
      S: 'DOWN',
      a: 'LEFT',
      A: 'LEFT',
      d: 'RIGHT',
      D: 'RIGHT',
    }[key];

    if (nextDirection) {
      event.preventDefault();
      requestDirectionChange(nextDirection);
      return;
    }

    if (key === ' ' || key === 'Enter') {
      if (status === 'gameover' || status === 'won') {
        event.preventDefault();
        restartGame();
      }
    }
  }, [requestDirectionChange, restartGame, status]);

  useEffect(() => {
    if (status !== 'playing') return undefined;

    const intervalId = window.setInterval(() => {
      setSnake((currentSnake) => {
        const moveDirection = queuedDirectionRef.current || directionRef.current;
        directionRef.current = moveDirection;
        queuedDirectionRef.current = moveDirection;

        const vector = DIRECTION_VECTORS[moveDirection];
        const currentHead = currentSnake[0];
        const nextHead = {
          x: currentHead.x + vector.x,
          y: currentHead.y + vector.y,
        };

        const isOutOfBounds = (
          nextHead.x < 0
          || nextHead.x >= GRID_SIZE
          || nextHead.y < 0
          || nextHead.y >= GRID_SIZE
        );
        if (isOutOfBounds) {
          window.clearInterval(intervalId);
          setStatus('gameover');
          return currentSnake;
        }

        const willEat = !!food && nextHead.x === food.x && nextHead.y === food.y;
        const bodyToCheck = willEat ? currentSnake : currentSnake.slice(0, -1);
        const hitsSelf = bodyToCheck.some((segment) => (
          segment.x === nextHead.x && segment.y === nextHead.y
        ));

        if (hitsSelf) {
          window.clearInterval(intervalId);
          setStatus('gameover');
          return currentSnake;
        }

        const nextSnake = [nextHead, ...currentSnake];
        if (!willEat) {
          nextSnake.pop();
          return nextSnake;
        }

        setScore((prev) => prev + 1);
        const nextFood = createRandomFood(nextSnake);
        setFood(nextFood);
        if (!nextFood) {
          window.clearInterval(intervalId);
          setStatus('won');
        }
        return nextSnake;
      });
    }, TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [food, status]);

  const cells = useMemo(() => {
    const snakeMap = new Map(snake.map((segment, index) => [`${segment.x}:${segment.y}`, index]));
    const foodKey = food ? `${food.x}:${food.y}` : '';
    const nextCells = [];

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const key = `${x}:${y}`;
        const snakeIndex = snakeMap.get(key);
        nextCells.push({
          key,
          isFood: key === foodKey,
          isSnake: typeof snakeIndex === 'number',
          isHead: snakeIndex === 0,
        });
      }
    }

    return nextCells;
  }, [food, snake]);

  const statusText = {
    ready: 'Нажми стрелку, чтобы начать.',
    playing: 'Стрелки или WASD.',
    gameover: 'Столкновение. Enter или кнопка, чтобы заново.',
    won: 'Поле заполнено. Можно перезапустить.',
  }[status];

  return (
    <div className="snake-game">
      <div className="snake-game-sidebar">
        <div className="snake-game-stat">
          <div className="snake-game-label">Счет</div>
          <div className="snake-game-value">{score}</div>
        </div>
        <div className="snake-game-stat">
          <div className="snake-game-label">Состояние</div>
          <div className={`snake-game-status is-${status}`}>{statusText}</div>
        </div>
        <button
          type="button"
          className="snake-game-restart"
          onClick={restartGame}
        >
          Новая игра
        </button>
      </div>
      <div
        className="snake-game-board"
        ref={boardRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {cells.map((cell) => (
          <div
            key={cell.key}
            className={`snake-game-cell${cell.isSnake ? ' is-snake' : ''}${cell.isHead ? ' is-head' : ''}${cell.isFood ? ' is-food' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
