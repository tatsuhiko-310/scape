// 手番の結果を新聞記事の見出しと本文にする「記者」。
// 文面を増やしたいときはここの言い回しを足していく。

const Press = (() => {
  const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen'];
  const word = (n) => WORDS[n] || String(n);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const terrainName = (sq) => (CONFIG.terrains[sq.terrain] || {}).label || 'the open board';

  function turnHeadline(player, total, sq) {
    const n = word(total);
    const place = `the ${sq.name ? titleCase(sq.name) : terrainName(sq)}`;
    if (total >= 6 && total % 6 === 0) return pick([
      `${player.name} Strikes ${n}, Crowd Erupts`,
      `A Perfect ${n} for ${player.name}`,
    ]);
    if (total === 1) return pick([
      `${player.name} Inches Forward a Single Square`,
      `Only One for ${player.name}; Critics Unmoved`,
    ]);
    return pick([
      `${player.name} Rolls ${n}, Advances Into ${place}`,
      `${n} Squares Later, ${player.name} Arrives at ${place}`,
      `${player.name} Marches ${n} Across ${place}`,
      `Die Reads ${n}; ${player.name} on the Move`,
    ]);
  }

  function turnBody(player, total, from, sq, notes) {
    const mood = pick(['a bold', 'a measured', 'an unhurried', 'a decisive', 'a curious', 'a quietly confident']);
    const lines = [
      `In what onlookers described as ${mood} turn, ${player.name} cast the die, which came up ${word(total).toLowerCase()}.`,
      `The piece left square ${from} and came to rest on square ${player.pos}, ${sq.terrain === 'road' ? 'on' : 'at'} the ${terrainName(sq).toLowerCase()}.`,
    ];
    lines.push(...notes);
    lines.push(pick([
      'Further developments are expected next turn.',
      'Our correspondent will continue to follow the story.',
      'The rest of the field is said to be watching closely.',
    ]));
    return lines.join(' ');
  }

  function openingHeadline(players) {
    return players.length === 1
      ? `${players[0].name} Sets Out Alone on the Road`
      : `${word(players.length)} Pieces Gather at the Starting Point`;
  }

  function openingBody(players) {
    const names = players.map((p) => p.name);
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    return `A new game opened this morning as ${list} took their places on square 0. ` +
      `The course runs ${MAP.tiles.length} squares of road between ${joinList(MAP.areas.filter((a) => a.terrain !== 'road').map((a) => a.label.replace(/^The /, 'the ')))}. ` +
      'The rules, sources say, are still being written.';
  }

  // ロケーション欄
  const TERRAIN_NOTES = {
    road: 'Open road. Craters every few yards and nowhere to hide.',
    factory: 'The works yard of the old factory. Rusted plate underfoot and a chimney still standing.',
    mall: 'The shopping mall, looted bare. Glass crunches on the tiled floor.',
    outpost: 'A sandbagged outpost. The flag is still up, the garrison is not.',
    hospital: 'The hospital grounds. The red cross on the roof has faded to grey.',
  };

  function placeTitle(pos, sq) {
    return `Square ${pos} — ${sq.name ? titleCase(sq.name) : `The ${terrainName(sq)}`}`;
  }

  function locationNote(player, sq, others, exits, area) {
    const lines = [TERRAIN_NOTES[sq.terrain] || ''];
    if (exits > 2) lines.push(`The road divides here into ${word(exits).toLowerCase()} ways.`);
    if (sq.icon) lines.push(`A mark reading "${sq.icon}" has been chalked on the ground.`);
    if (others.length) lines.push(`Also here: ${others.map((p) => p.name).join(', ')}.`);
    return lines.filter(Boolean).join(' ');
  }


  function joinList(names) {
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] || '';
  }

  function titleCase(s) {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return { word, turnHeadline, turnBody, openingHeadline, openingBody, placeTitle, locationNote };
})();
