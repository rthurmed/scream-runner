import kaboom, { GameObj, KaboomCtx, OpacityComp, TimerComp } from "kaboom";
import { IMicrophone, Microphone } from "./microphone";

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const GAME_GRAVITY = 2400;
const GAME_BACKGROUND = [56, 152, 255];
const GAME_FPS = 60;
const GAME_TICK = 1/GAME_FPS;
const GAME_INITIAL_TIME = 5; // s
const GAME_WIN_TIME = 6 * 60; // 6 minutes in seconds
const FLOOR_SIZE = GAME_HEIGHT / 5;
const BOUNDARY_SIZE = 300;
const BOUNDARY_COLOR = [55, 37, 56];
const MIC_LEVEL_1 = .15;
const MIC_LEVEL_2 = .4;
const MIC_LEVEL_3 = .7;
const PLAYER_JUMP_STRENGTH = 1200;
const PLAYER_STEP = GAME_WIDTH / 4;
const PLAYER_MIN_POSITION = PLAYER_STEP * 1;
const PLAYER_WALK_POSITION = PLAYER_STEP * 2;
const PLAYER_MAX_POSITION = PLAYER_STEP * 3;
const PLAYER_SPEED = 600;
const PLAYER_LIFE = 100;
const PLAYER_DEATH_TIMEOUT = 2;
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
const ENEMY_ATTACKS_TO_DEATH = 4;
const ENEMY_DAMAGE = PLAYER_LIFE / ENEMY_ATTACKS_TO_DEATH;
const COLLECTIBLE_Y_MIN = 180;
const COLLECTIBLE_Y_MAX = GAME_HEIGHT- FLOOR_SIZE - 4;
const COLLECTIBLE_MOVE_SPEED = 200;
const COLLECTIBLE_INITIAL_TIME = GAME_INITIAL_TIME * .5;
const COLLECTIBLE_SPAWN_RATE = 2;
const COLLECTIBLE_HEAL = ENEMY_DAMAGE / 3;
const UI_ICON_PADDING = 6;
const UI_BAR_HEIGHT = FLOOR_SIZE - UI_ICON_PADDING * 2;
const UI_BAR_WIDTH = 32;
const SPRITESHEET_SIZE = 32;
const SPRITE_SCALING = 4;
const SPRITE_SCALED_SIZE = SPRITESHEET_SIZE * SPRITE_SCALING;
const ICONSHEET_SIZE = 16;
const ICON_SCALED_SIZE = ICONSHEET_SIZE * SPRITE_SCALING;
const QUARTER_SPRITE_SIZE = SPRITE_SCALED_SIZE/4;
const MUSIC_VOLUME = .3;

type SpawnPattern = 'both' | 'walking' | 'flying';

type Game = GameObj<TimerComp | {
  music: boolean;
  sfx: boolean;
}>;

export const setupDebugTools = (k: KaboomCtx) => {
  // camera controls
  k.onKeyDown('=', () => (k.camScale(k.camScale().scale(k.vec2(1.1)))));
  k.onKeyDown('-', () => (k.camScale(k.camScale().scale(k.vec2(0.9)))));
  k.onKeyDown('[', () => (k.debug.timeScale = k.debug.timeScale * 1.1));
  k.onKeyDown(']', () => (k.debug.timeScale = k.debug.timeScale * 0.9));
  k.onKeyDown('0', () => (k.camScale(k.vec2(1))));
  k.onKeyDown('p', () => (k.debug.paused = !k.debug.paused));
}

export const randPitch = (k: KaboomCtx) => ({
  detune: k.randi(0, 12) * 100,
});

export const addPlayer = (k: KaboomCtx, game: Game) => {
  const initialPos = k.vec2(k.width() / 2, k.height() / 2 + 100 - (UI_ICON_PADDING * 4))
  const player = game.add([
    "player",
    k.sprite("enzo", {
      width: SPRITE_SCALED_SIZE,
      height: SPRITE_SCALED_SIZE
    }),
    k.opacity(1),
    k.anchor("bot"),
    k.pos(initialPos),
    k.offscreen({ distance: 0 }),
    k.area({
      shape: new k.Rect(
        k.vec2(0, 0),
        13 * SPRITE_SCALING,
        19 * SPRITE_SCALING
      )
    }),
    k.body({
      mass: .5
    }),
    k.health(PLAYER_LIFE),
    k.state("idle", ["idle", "walk", "run"]),
    {
      collected: 0,
      destX: PLAYER_MIN_POSITION,
      game: game,
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
    player.hurt(ENEMY_DAMAGE);
    projectile.destroy();
  });

  player.onCollide("collectible", (collectible, collision) => {
    player.collected = player.collected + 1;
    player.heal(COLLECTIBLE_HEAL);
    if (player.hp() > player.maxHP()) {
      player.setHP(player.maxHP());
    }
    if (player.game.sfx) {
      k.play('pickup', randPitch(k));
    }
    collectible.destroy();
  });

  player.onHurt(() => {
    if (player.game.sfx) {
      k.play("hurt", randPitch(k));
    }
    k.shake(30);
  });

  player.onDeath(() => {
    // TODO: death animation
    player.opacity = 0;
    player.paused = true;
    player.isStatic = true;
    game.wait(PLAYER_DEATH_TIMEOUT, () => {
      k.go("gameover");
    });
  });

  player.onExitScreen(() => {
    // sometimes when the game was put on background the player would fly
    // offscreen and never come back. this callback fix this.
    player.pos = initialPos;
  });

  return player;
}

export const timedOutAttack = (
  k: KaboomCtx,
  game: Game,
  obj: GameObj<OpacityComp>,
  timeout = ENEMY_ATTACK_TIMEOUT,
  opacity = ENEMY_AIM_OPACITY
) => {
  obj.opacity = opacity;
  obj.paused = true;

  game.wait(timeout, () => {
    obj.paused = false;
    obj.opacity = 1;
  });
}

export const addFallingEnemy = (k: KaboomCtx, game: Game, x: number) => {
  const enemy = game.add([
    "enemy",
    "projectile",
    k.pos(x, ENEMY_FALLING_Y),
    k.sprite("stomper", {
      width: SPRITE_SCALED_SIZE,
      height: SPRITE_SCALED_SIZE
    }),
    k.anchor("top"),
    k.opacity(1),
    k.area({
      collisionIgnore: ["structure", "boundary"],
      shape: new k.Rect(
        k.vec2(0, 8 * SPRITE_SCALING),
        16 * SPRITE_SCALING,
        24 * SPRITE_SCALING
      )
    }),
    k.body(),
    k.offscreen({ destroy: true }),
  ]);

  timedOutAttack(k, game, enemy);

  return enemy;
}

export const addWalkingEnemy = (k: KaboomCtx, game: Game) => {
  const enemy = game.add([
    "enemy",
    "projectile",
    k.pos(ENEMY_RIGHT_STARTING_X, k.height() - FLOOR_SIZE),
    k.sprite("walker", {
      width: SPRITE_SCALED_SIZE,
      height: SPRITE_SCALED_SIZE
    }),
    k.anchor("bot"),
    k.opacity(1),
    k.area({
      collisionIgnore: ["structure", "boundary"],
      shape: new k.Rect(
        k.vec2(0, 0),
        14 * SPRITE_SCALING,
        22 * SPRITE_SCALING
      )
    }),
    k.move(k.LEFT, ENEMY_MOVE_SPEED),
    k.offscreen({ destroy: true }),
  ]);

  timedOutAttack(k, game, enemy);

  return enemy;
}

export const addFlyingEnemy = (k: KaboomCtx, game: Game) => {
  const enemy = game.add([
    "enemy",
    "projectile",
    k.pos(ENEMY_RIGHT_STARTING_X, k.height() - FLOOR_SIZE - ENEMY_FLYING_HEIGHT),
    k.sprite("hoverer", {
      width: SPRITE_SCALED_SIZE,
      height: SPRITE_SCALED_SIZE
    }),
    k.anchor("bot"),
    k.opacity(1),
    k.area({
      collisionIgnore: ["structure", "boundary"],
      shape: new k.Rect(
        k.vec2(0, -3 * SPRITE_SCALING),
        24 * SPRITE_SCALING,
        14 * SPRITE_SCALING
      )
    }),
    k.move(k.LEFT, ENEMY_MOVE_SPEED),
    k.offscreen({ destroy: true }),
  ]);

  timedOutAttack(k, game, enemy);

  return enemy;
}

export const addCoin = (k: KaboomCtx, game: Game) => { 
  const coin = game.add([
    "coin",
    "collectible",
    k.pos(k.width(), k.randi(COLLECTIBLE_Y_MIN, COLLECTIBLE_Y_MAX)),
    k.sprite("cake", {
      width: SPRITE_SCALED_SIZE,
      height: SPRITE_SCALED_SIZE
    }),
    k.anchor("botleft"),
    k.area({
      collisionIgnore: ["structure", "boundary", "enemy", "projectile"],
      shape: new k.Rect(
        k.vec2(8 * SPRITE_SCALING, -8 * SPRITE_SCALING),
        16 * SPRITE_SCALING,
        16 * SPRITE_SCALING
      )
    }),
    k.move(k.LEFT, COLLECTIBLE_MOVE_SPEED),
    k.offscreen({ destroy: true }),
  ]);
  return coin;
}

const makeGameScene = (k: KaboomCtx, microphone: IMicrophone, debug: boolean = false) => () => {
  const game: Game = k.add([
    k.timer(),
    {
      music: true,
      sfx: true
    }
  ]);

  if (debug) {
    setupDebugTools(k);
  }

  // boundaries
  const floor = game.add([
    "structure",
    k.pos(-BOUNDARY_SIZE, k.height() - FLOOR_SIZE),
    k.rect(k.width() + (BOUNDARY_SIZE * 2), FLOOR_SIZE),
    k.color(k.Color.fromHex('#372538')),
    k.area(),
    k.body({
      isStatic: true
    })
  ]);
  const baseBoundary = [
    "boundary",
    k.area(),
    k.color(k.Color.fromArray(BOUNDARY_COLOR)),
    k.body({
      isStatic: true
    })
  ]
  const boundaries = [
    game.add([ // left boundary
      k.pos(-BOUNDARY_SIZE, -BOUNDARY_SIZE),
      k.rect(BOUNDARY_SIZE, k.height() + (BOUNDARY_SIZE * 2)),
      ...baseBoundary
    ]),
    game.add([ // right boundary
      k.pos(k.width(), -BOUNDARY_SIZE),
      k.rect(BOUNDARY_SIZE, k.height() + (BOUNDARY_SIZE * 2)),
      ...baseBoundary
    ]),
    game.add([ // bottom boundary
      k.pos(-BOUNDARY_SIZE, k.height()),
      k.rect(k.width() + (BOUNDARY_SIZE * 2), BOUNDARY_SIZE),
      ...baseBoundary
    ]),
    game.add([ // top boundary
      k.pos(-BOUNDARY_SIZE, -BOUNDARY_SIZE),
      k.rect(k.width() + (BOUNDARY_SIZE * 2), BOUNDARY_SIZE),
      ...baseBoundary
    ])
  ];

  // player
  const player = addPlayer(k, game);

  // ui
  const uiLifeHeight = k.height() - QUARTER_SPRITE_SIZE * 2;
  const uiCollectibleHeight = QUARTER_SPRITE_SIZE + UI_ICON_PADDING;

  const iconLife = game.add([
    k.sprite("heart", {
      width: SPRITE_SCALED_SIZE,
      height: SPRITE_SCALED_SIZE
    }),
    k.pos(-QUARTER_SPRITE_SIZE + UI_ICON_PADDING, uiLifeHeight),
    k.anchor("left")
  ]);

  // NOTE: hidden
  const iconCollectible = game.add([
    k.opacity(0),
    k.sprite("cake", {
      width: SPRITE_SCALED_SIZE,
      height: SPRITE_SCALED_SIZE
    }),
    k.pos(-QUARTER_SPRITE_SIZE + UI_ICON_PADDING, uiCollectibleHeight),
    k.anchor("left")
  ]);
  const textCollectible = game.add([
    k.text("Score: 0", {
      size: 24,
    }),
    // k.pos(quarterSpriteSize * 2.5, uiCollectibleHeight),
    k.pos(UI_ICON_PADDING * 3, uiCollectibleHeight),
    k.anchor("left"),
  ])

  const lifeBackground = game.add([
    k.pos(QUARTER_SPRITE_SIZE * 2.5, k.height() - UI_ICON_PADDING),
    k.rect(UI_BAR_WIDTH, UI_BAR_HEIGHT),
    k.anchor("botleft"),
    k.color(k.Color.fromHex("#7A213A"))
  ]);

  const lifeDisplay = game.add([
    k.pos(QUARTER_SPRITE_SIZE * 2.5, k.height() - UI_ICON_PADDING),
    k.rect(UI_BAR_WIDTH, UI_BAR_HEIGHT),
    k.anchor("botleft"),
    k.color(k.Color.fromHex("#e14141"))
  ]);

  const darkRed = k.Color.fromHex("#7a213a");
  const red = k.Color.fromHex("#e14141");
  const orange = k.Color.fromHex("#ffbf36");
  const yellow = k.Color.fromHex("#fff275");

  const iconVolume = game.add([
    k.sprite("microphone", {
      width: SPRITE_SCALED_SIZE,
      height: SPRITE_SCALED_SIZE
    }),
    k.pos(k.width() - UI_ICON_PADDING * 6, uiLifeHeight + 4),
    k.anchor("right")
  ])
  
  const rulerTemplate = [
    k.pos(k.width() - UI_ICON_PADDING, k.height() - UI_ICON_PADDING),
    k.anchor("botright"),
  ]

  game.add([...rulerTemplate, k.color(darkRed), k.rect(UI_BAR_WIDTH, UI_BAR_HEIGHT)]);
  game.add([...rulerTemplate, k.color(red),     k.rect(UI_BAR_WIDTH, UI_BAR_HEIGHT * MIC_LEVEL_3)]);
  game.add([...rulerTemplate, k.color(orange),  k.rect(UI_BAR_WIDTH, UI_BAR_HEIGHT * MIC_LEVEL_2)]);
  game.add([...rulerTemplate, k.color(yellow),  k.rect(UI_BAR_WIDTH, UI_BAR_HEIGHT * MIC_LEVEL_1)]);

  const volumeDisplay = game.add([
    k.pos(k.width() - UI_ICON_PADDING * 4, k.height() - UI_ICON_PADDING),
    k.rect(UI_BAR_WIDTH, UI_BAR_HEIGHT),
    k.anchor("botright"),
    k.color(k.Color.WHITE),
    k.outline(4, k.Color.fromHex("#372538"))
  ]);

  // pause
  const pauseMenu = k.add([
    k.rect(k.width(), k.height()),
    k.pos(0, 0),
    k.color(k.Color.fromHex("#372538")),
    k.opacity(0),
  ]);

  // pause actions bar
  const sfxToggle = pauseMenu.add([
    "sfx-toggle",
    "toggleable",
    k.opacity(1),
    k.pos(k.width() - UI_ICON_PADDING - (ICON_SCALED_SIZE * 2), UI_ICON_PADDING),
    k.anchor("topright"),
    k.sprite("icon-sfx", {
      height: ICON_SCALED_SIZE,
      width: ICON_SCALED_SIZE,
      frame: game.sfx ? 0 : 1,
    }),
    k.area()
  ]);

  const musicToggle = pauseMenu.add([
    "music-toggle",
    "toggleable",
    k.opacity(1),
    k.pos(k.width() - UI_ICON_PADDING - (ICON_SCALED_SIZE * 1), UI_ICON_PADDING),
    k.anchor("topright"),
    k.sprite("icon-music", {
      height: ICON_SCALED_SIZE,
      width: ICON_SCALED_SIZE,
      frame: game.music ? 0 : 1,
    }),
    k.area()
  ]);

  const pauseToggle = pauseMenu.add([
    "pause-toggle",
    "toggleable",
    k.opacity(1),
    k.pos(k.width() - UI_ICON_PADDING, UI_ICON_PADDING),
    k.anchor("topright"),
    k.sprite("icon-pause", {
      height: ICON_SCALED_SIZE,
      width: ICON_SCALED_SIZE,
      frame: 0,
    }),
    k.area()
  ]);

  const togglePause = () => {
    game.paused = !game.paused;
    pauseMenu.opacity = game.paused ? .5 : 0;
    pauseToggle.frame = game.paused ? 1 : 0;
  }

  k.onClick("pause-toggle", togglePause);
  k.onKeyRelease("p", togglePause);

  k.onClick("music-toggle", () => {
    game.music = !game.music;
    musicToggle.frame = game.music ? 0 : 1;
  });

  k.onClick("sfx-toggle", () => {
    game.sfx = !game.sfx;
    sfxToggle.frame = game.sfx ? 0 : 1;
  });

  k.onHoverEnd("toggleable", () => {
    k.setCursor("default");
  });

  k.onHover("toggleable", () => {
    k.setCursor("pointer");
  });

  // enemies
  if (debug) {
    k.onKeyPress('1', () => (addFallingEnemy(k, game, PLAYER_MIN_POSITION)));
    k.onKeyPress('2', () => (addFallingEnemy(k, game, PLAYER_WALK_POSITION)));
    k.onKeyPress('3', () => (addFallingEnemy(k, game, PLAYER_MAX_POSITION)));
    k.onKeyPress('4', () => (addWalkingEnemy(k, game)));
    k.onKeyPress('5', () => (addFlyingEnemy(k, game)));
  }
  
  game.wait(GAME_INITIAL_TIME, () => {
    game.loop(ENEMY_FALLING_SPAWN_RATE, () => {
      const spawnXPosition = k.choose([
        PLAYER_MIN_POSITION,
        PLAYER_MIN_POSITION,
        PLAYER_MIN_POSITION,
        PLAYER_WALK_POSITION,
        PLAYER_WALK_POSITION,
        PLAYER_MAX_POSITION,
      ])
      addFallingEnemy(k, game, spawnXPosition);
    });
  });

  game.wait(ENEMY_HORIZONTAL_INITIAL_TIME, () => {
    game.loop(ENEMY_HORIZONTAL_SPAWN_RATE, () => {
      const spawnPattern: SpawnPattern = k.choose([
        'both',
        'flying',
        'flying',
        'flying',
        'walking',
        'walking',
      ]);
      if (spawnPattern == 'flying' || spawnPattern == 'both') {
        addFlyingEnemy(k, game);
      }
      if (spawnPattern == 'walking' || spawnPattern == 'both') {
        addWalkingEnemy(k, game);
      }
    });
  });

  // collectibles
  if (debug) {
    k.onKeyPress('q', () => (addCoin(k, game)));
  }

  game.wait(COLLECTIBLE_INITIAL_TIME, () => {
    game.loop(COLLECTIBLE_SPAWN_RATE, () => {
      if (k.chance(.75)) {
        addCoin(k, game);
      }
    });
  });

  const soundtrack = k.play("music", {
    loop: true,
    volume: MUSIC_VOLUME,
  });

  // game state
  let volume = 0;
  let time = 0; // seconds
  let lastTime = k.time();

  // game loop
  k.loop(GAME_TICK, () => {
    // always update, even if paused
    soundtrack.volume = game.music ? MUSIC_VOLUME : 0;

    if (game.paused) {
      // if paused still updates this
      lastTime = k.time();
      return;
    }

    // manage timer
    let timeDeltaLoop = k.time() - lastTime;
    time += timeDeltaLoop;
    lastTime = k.time();
    
    if (time > GAME_WIN_TIME) {
      k.go("win");
    }

    // manage volume
    const rawVolume = microphone.getVolume();
    const speed = rawVolume > volume ? VOLUME_RAISE : VOLUME_DECAY;
    volume = k.lerp(volume, rawVolume, speed);

    // update volume display
    volumeDisplay.height = volume * 80;

    // update player display
    lifeDisplay.height = UI_BAR_HEIGHT * (player.hp() / player.maxHP());
    textCollectible.text = `Score: ${player.collected.toString()}`;

    // player movement
    player.updateState(volume);
    player.moveTo(player.destX, player.pos.y, PLAYER_SPEED);

    // player jump
    const tryingToJump = volume > MIC_LEVEL_2;
    if (tryingToJump && player.isGrounded()) {
      player.jump(PLAYER_JUMP_STRENGTH);
    }
  });

  k.onSceneLeave(() => {
    soundtrack.paused = true;
  });
}

const makeStartScene = (k: KaboomCtx, microphone: IMicrophone, debug: boolean = false) => () => {
  k.add([
    k.sprite("enzo", {
      width: SPRITE_SCALED_SIZE,
      height: SPRITE_SCALED_SIZE
    }),
    k.pos(k.width() / 2, k.height() / 2 + 100 - (UI_ICON_PADDING * 4)),
    k.anchor("bot")
  ]);
  k.add([
    k.text('Scream to start!', {
      align: "center",
    }),
    k.pos(k.width() / 2, k.height() / 2 + 100),
    k.anchor("top")
  ]);
  k.loop(GAME_TICK, () => {
    const rawVolume = microphone.getVolume();
    if (rawVolume > MIC_LEVEL_3) {
      k.go("game");
    }
  });
}

const makeGameoverScene = (k: KaboomCtx, microphone: IMicrophone, debug: boolean = false) => () => {
  k.add([
    k.text('Game over!', {
      align: "center",
      letterSpacing: 8,
    }),
    k.opacity(1),
    k.fadeIn(1),
    k.pos(k.width() / 2, k.height() / 2),
    k.anchor("bot")
  ]);
  k.wait(1.5, () => {
    k.add([
      "button",
      "retry-button",
      k.text("Retry", {
        align: "center",
        size: 24
      }),
      k.area(),
      k.pos(k.width() / 2, k.height() / 2 + 16),
      k.anchor("top")
    ]);
  });
  k.onClick("retry-button", () => {
    k.go("game");
  });
  k.onHoverEnd("button", () => {
    k.setCursor("default");
  });
  k.onHover("button", () => {
    k.setCursor("pointer");
  });
}

const makeWinScene = (k: KaboomCtx, microphone: IMicrophone, debug: boolean = false) => () => {
  // TODO: show score and time
  k.add([
    k.text('You win!', {
      align: "center",
      letterSpacing: 8,
    }),
    k.opacity(1),
    k.pos(k.width() / 2, k.height() / 2),
    k.anchor("bot")
  ]);
}

const main = async ({ debug = true }) => {
  const k = kaboom({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    background: GAME_BACKGROUND,
    maxFPS: GAME_FPS
  });
  
  // assets
  // sprites
  k.loadSpriteAtlas("sprites/spritesheet.png", {
    "cake": {
      height: SPRITESHEET_SIZE,
      width: SPRITESHEET_SIZE,
      x: SPRITESHEET_SIZE * 0,
      y: SPRITESHEET_SIZE * 0
    },
    "heart": {
      height: SPRITESHEET_SIZE,
      width: SPRITESHEET_SIZE,
      x: SPRITESHEET_SIZE,
      y: SPRITESHEET_SIZE * 0
    },
    "microphone": {
      height: SPRITESHEET_SIZE,
      width: SPRITESHEET_SIZE,
      x: SPRITESHEET_SIZE * 2,
      y: SPRITESHEET_SIZE * 0
    },
    "enzo": {
      height: SPRITESHEET_SIZE,
      width: SPRITESHEET_SIZE,
      x: SPRITESHEET_SIZE * 0,
      y: SPRITESHEET_SIZE
    },
    "walker": {
      height: SPRITESHEET_SIZE,
      width: SPRITESHEET_SIZE,
      x: SPRITESHEET_SIZE,
      y: SPRITESHEET_SIZE
    },
    "stomper": {
      height: SPRITESHEET_SIZE,
      width: SPRITESHEET_SIZE,
      x: SPRITESHEET_SIZE * 2,
      y: SPRITESHEET_SIZE
    },
    "hoverer": {
      height: SPRITESHEET_SIZE,
      width: SPRITESHEET_SIZE,
      x: SPRITESHEET_SIZE * 3,
      y: SPRITESHEET_SIZE
    },
  });

  k.loadSpriteAtlas("sprites/buttons.png", {
    "icon-sfx": {
      height: ICONSHEET_SIZE * 2,
      width: ICONSHEET_SIZE,
      x: ICONSHEET_SIZE * 0,
      y: ICONSHEET_SIZE * 0,
      sliceY: 2,
      anims: {
        toggle: {
          from: 0,
          to: 1
        }
      }
    },
    "icon-music": {
      height: ICONSHEET_SIZE * 2,
      width: ICONSHEET_SIZE,
      x: ICONSHEET_SIZE * 1,
      y: ICONSHEET_SIZE * 0,
      sliceY: 2,
      anims: {
        toggle: {
          from: 0,
          to: 1
        }
      }
    },
    "icon-pause": {
      height: ICONSHEET_SIZE * 2,
      width: ICONSHEET_SIZE,
      x: ICONSHEET_SIZE * 2,
      y: ICONSHEET_SIZE * 0,
      sliceY: 2,
      anims: {
        toggle: {
          from: 0,
          to: 1
        }
      }
    },
  });

  // sounds
  k.loadSound("hurt", "sfx/hitHurt.wav");
  k.loadSound("pickup", "sfx/pickupCoin.wav");
  k.loadSound("music", "music/Halloween Birthday.wav");

  // game configs
  k.setGravity(GAME_GRAVITY);
  k.debug.inspect = debug;
  
  // modules
  const microphone = await Microphone();

  k.scene("game", makeGameScene(k, microphone, debug));
  k.scene("start", makeStartScene(k, microphone, debug));
  k.scene("gameover", makeGameoverScene(k, microphone, debug));
  k.scene("win", makeWinScene(k, microphone, debug));

  k.go("game");
}

main({
  debug: true
});
