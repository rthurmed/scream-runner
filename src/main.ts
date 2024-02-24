import kaboom, { KaboomCtx } from "kaboom";
import { Microphone } from "./microphone";

const GAME_HEIGHT = 600;
const GAME_WIDTH = 800;
const GAME_GRAVITY = 2400;
const GAME_BACKGROUND = [164, 209, 250];
const GAME_FPS = 60;
const GAME_TICK = 1/GAME_FPS;
const FLOOR_SIZE = 100;
const BOUNDARY_SIZE = 300;
const MIC_LEVEL_1 = .15;
const MIC_LEVEL_2 = .4;
const MIC_LEVEL_3 = .6;
const PLAYER_JUMP_STRENGTH = 1200;
const PLAYER_MIN_POSITION = 200;
const PLAYER_WALK_POSITION = PLAYER_MIN_POSITION + 200;
const PLAYER_MAX_POSITION = PLAYER_MIN_POSITION + 400;
const PLAYER_SPEED = 600;
const VOLUME_RAISE = GAME_TICK * 16;
const VOLUME_DECAY = GAME_TICK * 1;
const ENEMY_FALLING_Y = 10;
const ENEMY_AIM_OPACITY = .5;
const ENEMY_ATTACK_TIMEOUT = 3;

export const addPlayer = (k: KaboomCtx) => {
  const player = k.add([
    "player",
    k.sprite("bean"),
    k.anchor("bot"),
    k.pos(100, 100),
    k.area(),
    k.body({
      mass: .5
    }),
    k.state("idle", ["idle", "walk", "run"]),
    {
      destX: PLAYER_MIN_POSITION,
      updateState(volume: number) {
        if (this.state == "idle") {
          if (volume > MIC_LEVEL_1) {
            this.enterState("walk");
          }
        }
    
        if (this.state == "walk") {
          if (volume < MIC_LEVEL_1) {
            this.enterState("idle");
          }
          if (volume > MIC_LEVEL_2) {
            this.enterState("run");
          }
        }
    
        if (this.state == "run") {
          if (volume < MIC_LEVEL_2) {
            this.enterState("walk");
          }
        }
      }
    }
  ]);

  player.onStateEnter("idle", () => {
    player.destX = PLAYER_MIN_POSITION;
  });

  player.onStateEnter("walk", () => {
    player.destX = PLAYER_WALK_POSITION;
  });

  player.onStateEnter("run", () => {
    player.destX = PLAYER_MAX_POSITION;
  });

  player.onCollide("projectile", (projectile, collision) => {
    k.addKaboom(player.pos);
    projectile.destroy();
  });

  return player;
}

export const addFallingEnemy = (k: KaboomCtx, x: number) => {
  const aim = k.add([
    k.pos(x, ENEMY_FALLING_Y),
    k.sprite("bomb"),
    k.anchor("top"),
    k.opacity(ENEMY_AIM_OPACITY),
  ]);

  k.wait(ENEMY_ATTACK_TIMEOUT, () => {
    aim.destroy();
    const projectile = k.add([
      "enemy",
      "projectile",
      k.pos(x, ENEMY_FALLING_Y),
      k.sprite("bomb"),
      k.anchor("top"),
      k.area({ collisionIgnore: ["structure", "boundary"] }),
      k.body(),
      k.offscreen({ destroy: true }),
    ]);
  });

  return aim;
}

const main = async ({ debug = true }) => {
  const k = kaboom({
    height: GAME_HEIGHT,
    width: GAME_WIDTH,
    background: GAME_BACKGROUND,
    maxFPS: GAME_FPS
  });
  
  // sprites
  k.loadSprite("bean", "/sprites/bean.png");
  k.loadSprite("bomb", "/sprites/bomb.png");

  // game configs
  k.setGravity(GAME_GRAVITY);
  k.debug.inspect = debug;

  // debug tools
  if (debug) {
    // camera controls
    k.onKeyDown('=', () => (k.camScale(k.camScale().scale(k.vec2(1.1)))));
    k.onKeyDown('-', () => (k.camScale(k.camScale().scale(k.vec2(0.9)))));
    k.onKeyDown('0', () => (k.camScale(k.vec2(1))));
  }
  
  // modules
  const microphone = await Microphone();

  // entities
  const floor = k.add([
    "structure",
    k.pos(0, k.height() - FLOOR_SIZE),
    k.rect(k.width(), FLOOR_SIZE),
    k.color(k.Color.BLACK),
    k.area(),
    k.body({
      isStatic: true
    })
  ]);
  const boundaries = [
    k.add([ // left boundary
      "boundary",
      k.pos(-BOUNDARY_SIZE, -BOUNDARY_SIZE),
      k.rect(BOUNDARY_SIZE, k.height() + (BOUNDARY_SIZE * 2)),
      k.area(),
      k.body({
        isStatic: true
      })
    ]),
    k.add([ // right boundary
      "boundary",
      k.pos(k.width(), -BOUNDARY_SIZE),
      k.rect(BOUNDARY_SIZE, k.height() + (BOUNDARY_SIZE * 2)),
      k.area(),
      k.body({
        isStatic: true
      })
    ]),
    k.add([ // bottom boundary
      "boundary",
      k.pos(-BOUNDARY_SIZE, k.height()),
      k.rect(k.width() + (BOUNDARY_SIZE * 2), BOUNDARY_SIZE),
      k.area(),
      k.body({
        isStatic: true
      })
    ]),
    k.add([ // top boundary
      "boundary",
      k.pos(-BOUNDARY_SIZE, -BOUNDARY_SIZE),
      k.rect(k.width() + (BOUNDARY_SIZE * 2), BOUNDARY_SIZE),
      k.area(),
      k.body({
        isStatic: true
      })
    ])
  ];

  const player = addPlayer(k);

  const volumeDisplay = k.add([
    k.pos(k.width() - 12, k.height() - 10),
    k.rect(30, 80),
    k.anchor("botright"),
    k.color(k.Color.RED)
  ]);

  {
    const darkRed = k.Color.fromArray([179, 9, 0]);
    const red = k.Color.RED;
    const orange = k.Color.fromArray([255, 101, 0]);
    const yellow = k.Color.YELLOW;
    
    const rulerTemplate = [
      k.pos(k.width() - 10, k.height() - 10),
      k.anchor("botright"),
    ]

    // rulers
    k.add([...rulerTemplate, k.color(darkRed), k.rect(2, 80)]);
    k.add([...rulerTemplate, k.color(red),     k.rect(2, 80 * MIC_LEVEL_3)]);
    k.add([...rulerTemplate, k.color(orange),  k.rect(2, 80 * MIC_LEVEL_2)]);
    k.add([...rulerTemplate, k.color(yellow),  k.rect(2, 80 * MIC_LEVEL_1)]);
  }

  // TODO: spawn pattern
  addFallingEnemy(k, PLAYER_WALK_POSITION);

  let volume = 0;

  k.loop(GAME_TICK, () => {
    // manage volume
    const rawVolume = microphone.getVolume();
    const speed = rawVolume > volume ? VOLUME_RAISE : VOLUME_DECAY;
    volume = k.lerp(volume, rawVolume, speed);

    // update volume display
    volumeDisplay.height = volume * 80;

    // player movement
    player.updateState(volume);
    player.moveTo(player.destX, player.pos.y, PLAYER_SPEED);

    // player jump
    const tryingToJump = volume > MIC_LEVEL_2;
    if (tryingToJump && player.isGrounded()) {
      player.jump(PLAYER_JUMP_STRENGTH);
    }
  });
}  

main({
  debug: true
});
