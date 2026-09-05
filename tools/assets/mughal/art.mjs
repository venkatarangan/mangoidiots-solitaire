import { suitShape } from "../art.mjs";

const GOLD = "#b38a38";
const INK = "#172d51";
const RED = "#ae2847";
const SUITS = [
  { name: "spades", ink: INK, color: "#25477a", light: "#8aa7cd", dark: "#142a50", gem: "#45babe" },
  { name: "hearts", ink: RED, color: "#218b8e", light: "#95d6cb", dark: "#16585e", gem: "#d95f79" },
  { name: "clubs", ink: INK, color: "#287858", light: "#8cc6a0", dark: "#134739", gem: "#dcbd64" },
  { name: "diamonds", ink: RED, color: "#965567", light: "#dbadab", dark: "#582e4e", gem: "#66c6c0" },
];
const path = (d, fill, attrs = "") => `<path d="${d}" fill="${fill}" ${attrs}/>`;
const circle = (x, y, r, fill, attrs = "") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${attrs}/>`;
const line = (d, color, width = 1, attrs = "") => path(d, "none", `stroke="${color}" stroke-width="${width}" ${attrs}`);

function blossom(x, y, size = 7, color = "#b34b64") {
  return `<g transform="translate(${x} ${y}) scale(${size / 10})">` +
    Array.from({ length: 5 }, (_, i) => `<g transform="rotate(${i * 72})">${path("M0 1C-11-1-9-13-2-10C1-15 9-8 5-3Z", color, 'stroke="#f9e6bc" stroke-width=".7"')}</g>`).join("") +
    circle(0, 0, 3, "#e7c970") + circle(-.6, -.6, .8, "#fff8dd") + "</g>";
}

function sprig(x, y, size = 1, color = "#b45e70", flip = false) {
  return `<g transform="translate(${x} ${y}) scale(${flip ? -size : size} ${size})">
    ${line("M0 21Q-3 0 2-20M-1 10L-12 0M0 0L12-10", "#467d6d", 1.5)}
    ${path("M-2 10Q-19 10-17-1Q-4-1-2 10ZM1 1Q19-1 17-11Q4-12 1 1Z", "#548b73", 'stroke="#2b655c" stroke-width=".5"')}
    ${path("M-6 21Q-17 17-16 10Q-4 11-6 21Z", "#75a58c")}
    ${blossom(2, -20, 7, color)}
  </g>`;
}

function star(x, y, radius, fill, stroke = GOLD) {
  const points = Array.from({ length: 16 }, (_, i) => {
    const angle = i * Math.PI / 8 - Math.PI / 2;
    const r = i % 2 ? radius * .58 : radius;
    return `${(x + Math.cos(angle) * r).toFixed(2)},${(y + Math.sin(angle) * r).toFixed(2)}`;
  }).join(" ");
  return `<polygon points="${points}" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;
}

function cypress(x, y, size = 1, color = "#356b5c") {
  return `<g transform="translate(${x} ${y}) scale(${size})">
    ${path("M0-56Q-3-39-12-23Q-23-3-3 1L3 1Q22-3 12-23Q3-40 0-56Z", color)}
    ${line("M0-43V8M0-16L-8-24M0-25L6-34", "#c1d5aa", 1, 'opacity=".35"')}
  </g>`;
}

function pavilion(x, y, size = 1, color = "#ede4c7") {
  return `<g transform="translate(${x} ${y}) scale(${size})" fill="${color}">
    <path d="M-42 0V-9H-35V-43H-42V-49H42V-43H35V-9H42V0Z"/>
    <path d="M-26-52Q-33-67-17-76Q-3-81 0-91Q4-80 18-76Q32-66 26-52Z"/>
    <path d="M-48-50H48V-45H-48Z"/><path d="M-49-50L-40-57L-31-50ZM31-50L40-57L49-50Z"/>
    ${line("M0-98V-89", GOLD, 2)}
    ${[-24, 0, 24].map(cx => path(`M${cx - 8}-9V-29Q${cx - 8}-39 ${cx}-42Q${cx + 8}-39 ${cx + 8}-29V-9Z`, "#3b7880")).join("")}
    ${line("M-37-6H37M-30-46H30", GOLD, 1)}
  </g>`;
}

function defs(s) {
  return `<defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffdf5"/><stop offset=".58" stop-color="#f9f4e6"/><stop offset="1" stop-color="#e7e1ce"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#f7dea0"/><stop offset=".35" stop-color="#cda754"/><stop offset=".66" stop-color="#a78036"/><stop offset="1" stop-color="#ead193"/></linearGradient>
    <linearGradient id="satin" x1="0" y1="0" x2="1" y2=".25"><stop stop-color="${s.dark}"/><stop offset=".35" stop-color="${s.light}"/><stop offset=".62" stop-color="${s.color}"/><stop offset="1" stop-color="${s.dark}"/></linearGradient>
    <linearGradient id="ivory" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="#cdc6af"/><stop offset=".35" stop-color="#fff6d8"/><stop offset=".58" stop-color="#f2e7c6"/><stop offset="1" stop-color="#c9bc98"/></linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="1" y2=".15"><stop stop-color="#ad724d"/><stop offset=".42" stop-color="#e4b887"/><stop offset=".78" stop-color="#d79b6b"/><stop offset="1" stop-color="#b47b55"/></linearGradient>
    <linearGradient id="garden" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b9d9d2"/><stop offset=".48" stop-color="#e3e8ca"/><stop offset="1" stop-color="#76a388"/></linearGradient>
    <radialGradient id="aureole"><stop stop-color="#fff6cd"/><stop offset=".72" stop-color="#f1d895" stop-opacity=".42"/><stop offset="1" stop-color="#f5dd9a" stop-opacity="0"/></radialGradient>
  </defs>`;
}

function niche(s) {
  return `<rect x="48" y="46" width="144" height="245" rx="3" fill="#e8e4d3" stroke="#c1a160" stroke-width="1"/>
    <path d="M57 280V111Q52 101 62 96Q56 83 70 79Q69 65 87 66Q89 53 103 59Q112 52 120 45Q128 52 137 59Q151 53 153 66Q171 65 170 79Q184 83 178 96Q188 101 183 111V280Z" fill="url(#garden)" stroke="url(#gold)" stroke-width="2"/>
    <g opacity=".47">${pavilion(155, 186, .45)}${cypress(74, 225, .92)}${cypress(170, 235, .9)}${cypress(92, 192, .49)}</g>
    <path d="M117 188L105 281H140L128 188Z" fill="#8dc8c5" opacity=".55"/>
    ${line("M61 244H182M60 261H183M121 189V279", "#e7ead1", 2, 'opacity=".75"')}
    ${circle(123, 120, 46, "url(#aureole)")}
    ${[52, 188].map(x => `<path d="M${x - 2} 123V280H${x + 2}V123Z" fill="url(#ivory)" stroke="#c7b17f" stroke-width=".6"/>
      ${sprig(x, 162, .23, s.color)}${sprig(x, 218, .23, s.color)}`).join("")}
    ${line("M54 283H186M54 286H186", "#b3a17a", .8)}`;
}

function turban(s, rank, variant) {
  const king = rank === 13;
  const fill = king ? "url(#ivory)" : "url(#satin)";
  const shapes = [
    "M100 115Q94 102 102 93Q111 83 128 91Q146 85 151 103L148 116Z",
    "M98 115Q90 101 104 94Q101 85 120 86Q139 83 148 96Q156 105 146 115Z",
    "M100 116Q90 106 100 96Q108 85 128 86Q145 89 149 105L147 117Z",
    "M99 115Q93 97 111 92L125 82L140 92Q153 103 147 118Z",
  ];
  return `${king ? path("M105 105Q91 125 97 158L107 162L111 112Z", "url(#ivory)", `stroke="${s.color}" stroke-width="1"`) : ""}
    ${path(shapes[variant], fill, 'stroke="#806c50" stroke-width=".9"')}
    ${line("M99 107Q120 103 139 91M101 114Q126 108 146 99M110 94Q126 96 149 109", king ? "#b6a889" : s.light, 1.6)}
    ${path("M100 115Q122 107 148 111L148 116Q119 113 103 120Z", king ? s.color : "#e6cd90")}
    ${king
      ? `${path(`M${132 + variant} 99Q${145 + variant} 77 ${137 + variant} 63Q${129 + variant} 62 ${130 + variant} 78Q124 90 ${132 + variant} 99Z`, "#f8f2da", 'stroke="#c2b58f" stroke-width=".65"')}
         ${line(`M${132 + variant} 101Q${136 + variant} 75 ${137 + variant} 64`, "#b7ac89", .7)}`
      : `${path("M139 98Q146 82 154 86Q154 97 140 105Z", s.gem, 'stroke="#e7d192" stroke-width=".6"')}`}
    ${path("M132 103L138 99L143 105L139 114L133 112Z", "url(#gold)")}
    ${circle(138, 107, 2.6, s.gem)}
    ${line("M103 119Q119 129 133 113", "#f7e5b4", 1.5)}
    ${[107, 113, 119, 125].map((x, i) => circle(x, 120 + [0, 1, 0, -3][i], 1.1, "#fff7d9")).join("")}`;
}

function head(s, rank, variant) {
  const queen = rank === 12;
  const beard = rank === 13 ? [
    "M111 137Q119 146 129 145L141 137Q141 160 127 166Q111 159 108 145Z",
    "M111 140Q122 147 139 138Q139 159 126 161Q111 158 111 140Z",
    "M111 138Q122 148 142 137L137 158L126 168L114 155Z",
    "M111 138Q121 146 141 138Q139 157 132 161L126 157L121 163Q109 155 111 138Z",
  ][variant] : "";
  return `${queen ? path("M99 115Q96 87 120 88Q150 84 151 117L154 159L100 168Z", "#373432") :
      path("M105 111Q116 99 139 111L143 128L112 145Z", "#393733")}
    ${path("M114 141V158L104 166Q121 182 143 161L132 155L134 139Z", "url(#skin)", 'stroke="#996d4f" stroke-width=".6"')}
    ${path("M109 112Q122 99 139 110Q145 116 141 126L147 132L141 136Q142 143 135 148Q123 155 114 145L107 130Z", "url(#skin)", 'stroke="#927157" stroke-width=".8"')}
    ${circle(108, 131, 5, "url(#skin)", 'stroke="#a77651" stroke-width=".7"')}
    ${line("M126 120Q133 116 139 119", "#443431", 1.5)}
    ${path("M126 124Q132 120 138 124Q132 127 126 124Z", "#fff6de")}
    ${circle(133, 124, 1.8, "#253438")}${circle(133.5, 123.5, .5, "#fffbed")}
    ${line("M140 124L138 134L142 134", "#a77755", .8)}
    ${line("M133 140Q137 138 140 139", "#9a534b", 1)}
    ${queen ? circle(141, 135, 2.4, "none", 'stroke="#e8c976" stroke-width="1.2"') : ""}
    ${beard ? path(beard, variant === 2 ? "#645548" : "#3b3532", 'stroke="#514237" stroke-width=".5"') : ""}
    ${!queen ? path("M124 137Q133 134 141 138Q136 142 131 138Q123 142 120 139Z", "#37312c") : ""}
    ${queen ? `${circle(108, 140, 4, "url(#gold)")}${circle(108, 147, 2.4, "#fff0ba")}
      ${path("M95 113Q93 88 114 85Q135 78 148 99Q148 117 153 139L166 179L155 206Q143 174 139 150L143 108Q130 92 111 103L106 137L108 167L98 184Q91 149 95 113Z", "url(#satin)", 'opacity=".85" stroke="#dec78c" stroke-width="1.4"')}
      ${line("M101 132L106 102Q128 86 143 105L145 131M104 145L103 164", "#f3dc9c", 1.4)}
      ${path("M121 98L124 112L128 98Z", "url(#gold)")}${circle(124, 111, 2.2, s.gem)}
      ${[109, 117, 132, 139].map((x, i) => circle(x, [103, 100, 100, 104][i], 1.4, "#ffefc5")).join("")}` :
      turban(s, rank, variant)}`;
}

function clothing(s, rank, variant) {
  const queen = rank === 12;
  const fill = rank === 13 ? "url(#ivory)" : "url(#satin)";
  return `${path("M99 254L96 272L102 278L112 271L117 255ZM127 256L130 272L141 277L147 272L142 253Z", "url(#ivory)", 'stroke="#a39676" stroke-width=".8"')}
    ${path("M95 271Q101 274 108 271L108 279L87 279Q85 275 95 271ZM137 271Q146 274 155 270Q157 276 150 278H133V273Z", s.color, 'stroke="#a37e37" stroke-width=".8"')}
    ${path(queen ? "M108 160Q119 168 138 159L146 184L141 199Q148 221 162 263Q128 277 77 264L93 201L91 180Z" :
      "M107 155Q124 167 140 156L151 178L145 204L160 259Q122 273 80 260L94 202L88 181Z", fill, 'stroke="#7c7361" stroke-width=".8"')}
    ${queen ? `${path("M107 162L98 198Q120 211 143 199L138 161Q123 168 107 162Z", "url(#satin)")}
      ${path("M98 195Q123 206 142 195L143 202Q121 212 96 202Z", "url(#gold)")}
      ${line("M97 208Q89 242 88 263M109 211L106 269M121 212L124 270M135 208L146 266", s.dark, 1.3, 'opacity=".5"')}
      ${path("M106 160Q115 184 147 204L157 246L147 251Q140 217 126 211L95 181Z", "#ede4c3", `opacity=".75" stroke="${s.color}" stroke-width="1"`)}`
      : `${line("M110 159L137 186L122 205M110 165L129 186L116 199", rank === 13 ? s.color : "#e2c689", 1.8)}
      ${path("M94 199Q120 207 145 198L146 207Q122 216 92 207Z", rank === 13 ? s.color : "url(#gold)")}
      ${path("M133 205L140 207L152 252L143 257L132 221L120 248L113 245Z", rank === 13 ? s.color : "#d9bd77", `stroke="${s.dark}" stroke-width=".7"`)}
      ${line("M96 216L89 257M110 216L107 264M129 226L130 265M142 223L152 259", "#9a947b", 1, 'opacity=".6"')}`}
    ${path("M81 256Q123 271 159 255L161 261Q121 278 78 263Z", "url(#gold)", 'stroke="#ad873e" stroke-width=".7"')}
    ${[94, 111, 131, 148].map((x, i) => sprig(x, 233 + (i % 2) * 10, .25, rank === 13 ? s.color : "#e7c989", i % 2 === 0)).join("")}
    ${[101, 109, 118, 128, 137].map((x, i) => circle(x, [166, 174, 178, 173, 164][i], 1.6, "#fff1c5", 'stroke="#b89953" stroke-width=".4"')).join("")}
    ${line("M101 165Q114 195 141 166", "#d6b267", 1.7)}
    ${circle(119, 183, 3.8, "url(#gold)")}${circle(119, 183, 1.8, s.gem)}`;
}

function arms(s, rank) {
  const fabric = rank === 13 ? "url(#ivory)" : "url(#satin)";
  return `${path("M100 163Q82 168 82 191L93 214L109 211L105 201L96 188L106 176Z", fabric, 'stroke="#938063" stroke-width=".8"')}
    ${path("M139 162Q151 164 151 181L147 201L160 196L164 204L144 213Q137 213 136 204L138 182Z", fabric, 'stroke="#938063" stroke-width=".8"')}
    ${path("M93 207L106 203L110 210L97 216ZM150 197L160 193L165 202L155 207Z", "url(#gold)")}
    ${path("M102 208L117 203Q124 198 128 202L122 208L130 209Q131 213 124 214L109 215Z", "url(#skin)", 'stroke="#a87852" stroke-width=".6"')}
    ${path("M157 195L166 185Q170 180 173 184L169 191L173 197Q172 201 166 200L161 203Z", "url(#skin)", 'stroke="#a87852" stroke-width=".6"')}`;
}

function objects(s, rank, variant) {
  if (rank === 13) {
    const held = [
      `${pavilion(121, 204, .24, "#fff0ca")}${path("M105 207H136L132 212H108Z", "url(#gold)")}`,
      `${line("M167 188L161 156", "#537952", 1.6)}${sprig(162, 172, .44, "#b94361")}`,
      `${path("M105 191L132 188L135 206L108 209Z", "#f8e7b8", 'stroke="#ae8745" stroke-width="1"')}
        ${line("M111 195L128 193M112 199L128 197M113 203L126 201", "#a88c5e", .8)}`,
      `${circle(123, 198, 11, "#6caab4", 'stroke="url(#gold)" stroke-width="1.5"')}
        ${line("M113 195Q124 203 133 194M120 188Q113 200 127 208M117 188Q132 197 124 208", "#efe2ab", .9)}
        ${path("M120 208V214H127V211L125 208Z", "url(#gold)")}`,
    ][variant];
    return `${held}${variant === 1 ? "" : `${line("M168 194V160", "#b68a3c", 2)}${circle(168, 158, 4, "url(#gold)")}${circle(168, 158, 1.7, s.gem)}`}`;
  }
  if (rank === 12) {
    return [
      `${sprig(162, 173, .65, "#c34e72")}${line("M162 181L166 196", "#527f5e", 1.5)}`,
      `<g transform="rotate(-22 130 211)">${path("M112 200Q91 193 93 215Q96 235 113 228Q123 224 123 217L167 207L164 200L122 207Z", "#b68143", 'stroke="#6c593f" stroke-width="1.2"')}
        ${path("M109 201Q91 202 98 220Q101 229 112 224Z", "#e4c68c")}
        ${circle(110, 212, 4, "#624a33")}${line("M104 210L164 202M104 213L165 205M104 216L166 207", "#fae7b6", .7)}
        ${path("M165 201L173 197L176 202L168 209Z", "#4b544d")}
        ${[171, 174].map((x,i) => circle(x, 196 + i * 3, 2, "#d1b474")).join("")}</g>`,
      `${path("M103 195L120 192L132 196L135 214L119 210L105 214Z", "#f9eecd", 'stroke="#a18453" stroke-width="1.1"')}
        ${line("M120 193L119 209M107 201L116 198M108 205L116 202M124 200L129 202M123 204L130 206", "#b7a77e", .8)}`,
      `${path("M156 181Q162 185 169 180L167 189Q179 207 162 210Q150 205 158 190Z", "#66a6ad", 'stroke="#245d77" stroke-width="1"')}
        ${line("M154 201Q162 196 171 201", "#f5e3ac", 2)}${sprig(161, 176, .53, "#c6818d")}`,
    ][variant];
  }
  return [
    `${path("M157 185L169 187L169 196L154 199Z", "#b48149", 'stroke="#765b3a" stroke-width="1"')}
      ${path("M155 183Q155 171 162 167Q158 160 162 153Q167 147 174 153L176 159L181 162L174 164Q176 178 168 188L159 189L151 204L146 203Z", "#846344", 'stroke="#534735" stroke-width=".9"')}
      ${path("M162 166Q168 171 162 184L154 194L157 179Z", "#d4b789")}${circle(172, 157, 1.2, "#122d32")}
      ${line("M166 187L165 193M170 187L169 193", "#c49c59", 1.2)}`,
    `${line("M165 158L166 258", "#806643", 2.8)}${path("M160 249L170 249L175 261Q166 270 157 261Z", "#a4b8ac", 'stroke="#637b76" stroke-width="1"')}
      ${path("M111 198Q108 189 116 187Q121 187 126 193L126 211L108 210Z", "#cba15d", 'stroke="#8d703e" stroke-width="1"')}
      ${path("M125 195L137 190L134 200L126 204Z", "#cba15d")}${line("M113 186Q106 188 109 199", "#8d703e", 2)}`,
    `${path("M105 193L133 190L140 218L111 221Z", "#e6d3a6", 'stroke="#856d48" stroke-width="1.2"')}
      ${sprig(121, 207, .36, "#ad596b")}${line("M167 185L147 213", "#6b5540", 1.6)}
      ${path("M150 210L147 217L145 214Z", "#376c77")}`,
    `${path("M105 197L133 195L136 215L108 218Z", "#eee0b8", 'stroke="#99804d" stroke-width="1"')}
      ${line("M111 202L130 200M112 207L128 205M113 212L131 210", "#9b906f", .8)}
      ${line("M168 185L151 211", "#71563a", 1.7)}${path("M169 184Q174 173 177 176L172 185Z", "#f4eacc", 'stroke="#baa570" stroke-width=".6"')}
      ${path("M126 217H137V224H126Z", "#35476a", 'stroke="#c4a55e" stroke-width=".6"')}`,
  ][variant];
}

export const COURT_LABELS = [
  ["ROYAL FALCONER", "ROSE GARDEN", "GARDEN PATRON"],
  ["GARDEN STEWARD", "COURT MELODY", "GARDEN AUDIENCE"],
  ["COURT PAINTER", "COURT LETTERS", "COURT COUNSEL"],
  ["COURT SCRIBE", "FLORAL ARTS", "WORLDLY CURIOSITY"],
];

function court(suit, rank) {
  const s = SUITS[suit];
  return `${niche(s)}${clothing(s, rank, suit)}${arms(s, rank)}${head(s, rank, suit)}${objects(s, rank, suit)}
    <rect x="52" y="291" width="136" height="16" fill="#f1ead6" stroke="#c7af77" stroke-width=".65"/>
    <text x="120" y="302" text-anchor="middle" fill="#675239" font-family="Georgia,serif" font-size="8.1" font-weight="bold" letter-spacing=".65">${COURT_LABELS[suit][rank - 11]}</text>`;
}

const PIPS = {
  2: [[120,84],[120,252]],
  3: [[120,80],[120,168],[120,256]],
  4: [[81,84],[159,84],[81,252],[159,252]],
  5: [[81,84],[159,84],[120,168],[81,252],[159,252]],
  6: [[81,80],[159,80],[81,168],[159,168],[81,256],[159,256]],
  7: [[81,79],[159,79],[120,123],[81,168],[159,168],[81,257],[159,257]],
  8: [[81,79],[159,79],[120,123],[81,168],[159,168],[120,213],[81,257],[159,257]],
  9: [[81,77],[159,77],[81,137],[159,137],[120,168],[81,199],[159,199],[81,259],[159,259]],
  10: [[81,75],[159,75],[120,104],[81,137],[159,137],[81,199],[159,199],[120,232],[81,261],[159,261]],
};

export function cardSvg(card) {
  const suit = Math.floor(card / 13);
  const rank = card % 13 + 1;
  const s = SUITS[suit];
  const label = ({ 1: "A", 11: "J", 12: "Q", 13: "K" })[rank] ?? String(rank);
  const index = `<text x="28" y="39" text-anchor="middle" fill="${s.ink}" font-family="Georgia,serif" font-size="${rank === 10 ? 30 : 37}" font-weight="bold">${label}</text>${suitShape(suit, 28, 57, 24, s.ink)}`;
  const center = rank >= 11 ? court(suit, rank) : rank === 1
    ? `${star(120, 165, 78, "#e4eee5")}${star(120, 165, 65, "#f8f1db", "#c2aa70")}
       ${circle(120, 165, 39, "#fffaf0", 'stroke="#b89b58" stroke-width="1.2"')}
       ${suitShape(suit, 120, 164, 60, s.ink)}
       ${sprig(78, 244, .57, s.color, true)}${sprig(162, 244, .57, s.color)}
       <text x="120" y="291" text-anchor="middle" fill="#8b774d" font-family="Georgia,serif" font-size="10" letter-spacing="1.5">MUGHAL GARDENS</text>`
    : `${line("M64 58H176M64 278H176", "#d4c195", .8)}
       ${PIPS[rank].map(([x,y]) => suitShape(suit, x, y, rank >= 9 ? 32 : 36, s.ink, y > 168 ? 180 : 0)).join("")}
       ${sprig(120, 302, .29, s.color)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="336" viewBox="0 0 240 336" role="img" aria-label="${label} of ${s.name}; original Mughal-inspired garden court">
    <title>${label} of ${s.name}</title>${defs(s)}
    <rect x="1" y="1" width="238" height="334" rx="10" fill="url(#paper)" stroke="#b8a57a" stroke-width="2"/>
    <rect x="6" y="6" width="228" height="324" rx="7" fill="none" stroke="#d0bc88" stroke-width=".7"/>
    ${line("M49 12H191M49 324H191", "#b6a579", .8)}
    ${center}${index}<g transform="rotate(180 120 168)">${index}</g>
  </svg>`;
}

export function backSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="336" viewBox="0 0 240 336" role="img" aria-label="Lapis and ivory floral-inlay garden card back">
    <title>Mughal Gardens floral-inlay back</title>${defs(SUITS[0])}
    <rect x="1" y="1" width="238" height="334" rx="10" fill="url(#paper)" stroke="#b8a57a" stroke-width="2"/>
    <rect x="8" y="8" width="224" height="320" rx="6" fill="#1a345d" stroke="url(#gold)" stroke-width="1.5"/>
    <rect x="20" y="20" width="200" height="296" rx="3" fill="#f3ecd6" stroke="#d5b973" stroke-width="2"/>
    <rect x="34" y="34" width="172" height="268" fill="#256c78" stroke="#b89447" stroke-width="1"/>
    ${[47,193].map(x => [69,126,210,267].map(y => sprig(x, y, .4, "#dac18a", x===47)).join("")).join("")}
    <path d="M120 41L161 83L161 125L203 168L161 211V253L120 295L79 253V211L37 168L79 125V83Z" fill="#1b355c" stroke="url(#gold)" stroke-width="2"/>
    ${star(120, 168, 79, "#ede8d3")}${star(120, 168, 66, "#367f86")}
    ${star(120, 168, 51, "#17355d")}${circle(120, 168, 29, "#f4ebd1", 'stroke="url(#gold)" stroke-width="2"')}
    ${sprig(120, 167, .75, "#a9536b")}
    ${[59,277].map(y => blossom(120, y, 10, "#7ebeb0")).join("")}
    ${[[30,30],[210,30],[30,306],[210,306]].map(([x,y])=>blossom(x,y,5,"#a8546b")).join("")}
    ${[75,120,165].map(x => `${blossom(x,26,4,"#588e83")}${blossom(x,310,4,"#588e83")}`).join("")}
  </svg>`;
}

export function backgroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="Quiet lapis garden table with charbagh water channels and floral-inlay borders">
    <title>Garden at blue hour</title>
    <defs><radialGradient id="table" cx=".48" cy=".3" r=".88"><stop stop-color="#254d68"/><stop offset=".55" stop-color="#173b53"/><stop offset="1" stop-color="#102637"/></radialGradient></defs>
    <rect width="1600" height="1000" fill="url(#table)"/>
    <rect x="20" y="20" width="1560" height="960" rx="12" fill="none" stroke="#d2bd82" stroke-width="1.5" opacity=".22"/>
    <rect x="28" y="28" width="1544" height="944" rx="8" fill="none" stroke="#82b9ae" stroke-width="1" opacity=".17"/>
    <g opacity=".055">
      <path d="M797 675V972H831V675ZM548 835H1080V867H548Z" fill="#9ed7ce"/>
      <rect x="583" y="713" width="183" height="98" rx="20" fill="#74a889"/><rect x="860" y="713" width="183" height="98" rx="20" fill="#74a889"/>
      <rect x="583" y="890" width="183" height="75" rx="20" fill="#74a889"/><rect x="860" y="890" width="183" height="75" rx="20" fill="#74a889"/>
      ${circle(814, 851, 51, "none", 'stroke="#e6dbc1" stroke-width="10"')}${circle(814, 851, 31, "#87c6c4")}
      ${pavilion(1390, 964, 2.5)}${cypress(1190, 967, 3.6, "#b4c9a7")}${cypress(1527, 963, 2.5, "#b4c9a7")}
    </g>
    <g opacity=".19">${[69,1531].map(x => [89,913].map(y=>sprig(x,y,1.32,"#bea979",x===69)).join("")).join("")}</g>
    <g opacity=".12">${star(800,40,15,"#356674")}${star(800,960,15,"#356674")}</g>
    ${line("M116 41H743M857 41H1484M116 959H743M857 959H1484", "#d5c18a", 1, 'opacity=".16"')}
  </svg>`;
}
