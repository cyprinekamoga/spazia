import { townKey } from "./cities";

/**
 * Approximate town centres, for listings on the search map that have no
 * position of their own yet (latitude, longitude).
 */
const CENTRES: Record<string, [number, number]> = {
  stockholm: [59.33, 18.07],
  goteborg: [57.71, 11.97],
  malmo: [55.6, 13.0],
  uppsala: [59.86, 17.64],
  linkoping: [58.41, 15.62],
  orebro: [59.27, 15.21],
  vasteras: [59.61, 16.55],
  jonkoping: [57.78, 14.16],
  umea: [63.83, 20.26],
  lund: [55.7, 13.19],
  lulea: [65.58, 22.15],
  boden: [65.83, 21.69],
  pitea: [65.32, 21.48],
  skelleftea: [64.75, 20.95],
  kiruna: [67.86, 20.23],
  gallivare: [67.13, 20.66],
  ostersund: [63.18, 14.64],
  sundsvall: [62.39, 17.31],
  harnosand: [62.63, 17.94],
  ornskoldsvik: [63.29, 18.72],
  gavle: [60.67, 17.14],
  falun: [60.61, 15.63],
  borlange: [60.48, 15.44],
  karlstad: [59.38, 13.5],
  eskilstuna: [59.37, 16.51],
  nykoping: [58.75, 17.01],
  sodertalje: [59.2, 17.63],
  norrkoping: [58.59, 16.18],
  kalmar: [56.66, 16.36],
  vaxjo: [56.88, 14.81],
  karlskrona: [56.16, 15.59],
  kristianstad: [56.03, 14.16],
  helsingborg: [56.05, 12.69],
  halmstad: [56.67, 12.86],
  boras: [57.72, 12.94],
  trollhattan: [58.28, 12.29],
  uddevalla: [58.35, 11.94],
  skovde: [58.39, 13.85],
  visby: [57.64, 18.29],
};

export function townCentre(town: string): [number, number] | null {
  return CENTRES[townKey(town)] ?? null;
}
