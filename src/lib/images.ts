import { BodyPart } from './types';

export const anatomyImages: Record<BodyPart | 'hero', ReturnType<typeof require>> = {
  chest:     require('../assets/anatomy/chest.png'),
  back:      require('../assets/anatomy/back.png'),
  legs:      require('../assets/anatomy/legs.png'),
  shoulders: require('../assets/anatomy/shoulders.png'),
  arms:      require('../assets/anatomy/arms.png'),
  abs:       require('../assets/anatomy/abs.png'),
  cardio:    require('../assets/anatomy/cardio.png'),
  hero:      require('../assets/anatomy/hero.png'),
};
