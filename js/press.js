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
      `The piece left square ${from} and came to rest on square ${player.pos}, in the ${terrainName(sq).toLowerCase()}.`,
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
      ? `${players[0].name} Sets Out Alone on the Thirty-Square Course`
      : `${word(players.length)} Pieces Gather at the Starting Tower`;
  }

  function openingBody(players) {
    const names = players.map((p) => p.name);
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
    return `A new game opened this morning as ${list} took their places on square 0. ` +
      'The course runs thirty squares through meadow, desert, waters and lava fields before returning to the tower. ' +
      'The rules, sources say, are still being written.';
  }

  function titleCase(s) {
    return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return { word, turnHeadline, turnBody, openingHeadline, openingBody };
})();
