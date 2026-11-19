/**
 * Verified 2026/27 Premier League team directory snapshot.
 * Source: https://www.premierleague.com/en/clubs/1/manchester-united/squad
 * Checked on 2026-11-19. A seasonal snapshot, not a live transfer feed.
 */
export const REFERENCE_SOURCE = 'https://www.premierleague.com/en/clubs/1/manchester-united/squad';
export const REFERENCE_SEASON = '2026/27';
export const REFERENCE_CHECKED_AT = '2026-11-19';
const verified = [
  ['ผู้รักษาประตู', [[1,'Senne Lammens'],[12,'Karl Darlow'],[22,'Tom Heaton'],[45,'Dermot Mee']]],
  ['กองหลัง', [[2,'Diogo Dalot'],[3,'Noussair Mazraoui'],[4,'Matthijs de Ligt'],[5,'Harry Maguire'],[6,'Lisandro Martínez'],[13,'Patrick Dorgu'],[15,'Leny Yoro'],[23,'Luke Shaw'],[26,'Ayden Heaven'],[41,'Harry Amass'],[56,'Jaydan Kamason'],[57,'Daniel Armer']]],
  ['กองกลาง', [[7,'Mason Mount'],[8,'Bruno Fernandes'],[17,'Andrey Santos'],[18,'Youri Tielemans'],[20,'Carlos Baleba'],[25,'Manuel Ugarte'],[37,'Kobbie Mainoo'],[38,'Jack Fletcher'],[39,'Tyler Fletcher']]],
  ['กองหน้า', [[9,'Marcus Rashford'],[10,'Matheus Cunha'],[11,'Joshua Zirkzee'],[16,'Amad Diallo'],[19,'Bryan Mbeumo'],[27,'Tynan Thompson'],[30,'Benjamin Sesko'],[31,'Shea Lacey']]]
];
export const REFERENCE_PLAYERS = Object.freeze(verified.flatMap(([group, list]) =>
  list.map(([jersey, name]) => Object.freeze({
    id: 'pl-2026-' + jersey, name, jersey: String(jersey),
    position: group, group, headshot: null, nationality: null,
    appearances: null, goals: null, assists: null,
    profileUrl: REFERENCE_SOURCE, source: 'Premier League'
  }))
));
