import './styles.css';
import { GameRuntime } from './ui/runtime';

const root = document.querySelector<HTMLElement>('#app');
const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');

if (!root || !canvas) {
  throw new Error('アプリの初期化に必要な要素が見つかりません');
}

new GameRuntime(root, canvas);
