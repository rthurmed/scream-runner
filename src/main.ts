import kaboom, { KaboomCtx } from "kaboom";
import { Microphone } from "./microphone";

const GAME_HEIGHT = 600;
const GAME_WIDTH = 800;
const GAME_GRAVITY = 2400;
const GAME_BACKGROUND = [164, 209, 250];
const GAME_FPS = 60;
const GAME_TICK = 1/GAME_FPS;
const GAME_INITIAL_TIME = 5; // s
const FLOOR_SIZE = 100;
const BOUNDARY_SIZE = 300;
const MIC_LEVEL_1 = .15;
const MIC_LEVEL_2 = .4;
const MIC_LEVEL_3 = .7;
const PLAYER_JUMP_STRENGTH = 1200;
const PLAYER_MIN_POSITION = 200;
const PLAYER_WALK_POSITION = PLAYER_MIN_POSITION + 200;
const PLAYER_MAX_POSITION = PLAYER_MIN_POSITION + 400;
const PLAYER_SPEED = 600;
const PLAYER_LIFE = 100;
const VOLUME_RAISE = GAME_TICK * 16;
const VOLUME_DECAY = GAME_TICK * 2;
const ENEMY_FALLING_Y = 10;
const ENEMY_AIM_OPACITY = .5;
const ENEMY_ATTACK_TIMEOUT = 2;
const ENEMY_FALLING_SPAWN_RATE = 5;
const ENEMY_HORIZONTAL_SPAWN_RATE = 8;
const ENEMY_HORIZONTAL_INITIAL_TIME = GAME_INITIAL_TIME * 1.2;
const ENEMY_RIGHT_STARTING_X = PLAYER_MAX_POSITION + 150;
const ENEMY_FLYING_HEIGHT = 120;
const ENEMY_MOVE_SPEED = 400;
const ENEMY_ATTACKS_TO_DEATH = 3;
const ENEMY_DAMAGE = PLAYER_LIFE / ENEMY_ATTACKS_TO_DEATH;
const COLLECTIBLE_Y_MIN = 180;
const COLLECTIBLE_Y_MAX = GAME_HEIGHT- FLOOR_SIZE - 4;
const COLLECTIBLE_MOVE_SPEED = 200;
const COLLECTIBLE_INITIAL_TIME = GAME_INITIAL_TIME * .5;
const COLLECTIBLE_SPAWN_RATE = 1;
const COLLECTIBLE_HEAL = ENEMY_DAMAGE / 3;
const UI_LIFE_WIDTH = 400;
const UI_LIFE_HEIGHT = 16;

type SpawnPattern = 'both' | 'walking' | 'flying';

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
      life: PLAYER_LIFE,
      collected: 0,
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
    // TODO: death
    player.life = player.life - ENEMY_DAMAGE;
    k.addKaboom(player.pos);
    projectile.destroy();
  });

  player.onCollide("collectible", (collectible, collision) => {
    // TODO: sound fx
    player.collected = player.collected + 1;
    let healed = player.life + COLLECTIBLE_HEAL;
    if (healed > PLAYER_LIFE) {
      healed = PLAYER_LIFE;
    }
    player.life = healed;
    collectible.destroy();
  });

  return player;
}

export const addFallingEnemy = (k: KaboomCtx, x: number) => {
  const telling = k.add([
    k.pos(x, ENEMY_FALLING_Y),
    k.sprite("bomb"),
    k.anchor("top"),
    k.opacity(ENEMY_AIM_OPACITY),
  ]);

  k.wait(ENEMY_ATTACK_TIMEOUT, () => {
    telling.destroy();
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

  return telling;
}

export const addWalkingEnemy = (k: KaboomCtx) => {
  const telling = k.add([
    k.pos(ENEMY_RIGHT_STARTING_X, k.height() - FLOOR_SIZE),
    k.sprite("ghosty"),
    k.anchor("bot"),
    k.opacity(ENEMY_AIM_OPACITY),
  ]);
  k.wait(ENEMY_ATTACK_TIMEOUT, () => {
    telling.destroy();
    const projectile = k.add([
      "enemy",
      "projectile",
      k.pos(ENEMY_RIGHT_STARTING_X, k.height() - FLOOR_SIZE),
      k.sprite("ghosty"),
      k.anchor("bot"),
      k.area({ collisionIgnore: ["structure", "boundary"] }),
      k.move(k.LEFT, ENEMY_MOVE_SPEED),
      k.offscreen({ destroy: true }),
    ]);
  });
  return telling;
}

export const addFlyingEnemy = (k: KaboomCtx) => {
  const telling = k.add([
    k.pos(ENEMY_RIGHT_STARTING_X, k.height() - FLOOR_SIZE - ENEMY_FLYING_HEIGHT),
    k.sprite("ghosty"),
    k.anchor("bot"),
    k.opacity(ENEMY_AIM_OPACITY),
  ]);
  k.wait(ENEMY_ATTACK_TIMEOUT, () => {
    telling.destroy();
    const projectile = k.add([
      "enemy",
      "projectile",
      k.pos(ENEMY_RIGHT_STARTING_X, k.height() - FLOOR_SIZE - ENEMY_FLYING_HEIGHT),
      k.sprite("ghosty"),
      k.anchor("bot"),
      k.area({ collisionIgnore: ["structure", "boundary"] }),
      k.move(k.LEFT, ENEMY_MOVE_SPEED),
      k.offscreen({ destroy: true }),
    ]);
  });
  return telling;
}

export const addCoin = (k: KaboomCtx) => {
  const coin = k.add([
    "coin",
    "collectible",
    k.pos(k.width(), k.randi(COLLECTIBLE_Y_MIN, COLLECTIBLE_Y_MAX)),
    k.sprite("lemon"),
    k.anchor("botleft"),
    k.area({ collisionIgnore: ["structure", "boundary", "enemy", "projectile"] }),
    k.move(k.LEFT, COLLECTIBLE_MOVE_SPEED),
    k.offscreen({ destroy: true }),
  ]);
  return coin;
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
  k.loadSprite("lemon", "/sprites/lemon.png");
  k.loadSprite("gazer", "/sprites/gazer.png");
  k.loadSprite("ghosty", "/sprites/ghosty.png");

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

  // boundaries
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

  // player
  const player = addPlayer(k);

  // ui
  const lifeBackground = k.add([
    k.pos(12, k.height() - 10),
    k.rect(UI_LIFE_WIDTH, UI_LIFE_HEIGHT),
    k.anchor("botleft"),
    k.color(k.Color.fromHex("#7A213A"))
  ]);

  const lifeDisplay = k.add([
    k.pos(12, k.height() - 10),
    k.rect(UI_LIFE_WIDTH, UI_LIFE_HEIGHT),
    k.anchor("botleft"),
    k.color(k.Color.RED)
  ]);

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

  // enemies
  if (debug) {
    k.onKeyPress('1', () => (addFallingEnemy(k, PLAYER_MIN_POSITION)));
    k.onKeyPress('2', () => (addFallingEnemy(k, PLAYER_WALK_POSITION)));
    k.onKeyPress('3', () => (addFallingEnemy(k, PLAYER_MAX_POSITION)));
    k.onKeyPress('4', () => (addWalkingEnemy(k)));
    k.onKeyPress('5', () => (addFlyingEnemy(k)));
  }
  
  k.wait(GAME_INITIAL_TIME, () => {
    k.loop(ENEMY_FALLING_SPAWN_RATE, () => {
      const spawnXPosition = k.choose([
        PLAYER_MIN_POSITION,
        PLAYER_WALK_POSITION,
        PLAYER_WALK_POSITION,
        PLAYER_MAX_POSITION,
      ])
      addFallingEnemy(k, spawnXPosition);
    });
  });

  k.wait(ENEMY_HORIZONTAL_INITIAL_TIME, () => {
    k.loop(ENEMY_HORIZONTAL_SPAWN_RATE, () => {
      const spawnPattern: SpawnPattern = k.choose([
        'both',
        'flying',
        'flying',
        'flying',
        'walking',
        'walking',
      ]);
      if (spawnPattern == 'flying' || spawnPattern == 'both') {
        addFlyingEnemy(k);
      }
      if (spawnPattern == 'walking' || spawnPattern == 'both') {
        addWalkingEnemy(k);
      }
    });
  });

  // collectibles
  if (debug) {
    k.onKeyPress('q', () => (addCoin(k)));
  }

  k.wait(COLLECTIBLE_INITIAL_TIME, () => {
    k.loop(COLLECTIBLE_SPAWN_RATE, () => {
      if (k.chance(.75)) {
        addCoin(k);
      }
    });
  });

  // game state
  let volume = 0;
  let coins = 0;

  // game loop
  k.loop(GAME_TICK, () => {
    // manage volume
    const rawVolume = microphone.getVolume();
    const speed = rawVolume > volume ? VOLUME_RAISE : VOLUME_DECAY;
    volume = k.lerp(volume, rawVolume, speed);

    // update volume display
    volumeDisplay.height = volume * 80;

    // update life display
    lifeDisplay.width = UI_LIFE_WIDTH * (player.life / PLAYER_LIFE);

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
