import kaboom from "kaboom";
import { Microphone } from "./microphone";

const GAME_HEIGHT = 600;
const GAME_WIDTH = 800;
const GAME_GRAVITY = 1600;
const GAME_BACKGROUND = [164, 209, 250];
const GAME_FPS = 30;
const GAME_TICK = 1/GAME_FPS;
const FLOOR_SIZE = 100;
const MIC_LEVEL_1 = .15;
const MIC_LEVEL_2 = .6;
const PLAYER_JUMP_STRENGTH = 1000;
const PLAYER_MIN_POSITION = 100;
const PLAYER_MAX_POSITION = PLAYER_MIN_POSITION + 400;
const PLAYER_LERP_SPEED = GAME_TICK * 2;
const VOLUME_RAISE = GAME_TICK * 16;
const VOLUME_DECAY = GAME_TICK * 1;

const main = async ({ debug = true }) => {
  const k = kaboom({
    height: GAME_HEIGHT,
    width: GAME_WIDTH,
    background: GAME_BACKGROUND,
    maxFPS: GAME_FPS
  });
  
  // sprites
  k.loadSprite('bean', '/sprites/bean.png');

  // game configs
  k.setGravity(2400);
  k.debug.inspect = debug;
  
  // modules
  const microphone = await Microphone();
  
  // entities
  const floor = k.add([
    k.pos(0, k.height() - FLOOR_SIZE),
    k.rect(k.width(), FLOOR_SIZE),
    k.color(k.Color.BLACK),
    k.area(),
    k.body({
      isStatic: true
    })
  ])
  
  const player = k.add([
    k.sprite('bean'),
    k.pos(100, 100),
    k.area(),
    k.body({
      mass: .5
    })
  ]);

  const volumeDisplay = k.add([
    k.pos(k.width() - 12, k.height() - 10),
    k.rect(30, 80),
    k.anchor("botright"),
    k.color(k.Color.RED)
  ]);

  {
    // rulers
    const ruler3 = k.add([
      k.pos(k.width() - 10, k.height() - 10),
      k.rect(2, 80),
      k.anchor("botright"),
      k.color(k.Color.RED)
    ]);
  
    const ruler2 = k.add([
      k.pos(k.width() - 10, k.height() - 10),
      k.rect(2, 80 * MIC_LEVEL_2),
      k.anchor("botright"),
      k.color(k.Color.fromArray([255, 101, 0]))
    ]);
  
    const ruler1 = k.add([
      k.pos(k.width() - 10, k.height() - 10),
      k.rect(2, 80 * MIC_LEVEL_1),
      k.anchor("botright"),
      k.color(k.Color.YELLOW)
    ]);
  }

  let volume = 0;

  k.loop(GAME_TICK, () => {
    const from = volume;
    const to = microphone.getVolume();
    const speed = to > from ? VOLUME_RAISE : VOLUME_DECAY;

    volume = k.lerp(from, to, speed);

    // update volume display
    volumeDisplay.height = volume * 80;

    const walking = volume > MIC_LEVEL_1;
    const tryingToJump = volume > MIC_LEVEL_2;
    
    const targetX = walking ? PLAYER_MAX_POSITION : PLAYER_MIN_POSITION;
    player.pos.x = k.lerp(player.pos.x, targetX, PLAYER_LERP_SPEED);
    
    if (tryingToJump && player.isGrounded()) {
      player.jump(PLAYER_JUMP_STRENGTH);
    }
  });
}  

main({
  debug: true
});
