"use strict";

// 화면 요소
const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.querySelector("#statusText");
const fullnessText = document.querySelector("#fullnessText");
const fullnessBar = document.querySelector("#fullnessBar");
const fullnessTrack = document.querySelector(".fullness-track");
const livesText = document.querySelector("#livesText");
const timerText = document.querySelector("#timerText");
const overlay = document.querySelector("#overlay");
const overlayIcon = document.querySelector("#overlayIcon");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayMessage = document.querySelector("#overlayMessage");
const restartButton = document.querySelector("#restartButton");
const soundButton = document.querySelector("#soundButton");
const nameForm = document.querySelector("#nameForm");
const nicknameInput = document.querySelector("#nicknameInput");
const nameButton = document.querySelector("#nameButton");
const nameError = document.querySelector("#nameError");
const playerText = document.querySelector("#playerText");
const topRecords = document.querySelector("#topRecords");
const allRecords = document.querySelector("#allRecords");
const recordCount = document.querySelector("#recordCount");

// 게임에서 사용하는 고정값
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const BRICK_ROWS = 7;
const BRICK_COLS = 10;
const RECORD_KEY = "nyangBrickRecords";
const FOOD_TYPES = {
  feed: { label: "사료", value: 5, icon: "●", color: "#a8734f" },
  snack: { label: "간식", value: 10, icon: "🐟", color: "#76b9d3" },
  churu: { label: "츄르", value: 20, icon: "▥", color: "#f28aa4" }
};

let gameState;
let cat;
let ball;
let bricks = [];
let fallingFoods = [];
let particles = [];
let messages = [];
let pressedKeys = {};
let lastTime = 0;
let animationId = 0;
let soundOn = true;
let audioContext = null;
let currentPlayer = "";
let records = loadRecords();

// 확률에 맞춰 벽돌 속 먹이를 정한다.
function chooseFood() {
  const chance = Math.random();
  if (chance < 0.5) return "feed";
  if (chance < 0.8) return "snack";
  return "churu";
}

function createBricks() {
  bricks = [];
  const gap = 7;
  const side = 24;
  const top = 50;
  const brickWidth = (WIDTH - side * 2 - gap * (BRICK_COLS - 1)) / BRICK_COLS;
  const brickHeight = 32;
  const colors = ["#f6a8c1", "#ffbd91", "#f7df83", "#91d8b9", "#8bd0e8", "#b9a7e8", "#e6a6d4"];

  for (let row = 0; row < BRICK_ROWS; row += 1) {
    for (let col = 0; col < BRICK_COLS; col += 1) {
      bricks.push({
        x: side + col * (brickWidth + gap),
        y: top + row * (brickHeight + gap),
        width: brickWidth,
        height: brickHeight,
        color: colors[row],
        food: chooseFood(),
        alive: true
      });
    }
  }
}

function resetGame(askForName = false) {
  cancelAnimationFrame(animationId);
  gameState = { mode: "ready", fullness: 0, lives: 3, remainingBricks: BRICK_ROWS * BRICK_COLS, startTime: null, elapsed: 0 };
  cat = { x: WIDTH / 2 - 50, y: HEIGHT - 66, width: 100, height: 50, speed: 460, direction: 1, bounce: 0, running: false, affectionTime: 0 };
  ball = { x: WIDTH / 2, y: cat.y - 13, radius: 9, vx: 255, vy: -330 };
  fallingFoods = [];
  particles = [];
  messages = [];
  pressedKeys = {};
  createBricks();
  timerText.textContent = "0.0초";
  updateHud("스페이스키를 눌러 시작하세요!");
  if (askForName || !currentPlayer) showNameEntry();
  else {
    nameForm.classList.add("hidden");
    showOverlay("🐱", `${currentPlayer}님, 준비됐나요?`, "방향키 또는 A·D로 움직이고<br><kbd>Space</kbd>를 눌러 출발해요!", false);
  }
  lastTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

function updateHud(message) {
  if (message) statusText.textContent = message;
  fullnessText.textContent = `${gameState.fullness} / 100`;
  fullnessBar.style.width = `${gameState.fullness}%`;
  fullnessTrack.setAttribute("aria-valuenow", String(gameState.fullness));
  livesText.textContent = Array(gameState.lives).fill("●").join(" ") || "없음";
}

function showOverlay(icon, title, message, showRestart) {
  overlayIcon.textContent = icon;
  overlayTitle.textContent = title;
  overlayMessage.innerHTML = message;
  restartButton.classList.toggle("hidden", !showRestart);
  overlay.classList.remove("hidden");
}

function showNameEntry() {
  gameState.mode = "naming";
  nameForm.classList.remove("hidden");
  restartButton.classList.add("hidden");
  overlayIcon.textContent = "🐱";
  overlayTitle.textContent = "게임 닉네임을 정해 주세요";
  overlayMessage.textContent = "실제 이름 대신 재미있는 별명을 사용해 주세요!";
  overlay.classList.remove("hidden");
  nicknameInput.value = "";
  nameError.textContent = "";
  requestAnimationFrame(() => nicknameInput.focus());
}

function confirmNickname() {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    nameError.textContent = "닉네임을 1글자 이상 입력해 주세요.";
    nicknameInput.focus();
    return;
  }
  currentPlayer = nickname.slice(0, 10);
  playerText.textContent = currentPlayer;
  nameError.textContent = "";
  resetGame(false);
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function startBall() {
  if (gameState.mode !== "ready" && gameState.mode !== "waiting") return;
  gameState.mode = "playing";
  if (gameState.startTime === null) gameState.startTime = performance.now();
  const direction = Math.random() < 0.5 ? -1 : 1;
  ball.vx = direction * (235 + Math.random() * 45);
  ball.vy = -335;
  hideOverlay();
  updateHud("간식을 향해 출발! 냥!");
  playTone(440, 0.08, "sine");
}

function waitForNextBall() {
  gameState.mode = "waiting";
  ball.x = cat.x + cat.width / 2;
  ball.y = cat.y - ball.radius - 2;
  ball.vx = 0;
  ball.vy = 0;
  updateHud("공을 놓쳤어요. 스페이스키로 다시 출발!");
  showOverlay("😿", "괜찮아요!", "고양이 위에 새 공이 준비됐어요.<br><kbd>Space</kbd>를 눌러 다시 출발해요!", false);
}

function finishGame(won) {
  gameState.mode = won ? "won" : "lost";
  if (won) {
    gameState.fullness = 100;
    updateHud("배불러요! 게임 성공!");
    cat.affectionTime = 0;
    saveRecord();
    showOverlay("😻", "배불러요! 게임 성공!", "고양이가 기뻐서 애교를 부려요!<br>골골골~ 정말 고마워요 ♥", true);
    playMelody([523, 659, 784, 1047]);
  } else {
    updateHud("간식을 더 먹고 싶어요!");
    showOverlay("🙀", "아쉬워요! 게임 오버", `포만도 ${gameState.fullness}까지 채웠어요.<br>한 번 더 도전해 볼까요?`, true);
    playMelody([330, 294, 262]);
  }
}

function update(delta) {
  if (gameState.mode === "won") cat.affectionTime += delta;
  if (gameState.startTime !== null && gameState.mode !== "won" && gameState.mode !== "lost") {
    gameState.elapsed = (performance.now() - gameState.startTime) / 1000;
    timerText.textContent = `${gameState.elapsed.toFixed(1)}초`;
  }
  const movingLeft = pressedKeys.ArrowLeft || pressedKeys.KeyA;
  const movingRight = pressedKeys.ArrowRight || pressedKeys.KeyD;
  cat.running = Boolean(movingLeft || movingRight);

  if (movingLeft && !movingRight) {
    cat.x -= cat.speed * delta;
    cat.direction = -1;
  } else if (movingRight && !movingLeft) {
    cat.x += cat.speed * delta;
    cat.direction = 1;
  }
  cat.x = Math.max(0, Math.min(WIDTH - cat.width, cat.x));
  cat.bounce = Math.max(0, cat.bounce - delta * 5);

  if (gameState.mode === "ready" || gameState.mode === "waiting") {
    ball.x = cat.x + cat.width / 2;
    ball.y = cat.y - ball.radius - 2;
  }

  if (gameState.mode === "playing") {
    moveBall(delta);
    updateFoods(delta);
  }
  updateEffects(delta);
}

function moveBall(delta) {
  ball.x += ball.vx * delta;
  ball.y += ball.vy * delta;

  if (ball.x - ball.radius <= 0 && ball.vx < 0) {
    ball.x = ball.radius;
    ball.vx *= -1;
    playTone(300, 0.035);
  } else if (ball.x + ball.radius >= WIDTH && ball.vx > 0) {
    ball.x = WIDTH - ball.radius;
    ball.vx *= -1;
    playTone(300, 0.035);
  }
  if (ball.y - ball.radius <= 0 && ball.vy < 0) {
    ball.y = ball.radius;
    ball.vy *= -1;
    playTone(330, 0.035);
  }

  const catTop = cat.y + Math.sin(cat.bounce * Math.PI) * -5;
  if (ball.vy > 0 && circleHitsRect(ball, { x: cat.x, y: catTop, width: cat.width, height: cat.height })) {
    ball.y = catTop - ball.radius;
    const hitPosition = (ball.x - (cat.x + cat.width / 2)) / (cat.width / 2);
    const speed = Math.min(485, Math.hypot(ball.vx, ball.vy) + 5);
    const angle = hitPosition * (Math.PI / 3);
    ball.vx = speed * Math.sin(angle);
    ball.vy = -Math.abs(speed * Math.cos(angle));
    cat.bounce = 1;
    playTone(520, 0.055, "triangle");
  }

  for (const brick of bricks) {
    if (!brick.alive || !circleHitsRect(ball, brick)) continue;
    brick.alive = false;
    gameState.remainingBricks -= 1;
    fallingFoods.push({ x: brick.x + brick.width / 2, y: brick.y + brick.height / 2, type: brick.food, vy: 105, rotation: 0 });
    makeParticles(brick.x + brick.width / 2, brick.y + brick.height / 2, brick.color, 7);

    const overlapLeft = ball.x + ball.radius - brick.x;
    const overlapRight = brick.x + brick.width - (ball.x - ball.radius);
    const overlapTop = ball.y + ball.radius - brick.y;
    const overlapBottom = brick.y + brick.height - (ball.y - ball.radius);
    const smallest = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
    if (smallest === overlapLeft || smallest === overlapRight) ball.vx *= -1;
    else ball.vy *= -1;
    playTone(620, 0.045, "square");
    break;
  }

  if (ball.y - ball.radius > HEIGHT) {
    gameState.lives -= 1;
    playTone(160, 0.18, "sawtooth");
    if (gameState.lives <= 0) finishGame(false);
    else waitForNextBall();
  }
}

function updateFoods(delta) {
  for (let index = fallingFoods.length - 1; index >= 0; index -= 1) {
    const food = fallingFoods[index];
    food.y += food.vy * delta;
    food.rotation += delta * 3;
    const foodBox = { x: food.x - 14, y: food.y - 14, width: 28, height: 28 };

    if (rectsOverlap(foodBox, cat)) {
      const data = FOOD_TYPES[food.type];
      gameState.fullness = Math.min(100, gameState.fullness + data.value);
      messages.push({ x: food.x, y: cat.y - 10, text: `냠냠! +${data.value}`, life: 1, color: data.color });
      makeParticles(food.x, cat.y, "#ff789d", 8, true);
      fallingFoods.splice(index, 1);
      updateHud(`${data.label}을 먹었어요! 포만도 +${data.value}`);
      playTone(880, 0.09, "sine");
      if (gameState.fullness >= 100) {
        finishGame(true);
        return;
      }
    } else if (food.y - 16 > HEIGHT) {
      fallingFoods.splice(index, 1);
    }
  }

  if (gameState.remainingBricks === 0 && fallingFoods.length === 0 && gameState.fullness < 100) finishGame(false);
}

function updateEffects(delta) {
  particles.forEach((particle) => {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 150 * delta;
    particle.life -= delta;
  });
  particles = particles.filter((particle) => particle.life > 0);
  messages.forEach((message) => {
    message.y -= 38 * delta;
    message.life -= delta;
  });
  messages = messages.filter((message) => message.life > 0);
}

function circleHitsRect(circle, rect) {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const distanceX = circle.x - nearestX;
  const distanceY = circle.y - nearestY;
  return distanceX * distanceX + distanceY * distanceY <= circle.radius * circle.radius;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function makeParticles(x, y, color, count, hearts = false) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x, y, color, hearts,
      vx: (Math.random() - 0.5) * 190,
      vy: -50 - Math.random() * 130,
      life: 0.55 + Math.random() * 0.45,
      size: 3 + Math.random() * 4
    });
  }
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();
  drawBricks();
  drawFoods();
  drawCat();
  if (gameState.mode === "won") drawAffection();
  drawBall();
  drawEffects();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#dff3fb");
  gradient.addColorStop(0.5, "#fff3d8");
  gradient.addColorStop(1, "#f8dfed");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "rgba(255,255,255,.55)";
  [[90,35,42],[750,42,54],[420,20,28]].forEach(([x,y,r]) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = "#bce3bf";
  ctx.fillRect(0, HEIGHT - 24, WIDTH, 24);
  ctx.fillStyle = "rgba(104,166,111,.25)";
  for (let x = 8; x < WIDTH; x += 28) ctx.fillRect(x, HEIGHT - 29, 3, 8);
}

function roundedRect(x, y, width, height, radius, color) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawBricks() {
  const symbols = ["●", "♢", "✦"];
  bricks.forEach((brick, index) => {
    if (!brick.alive) return;
    ctx.save();
    ctx.shadowColor = "rgba(76,65,85,.2)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 3;
    roundedRect(brick.x, brick.y, brick.width, brick.height, 9, brick.color);
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(symbols[index % symbols.length], brick.x + brick.width / 2, brick.y + brick.height / 2 + 1);
  });
}

function drawBall() {
  ctx.save();
  ctx.shadowColor = "rgba(90,70,90,.35)";
  ctx.shadowBlur = 8;
  const gradient = ctx.createRadialGradient(ball.x - 3, ball.y - 4, 1, ball.x, ball.y, ball.radius);
  gradient.addColorStop(0, "#fff");
  gradient.addColorStop(0.35, "#dff5a8");
  gradient.addColorStop(1, "#65ad66");
  ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCat() {
  const isAffectionate = gameState.mode === "won";
  const runTime = performance.now() / 1000;
  const cuddle = isAffectionate ? Math.sin(cat.affectionTime * 4.5) : 0;
  const depth = isAffectionate ? (Math.sin(cat.affectionTime * 2.2) + 1) / 2 : 0;
  const bob = cat.running ? Math.abs(Math.sin(runTime * 11)) * -3 : (isAffectionate ? Math.abs(Math.sin(cat.affectionTime * 4.5)) * -12 : 0);
  const bounce = Math.sin(cat.bounce * Math.PI) * -8;
  const x = cat.x;
  const y = cat.y + bob + bounce;

  // 바닥 그림자의 크기로 고양이가 앞뒤로 움직이는 깊이감을 만든다.
  ctx.save();
  ctx.globalAlpha = isAffectionate ? 0.12 + depth * 0.13 : 0.16;
  ctx.fillStyle = "#244c32";
  ctx.beginPath();
  ctx.ellipse(x + cat.width / 2, cat.y + 53, 42 + depth * 13, 7 - depth * 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  if (isAffectionate) {
    ctx.translate(x + cat.width / 2, y + cat.height / 2);
    ctx.rotate(cuddle * 0.16);
    // 가로 폭과 전체 크기를 다르게 바꾸어 몸을 돌리며 다가오는 것처럼 보이게 한다.
    ctx.scale((0.72 + Math.abs(cuddle) * 0.28) * (0.92 + depth * 0.25), 0.92 + depth * 0.25);
    ctx.translate(-(x + cat.width / 2), -(y + cat.height / 2));
  }
  if (cat.direction < 0) {
    ctx.translate(x + cat.width, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }
  ctx.strokeStyle = "#9d765e";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  const tailWave = isAffectionate ? Math.sin(cat.affectionTime * 7) * 13 : 0;
  ctx.beginPath(); ctx.moveTo(x + 15, y + 32); ctx.quadraticCurveTo(x - 12, y + 17 - tailWave, x + 5, y + 4); ctx.stroke();

  // 네 발을 몸보다 먼저 그려 자연스럽게 몸 아래로 이어지게 한다.
  const runPhase = cat.running ? runTime * 11 : 0;
  const legAnchors = [31, 46, 61, 75];
  legAnchors.forEach((anchor, index) => {
    const pairPhase = runPhase + (index % 2 === 0 ? 0 : Math.PI);
    const swing = cat.running ? Math.sin(pairPhase) * 9 : 0;
    const lift = cat.running ? Math.max(0, Math.cos(pairPhase)) * 7 : 0;
    const wavingPaw = isAffectionate && index >= 2;
    const pawX = wavingPaw ? anchor + Math.sin(cat.affectionTime * 7 + index) * 5 : anchor + swing;
    const pawY = wavingPaw ? y + 22 + Math.cos(cat.affectionTime * 7 + index) * 7 : y + 50 - lift;
    ctx.strokeStyle = index < 2 ? "#b97954" : "#d59263";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(x + anchor, y + 36);
    ctx.quadraticCurveTo(x + anchor + swing * 0.45, y + 43 - lift, x + pawX, pawY);
    ctx.stroke();
    ctx.fillStyle = index < 2 ? "#9f684c" : "#c67f58";
    ctx.beginPath();
    ctx.ellipse(x + pawX + 2, pawY + 1, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  const bodyGradient = ctx.createLinearGradient(x + 18, y + 10, x + 83, y + 47);
  bodyGradient.addColorStop(0, "#f2bb88");
  bodyGradient.addColorStop(0.52, "#e6a676");
  bodyGradient.addColorStop(1, "#bd7957");
  ctx.beginPath();
  ctx.roundRect(x + 18, y + 13, 65, 34, 18);
  ctx.fillStyle = bodyGradient;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.22)";
  ctx.beginPath(); ctx.ellipse(x + 50, y + 21, 23, 6, -0.08, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e6a676";
  ctx.beginPath(); ctx.arc(x + 76, y + 19, 25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 58, y + 2); ctx.lineTo(x + 64, y - 13); ctx.lineTo(x + 73, y + 1); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + 82, y + 1); ctx.lineTo(x + 91, y - 12); ctx.lineTo(x + 96, y + 6); ctx.fill();
  ctx.fillStyle = "#634f4c";
  ctx.beginPath();
  if (isAffectionate) {
    ctx.arc(x + 70, y + 18, 4, Math.PI, 0);
    ctx.arc(x + 86, y + 18, 4, Math.PI, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#634f4c";
    ctx.stroke();
  } else {
    ctx.arc(x + 70, y + 17, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 86, y + 17, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#f27e91";
  ctx.beginPath(); ctx.moveTo(x + 78, y + 21); ctx.lineTo(x + 73, y + 25); ctx.lineTo(x + 82, y + 25); ctx.fill();
  ctx.strokeStyle = "#7b5c50";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 62, y + 24); ctx.lineTo(x + 49, y + 21); ctx.moveTo(x + 62, y + 28); ctx.lineTo(x + 48, y + 30); ctx.stroke();

  // 애교를 부릴 때 볼이 발그레해지고 얼굴이 살짝 좌우로 움직인다.
  if (isAffectionate) {
    ctx.globalAlpha = 0.58 + Math.sin(cat.affectionTime * 5) * 0.18;
    ctx.fillStyle = "#f58da1";
    ctx.beginPath(); ctx.ellipse(x + 64, y + 25, 5, 3, 0, 0, Math.PI * 2); ctx.ellipse(x + 91, y + 25, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// 승리하면 고양이 주변에 하트와 애교 말풍선을 반복해서 보여 준다.
function drawAffection() {
  const time = cat.affectionTime;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 22px '맑은 고딕', sans-serif";
  [0, 1, 2, 3, 4].forEach((index) => {
    const phase = (time * 0.72 + index / 5) % 1;
    const side = index % 2 === 0 ? -1 : 1;
    const x = cat.x + cat.width / 2 + side * (32 + index * 6) + Math.sin(time * 3 + index) * 7;
    const y = cat.y - 5 - phase * 92;
    ctx.globalAlpha = 1 - phase;
    ctx.fillStyle = index === 1 ? "#4eaa6c" : "#7bcf84";
    ctx.fillText("♥", x, y);
  });
  ctx.globalAlpha = 0.92;
  roundedRect(cat.x + 8, cat.y - 55, 118, 32, 15, "#f7fff2");
  ctx.fillStyle = "#347a4e";
  ctx.font = "bold 15px '맑은 고딕', sans-serif";
  ctx.fillText(Math.sin(time * 3) > 0 ? "골골골~ ♥" : "냐아앙~ ♥", cat.x + 67, cat.y - 34);
  ctx.restore();
}

function drawFoods() {
  fallingFoods.forEach((food) => {
    const data = FOOD_TYPES[food.type];
    ctx.save();
    ctx.translate(food.x, food.y);
    ctx.rotate(Math.sin(food.rotation) * 0.25);
    ctx.shadowColor = "rgba(80,65,75,.25)";
    ctx.shadowBlur = 5;
    if (food.type === "churu") {
      roundedRect(-8, -15, 16, 30, 4, data.color);
      ctx.fillStyle = "#fff"; ctx.fillRect(-5, -6, 10, 4);
    } else {
      ctx.font = food.type === "snack" ? "26px sans-serif" : "bold 27px sans-serif";
      ctx.fillStyle = data.color;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(data.icon, 0, 0);
    }
    ctx.restore();
  });
}

function drawEffects() {
  particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, particle.life * 2);
    ctx.fillStyle = particle.color;
    ctx.font = `${particle.size * 3}px sans-serif`;
    ctx.textAlign = "center";
    if (particle.hearts) ctx.fillText("♥", particle.x, particle.y);
    else { ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
  messages.forEach((message) => {
    ctx.save();
    ctx.globalAlpha = message.life;
    ctx.font = "bold 19px '맑은 고딕', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = message.color;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 4;
    ctx.strokeText(message.text, message.x, message.y);
    ctx.fillText(message.text, message.x, message.y);
    ctx.restore();
  });
}

function gameLoop(time) {
  const delta = Math.min((time - lastTime) / 1000, 0.025);
  lastTime = time;
  update(delta);
  draw();
  animationId = requestAnimationFrame(gameLoop);
}

function playTone(frequency, duration, wave = "sine") {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.055, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.info("이 브라우저에서는 효과음을 재생할 수 없습니다.");
  }
}

function playMelody(notes) {
  notes.forEach((note, index) => setTimeout(() => playTone(note, 0.16, "triangle"), index * 130));
}

// 이 브라우저에 저장된 기록을 안전하게 불러온다.
function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(RECORD_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((record) => record && typeof record.time === "number") : [];
  } catch (error) {
    return [];
  }
}

function saveRecord() {
  const finishedTime = Number(gameState.elapsed.toFixed(1));
  const now = new Date();
  records.push({
    nickname: currentPlayer,
    time: finishedTime,
    recordedAt: now.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
  });
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify(records));
  } catch (error) {
    statusText.textContent = "기록을 저장할 수 없는 브라우저 환경입니다.";
  }
  timerText.textContent = `${finishedTime.toFixed(1)}초`;
  renderRecords();
}

function createRecordItem(record, rank, showDate) {
  const item = document.createElement("li");
  const name = document.createElement("strong");
  name.textContent = `${rank}. ${record.nickname}`;
  const result = document.createTextNode(` — ${record.time.toFixed(1)}초`);
  item.append(name, result);
  if (showDate) {
    const date = document.createElement("small");
    date.textContent = record.recordedAt;
    item.append(date);
  }
  return item;
}

function fillRecordList(list, items, showDate) {
  list.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-record";
    empty.textContent = "아직 기록이 없어요";
    list.append(empty);
    return;
  }
  items.forEach((record, index) => list.append(createRecordItem(record, index + 1, showDate)));
}

function renderRecords() {
  const fastest = [...records].sort((a, b) => a.time - b.time).slice(0, 10);
  const newest = [...records].reverse();
  fillRecordList(topRecords, fastest, false);
  fillRecordList(allRecords, newest, true);
  recordCount.textContent = `${records.length}개`;
}

function restartAndStart() {
  resetGame(false);
  startBall();
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(event.code)) event.preventDefault();
  pressedKeys[event.code] = true;
  if (event.code === "Space") {
    if (gameState.mode === "won" || gameState.mode === "lost") restartAndStart();
    else if (gameState.mode === "naming") nicknameInput.focus();
    else startBall();
  }
});

window.addEventListener("keyup", (event) => { pressedKeys[event.code] = false; });
window.addEventListener("blur", () => { pressedKeys = {}; });
restartButton.addEventListener("click", restartAndStart);
nameButton.addEventListener("click", confirmNickname);
nicknameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") confirmNickname();
});
soundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  soundButton.textContent = soundOn ? "🔊 소리 켬" : "🔇 소리 끔";
  soundButton.setAttribute("aria-pressed", String(!soundOn));
  if (soundOn) playTone(660, 0.08);
});

renderRecords();
resetGame(true);
