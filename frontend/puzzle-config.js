// PUBLIC PUZZLE CONFIGURATION
// This file is served to the client browser.
// NOTE: Contains ONLY puzzle geometry, clues, numbering, and word lengths.
// It contains ZERO answer strings, zero hashes, and zero obfuscated data.

const PUZZLE_CONFIG = {
  puzzleId: "cell-bio-crossword-2026",
  title: "Crossword Challenge",
  dimensions: {
    rows: 14,
    cols: 17
  },
  words: [
    {
      id: 1,
      num: 1,
      dir: "down",
      row: 4,
      col: 12,
      length: 10,
      clue: "The chemical responsible for that 11:55 PM typing speed when the assignment submission portal closes at midnight."
    },
    {
      id: 2,
      num: 2,
      dir: "down",
      row: 1,
      col: 10,
      length: 8,
      clue: "I am required in small quantities in the body, but I am essential.\nLike mineral water, I am essential for the body—but water and I were never meant to mix.\nI like those who carry more of what I seek, and I mix with them, unlike salt in mineral water.\nI do not build the weapon; I make certain weapons worthy of being armed."
    },
    {
      id: 3,
      num: 3,
      dir: "down",
      row: 0,
      col: 7,
      length: 6,
      clue: "I begin as a stranger to what I shall become.\nI disappear before revealing my final self.\nI carry my protection with me wherever I go,\nyet what protects me was born from something meant for another purpose.\nYou may found me in the our college campus a lot during monsoon\nEspecially in the washroom and the bathrooms and the wash basins\nMy family is so vast that even my relatives may look unrelated."
    },
    {
      id: 4,
      num: 4,
      dir: "across",
      row: 2,
      col: 6,
      length: 11,
      clue: "I begin where another ends, yet my purpose is never truly lost.\nI may borrow from what is living, or from what the world provides.\nI answer to no brain, yet I keep the machinery alive.\nI turn one form of energy into another, and my work keeps the system going.\nFind me twice.\nWe share the same destination,\nbut the road each of us travels runs in opposite directions.\nOne unlocks what has already been stored;\nthe other stores what has yet to be spent.\n(Part 1 of 2 — Unlocks what has already been stored)"
    },
    {
      id: 5,
      num: 5,
      dir: "across",
      row: 5,
      col: 6,
      length: 8,
      clue: "I am small, and I have the shape of the place where you have your daily meal. Yet, I play a crucial role in a process that keeps your body functioning normally. Without me, a serious health problem may arise, and it might change your choice of eating. Even that single piece offered in the mess may become something you have to think twice about. I am not an organ in the body ,but I am present in the body.What am I?"
    },
    {
      id: 6,
      num: 6,
      dir: "across",
      row: 11,
      col: 0,
      length: 14,
      clue: "I begin where another ends, yet my purpose is never truly lost.\nI may borrow from what is living, or from what the world provides.\nI answer to no brain, yet I keep the machinery alive.\nI turn one form of energy into another, and my work keeps the system going.\nFind me twice.\nWe share the same destination,\nbut the road each of us travels runs in opposite directions.\nOne unlocks what has already been stored;\nthe other stores what has yet to be spent.\n(Part 2 of 2 — Stores what has yet to be spent)"
    },
    {
      id: 7,
      num: 7,
      dir: "across",
      row: 13,
      col: 4,
      length: 12,
      clue: "A cable wears me in pieces. Between my pieces, something important happens that makes the signal appear to leap rather than travel. I do not carry the impulse, yet without me its journey becomes painfully inefficient. Identify me\n\nA biological wire where the signal behaves less like a wave travelling continuously and more like a traveller using only selected stations. The material between those stations is not the destination."
    }
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = PUZZLE_CONFIG;
}
