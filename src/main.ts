import kaboom from "kaboom";
import { Microphone } from "./microphone";

const GAME_HEIGHT = 600;
const GAME_WIDTH = 800;
const GAME_GRAVITY = 1600;
const GAME_BACKGROUND = [164, 209, 250];
const FLOOR_SIZE = 100;

const main = async ({ debug = true }) => {
  const k = kaboom({
    height: GAME_HEIGHT,
    width: GAME_WIDTH,
    background: GAME_BACKGROUND
  });
  
  k.debug.inspect = debug;
  
  k.loadSprite('bean', '/sprites/bean.png');
  
  k.setGravity(2400);
  
  k.add([
    k.pos(0, GAME_HEIGHT - FLOOR_SIZE),
    k.rect(GAME_WIDTH, FLOOR_SIZE),
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

  const microphone = await Microphone();

  k.loop(1/30, () => {
    console.log(microphone.getLevel());
  });
}  

main({
  debug: true
});
