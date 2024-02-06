import kaboom from "kaboom";
import { Microphone } from "./microphone";

const GAME_HEIGHT = 600;
const GAME_WIDTH = 800;
const GAME_GRAVITY = 1600;
const GAME_BACKGROUND = [164, 209, 250];
const GAME_UPDATE_TIME = 1/30;
const FLOOR_SIZE = 100;
const MIC_LEVEL_1 = .15;
const MIC_LEVEL_2 = .4; // .85;
const PLAYER_JUMP_STRENGTH = 1000;
const PLAYER_SPEED = 600;
const PLAYER_START_POSITION = 100;

const main = async ({ debug = true }) => {
  const k = kaboom({
    height: GAME_HEIGHT,
    width: GAME_WIDTH,
    background: GAME_BACKGROUND
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
    k.body()
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

  k.loop(GAME_UPDATE_TIME, () => {
    const inputedVolume = microphone.getVolume();
    volume = k.lerp(volume, inputedVolume, GAME_UPDATE_TIME * 8);
    
    console.log(volume);

    // update volume display
    volumeDisplay.height = volume * 80;

    const walking = volume > MIC_LEVEL_1;
    const tryingToJump = volume > MIC_LEVEL_2;
    
    let targetX = PLAYER_START_POSITION;
    if (walking) {
      targetX = PLAYER_START_POSITION + volume * PLAYER_SPEED;
    }
    player.pos.x = k.lerp(player.pos.x, targetX, k.dt() / 2);
    
    if (tryingToJump && player.isGrounded()) {
      player.jump(PLAYER_JUMP_STRENGTH);
    }
  });
}  

main({
  debug: true
});
