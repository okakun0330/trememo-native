import { BodyPart } from './types';

export type RootStackParamList = {
  MainTabs: undefined;
  Select: undefined;
  Session: { bodyPart: BodyPart };
  Complete: { sets: number; duration: number };
};

export type TabParamList = {
  Home: undefined;
  History: { tab?: 'calendar' | 'history' | 'pbs' };
  Settings: undefined;
};
