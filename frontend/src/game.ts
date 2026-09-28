import { updateCamera, Camera } from "./camera.js";
import { circleIntersectsCircle, circleIntersectsRect, resolveCircleRectCollision } from "./collision.js";
import { InputState } from "./input.js";
import {
  applyProjectileBounce,
  BOUNCE_BONUS,
  consumeProjectileTravel,
  createBlueProjectile,
  MAX_BOUNCES,
  PROJECTILE_SPEED,
} from "./logic.js";
import { GameConfig, GreenThreat, LevelData, PlayerState, RuntimeEnemy, Vector2, BlueProjectile } from "./types.js";

const GRAVITY = 1200;
const PLAYER_RADIUS = 18;
const GREEN_SPEED = 260;
const FIRE_COOLDOWN_MS = 600;

export type GameStatus = "playing" | "won" | "gameover";

export class Game {
  readonly config: GameConfig;
  readonly level: LevelData;
  readonly viewport: { width: number; height: number };
  readonly input: InputState;
  readonly player: PlayerState;
  readonly camera: Camera = { x: 0, y: 0 };

  lives: number;
  status: GameStatus = "playing";
  capturedCount = 0;
  enemies: RuntimeEnemy[] = [];
  blueProjectile: BlueProjectile | null = null;
  greenThreat: GreenThreat | null = null;
  elapsedMs = 0;
  lastFireAtMs = Number.NEGATIVE_INFINITY;

  constructor(config: GameConfig, level: LevelData, viewport: { width: number; height: number }, input: InputState) {
    this.config = config;
    this.level = level;
    this.viewport = viewport;
    this.input = input;
    this.lives = config.lives;
    this.player = { position: { ...level.spawn }, velocity: { x: 0, y: 0 }, radius: PLAYER_RADIUS };
    this.resetGameplayState();
  }

  get currentTargetId(): string | undefined {
    return this.level.requiredSequence[this.capturedCount];
  }

  get canFire(): boolean {
    return this.status === "playing" && this.blueProjectile === null && this.elapsedMs - this.lastFireAtMs >= FIRE_COOLDOWN_MS;
  }

  get isSequenceComplete(): boolean {
    return this.capturedCount >= this.level.requiredSequence.length;
  }

  resetLevel(): void {
    this.lives = this.config.lives;
    this.status = "playing";
    this.resetGameplayState();
  }

  private resetGameplayState(): void {
    this.player.position = { ...this.level.spawn };
    this.player.velocity = { x: 0, y: 0 };
    this.capturedCount = 0;
    this.enemies = this.level.enemies.map((enemy) => ({ ...enemy, behavior: { ...enemy.behavior }, direction: 1 }));
    this.blueProjectile = null;
    this.greenThreat = null;
    this.camera.x = 0;
    this.camera.y = 0;
    this.input.fireRequested = false;
  }

  private loseLife(reason: "fall" | "threat"): void {
    this.lives -= 1;
    this.resetGameplayState();
    if (this.lives <= 0) {
      this.lives = 0;
      this.status = "gameover";
    }
    void reason;
  }

  update(deltaSeconds: number): void {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.05);
    this.elapsedMs += dt * 1000;
    if (this.status !== "playing") {
      this.input.fireRequested = false;
      return;
    }

    if (this.input.fireRequested) {
      this.tryFire();
      this.input.fireRequested = false;
    }
    this.updateEnemies(dt);
    this.updatePlayer(dt);
    this.updateBlueProjectile(dt);
    this.updateGreenThreat(dt);

    if (this.player.position.y - this.player.radius > this.level.height) {
      this.loseLife("fall");
    } else if (this.isSequenceComplete && circleIntersectsRect(this.player, this.level.exit)) {
      this.status = "won";
    }

    const nextCamera = updateCamera(
      this.camera,
      this.player.position,
      this.level.width,
      this.level.height,
      this.viewport.width,
      this.viewport.height,
      dt,
    );
    this.camera.x = nextCamera.x;
    this.camera.y = nextCamera.y;
  }

  private updateEnemies(deltaSeconds: number): void {
    for (const enemy of this.enemies) {
      if (enemy.behavior.kind !== "patrol") continue;
      enemy.x += enemy.direction * enemy.behavior.speed * deltaSeconds;
      if (enemy.x <= enemy.behavior.minX) {
        enemy.x = enemy.behavior.minX;
        enemy.direction = 1;
      } else if (enemy.x >= enemy.behavior.maxX) {
        enemy.x = enemy.behavior.maxX;
        enemy.direction = -1;
      }
    }
  }

  private updatePlayer(deltaSeconds: number): void {
    const left = this.input.keys.has("a") || this.input.keys.has("arrowleft");
    const right = this.input.keys.has("d") || this.input.keys.has("arrowright");
    const direction = (right ? 1 : 0) - (left ? 1 : 0);
    this.player.velocity.x = direction * this.config.startingSpeed;

    const previousX = this.player.position.x;
    this.player.position.x += this.player.velocity.x * deltaSeconds;
    for (const platform of this.level.platforms) {
      if (!circleIntersectsRect(this.player, platform)) continue;
      if (previousX + this.player.radius <= platform.x) {
        this.player.position.x = platform.x - this.player.radius;
      } else if (previousX - this.player.radius >= platform.x + platform.width) {
        this.player.position.x = platform.x + platform.width + this.player.radius;
      }
    }
    this.player.position.x = Math.max(this.player.radius, Math.min(this.player.position.x, this.level.width - this.player.radius));

    const previousPosition = { ...this.player.position };
    this.player.velocity.y += GRAVITY * deltaSeconds;
    this.player.position.y += this.player.velocity.y * deltaSeconds;
    for (const platform of this.level.platforms) {
      const resolution = resolveCircleRectCollision(this.player, platform, previousPosition);
      if (!resolution) continue;
      this.player.position = resolution.position;
      if (resolution.normal.y < 0 && this.player.velocity.y >= 0) this.player.velocity.y = 0;
      else if (resolution.normal.y > 0 && this.player.velocity.y < 0) this.player.velocity.y = 0;
    }
  }

  private tryFire(): void {
    if (!this.canFire) return;
    const aim = { x: this.input.mouse.x + this.camera.x, y: this.input.mouse.y + this.camera.y };
    const direction = { x: aim.x - this.player.position.x, y: aim.y - this.player.position.y };
    const length = Math.hypot(direction.x, direction.y);
    if (length < 0.001) return;
    this.blueProjectile = createBlueProjectile(this.player.position, { x: direction.x / length, y: direction.y / length });
    this.lastFireAtMs = this.elapsedMs;
  }

  private updateBlueProjectile(deltaSeconds: number): void {
    const projectile = this.blueProjectile;
    if (!projectile) return;

    const slices = Math.max(1, Math.ceil((PROJECTILE_SPEED * deltaSeconds) / 9));
    const sliceSeconds = deltaSeconds / slices;
    for (let slice = 0; slice < slices && this.blueProjectile; slice += 1) {
      const distance = PROJECTILE_SPEED * sliceSeconds;
      if (distance > projectile.remainingRange) {
        projectile.position.x += (projectile.velocity.x / PROJECTILE_SPEED) * projectile.remainingRange;
        projectile.position.y += (projectile.velocity.y / PROJECTILE_SPEED) * projectile.remainingRange;
        consumeProjectileTravel(projectile, projectile.remainingRange);
        this.failBlueShot();
        return;
      }

      const previousPosition = { ...projectile.position };
      projectile.position.x += (projectile.velocity.x / PROJECTILE_SPEED) * distance;
      projectile.position.y += (projectile.velocity.y / PROJECTILE_SPEED) * distance;
      consumeProjectileTravel(projectile, distance);

      if (this.greenThreat && circleIntersectsCircle(projectile, this.greenThreat)) {
        this.greenThreat = null;
        this.blueProjectile = null;
        return;
      }

      const hitEnemy = this.enemies.find((enemy) => circleIntersectsCircle(projectile, {
        position: { x: enemy.x, y: enemy.y },
        radius: enemy.radius,
      }));
      if (hitEnemy) {
        if (hitEnemy.id === this.currentTargetId) this.captureEnemy(hitEnemy);
        else this.failBlueShot();
        return;
      }

      const hitPlatform = this.level.platforms.find((platform) => circleIntersectsRect(projectile, platform));
      if (hitPlatform) {
        const resolution = resolveCircleRectCollision(projectile, hitPlatform, previousPosition);
        if (resolution) {
          projectile.position = resolution.position;
          if (!applyProjectileBounce(projectile, resolution.normal, BOUNCE_BONUS, MAX_BOUNCES)) {
            this.failBlueShot();
            return;
          }
        }
      }

      if (projectile.remainingRange <= 0) {
        this.failBlueShot();
        return;
      }
    }
  }

  private captureEnemy(enemy: RuntimeEnemy): void {
    this.player.position = { x: enemy.x, y: enemy.y };
    this.player.velocity = { x: 0, y: 0 };
    this.enemies = this.enemies.filter((candidate) => candidate.id !== enemy.id);
    this.capturedCount += 1;
    this.blueProjectile = null;
  }

  private failBlueShot(): void {
    const position = this.blueProjectile ? { ...this.blueProjectile.position } : { ...this.player.position };
    this.blueProjectile = null;
    if (!this.greenThreat) this.greenThreat = { position, radius: 11 };
  }

  private updateGreenThreat(deltaSeconds: number): void {
    if (!this.greenThreat) return;
    const dx = this.player.position.x - this.greenThreat.position.x;
    const dy = this.player.position.y - this.greenThreat.position.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= this.player.radius + this.greenThreat.radius) {
      this.loseLife("threat");
      return;
    }
    if (distance > 0) {
      this.greenThreat.position.x += (dx / distance) * GREEN_SPEED * deltaSeconds;
      this.greenThreat.position.y += (dy / distance) * GREEN_SPEED * deltaSeconds;
    }
  }

  render(context: CanvasRenderingContext2D): void {
    context.clearRect(0, 0, this.viewport.width, this.viewport.height);
    context.fillStyle = "#11192b";
    context.fillRect(0, 0, this.viewport.width, this.viewport.height);
    context.save();
    context.translate(-this.camera.x, -this.camera.y);

    this.drawWorldBackground(context);
    this.drawExit(context);
    for (const platform of this.level.platforms) this.drawPlatform(context, platform.x, platform.y, platform.width, platform.height);
    for (const enemy of this.enemies) this.drawEnemy(context, enemy);
    if (this.greenThreat) this.drawCircle(context, this.greenThreat.position, this.greenThreat.radius, "#52e37c");
    if (this.blueProjectile) this.drawCircle(context, this.blueProjectile.position, this.blueProjectile.radius, "#58a7ff");
    if (this.canFire) this.drawAimLine(context);
    this.drawCircle(context, this.player.position, this.player.radius, "#3988ff");
    context.restore();
  }

  private drawWorldBackground(context: CanvasRenderingContext2D): void {
    context.fillStyle = "#151e35";
    context.fillRect(0, 0, this.level.width, this.level.height);
    context.strokeStyle = "#253552";
    context.lineWidth = 1;
    for (let x = 0; x <= this.level.width; x += 200) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, this.level.height);
      context.stroke();
    }
    for (let y = 0; y <= this.level.height; y += 200) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(this.level.width, y);
      context.stroke();
    }
  }

  private drawPlatform(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    context.fillStyle = "#354766";
    context.fillRect(x, y, width, height);
    context.fillStyle = "#6de5ff";
    context.fillRect(x, y, width, 4);
  }

  private drawExit(context: CanvasRenderingContext2D): void {
    const exit = this.level.exit;
    context.fillStyle = this.isSequenceComplete ? "#e7c95c" : "#5d5f6c";
    context.globalAlpha = this.isSequenceComplete ? 0.9 : 0.45;
    context.fillRect(exit.x, exit.y, exit.width, exit.height);
    context.globalAlpha = 1;
    context.strokeStyle = "#fff1a1";
    context.lineWidth = 3;
    context.strokeRect(exit.x, exit.y, exit.width, exit.height);
    context.fillStyle = "#182034";
    context.font = "bold 20px sans-serif";
    context.fillText(this.isSequenceComplete ? "EXIT" : "LOCKED", exit.x + 16, exit.y + 58);
  }

  private drawEnemy(context: CanvasRenderingContext2D, enemy: RuntimeEnemy): void {
    this.drawCircle(context, { x: enemy.x, y: enemy.y }, enemy.radius, "#ed5364");
    if (enemy.id === this.currentTargetId) {
      context.strokeStyle = "#ffe37c";
      context.lineWidth = 3;
      context.beginPath();
      context.arc(enemy.x, enemy.y, enemy.radius + 9, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = "#ffe37c";
      context.font = "bold 14px sans-serif";
      context.fillText("TARGET", enemy.x - 28, enemy.y - 30);
    }
  }

  private drawAimLine(context: CanvasRenderingContext2D): void {
    const target = { x: this.input.mouse.x + this.camera.x, y: this.input.mouse.y + this.camera.y };
    const dx = target.x - this.player.position.x;
    const dy = target.y - this.player.position.y;
    const length = Math.hypot(dx, dy) || 1;
    context.strokeStyle = "#8dc5ff99";
    context.setLineDash([8, 8]);
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(this.player.position.x, this.player.position.y);
    context.lineTo(this.player.position.x + (dx / length) * 160, this.player.position.y + (dy / length) * 160);
    context.stroke();
    context.setLineDash([]);
  }

  private drawCircle(context: CanvasRenderingContext2D, position: Vector2, radius: number, color: string): void {
    context.fillStyle = color;
    context.beginPath();
    context.arc(position.x, position.y, radius, 0, Math.PI * 2);
    context.fill();
  }
}
