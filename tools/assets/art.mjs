const GOLD = "#bd8b32";
const INK = "#182d34";
const RUBY = "#b3233d";
const suits = [
  { name: "spades", ink: INK, jewel: "#197380", light: "#68bcc0", dark: "#12404e", gem: "#44c5be" },
  { name: "hearts", ink: RUBY, jewel: "#9e294b", light: "#e57080", dark: "#531d3a", gem: "#f284a2" },
  { name: "clubs", ink: INK, jewel: "#237653", light: "#76b77a", dark: "#123d38", gem: "#69ce91" },
  { name: "diamonds", ink: RUBY, jewel: "#624794", light: "#b29ace", dark: "#352c63", gem: "#87ceea" },
];

const xml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const circle = (x, y, r, fill, extra = "") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const line = (x1, y1, x2, y2, stroke, width = 1, extra = "") =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
const path = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
const pearls = (cx, cy, rx, ry, start = 0, end = Math.PI, count = 13) =>
  Array.from({ length: count }, (_, i) => {
    const angle = start + (end - start) * i / (count - 1);
    return circle((cx + Math.cos(angle) * rx).toFixed(2), (cy + Math.sin(angle) * ry).toFixed(2), 1.8, "#f6dea0");
  }).join("");

export function suitShape(suit, x, y, size, color, rotate = 0) {
  const d = [
    "M0-17C-6-9-17-4-17 5C-17 15-5 18 0 9C5 18 17 15 17 5C17-4 6-9 0-17ZM-3 8L-7 21H7L3 8Z",
    "M0 18C-5 12-18 3-18-6C-18-18-4-20 0-10C4-20 18-18 18-6C18 3 5 12 0 18Z",
    "M0-19C-13-19-13-4-5-1C-19-9-24 11-12 14C-7 16-2 12 0 8C2 12 7 16 12 14C24 11 19-9 5-1C13-4 13-19 0-19ZM-3 6L-7 21H7L3 6Z",
    "M0-21L16 0L0 21L-16 0Z",
  ][suit];
  return `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${size / 42})">${path(d, color)}</g>`;
}

function lotus(x, y, size, petal = "#d6ae57", center = "#f6df9d") {
  return `<g transform="translate(${x} ${y}) scale(${size / 40})">
    ${path("M0 13C-16 12-24-1-21-13C-10-10-3-4 0 13Z", petal)}
    ${path("M0 13C16 12 24-1 21-13C10-10 3-4 0 13Z", petal)}
    ${path("M0 13C-10 4-12-12 0-24C12-12 10 4 0 13Z", center)}
    ${path("M-25 3Q0 23 25 3Q16 24 0 23Q-16 24-25 3Z", petal)}
    ${line(-17, 27, 17, 27, center, 2)}
  </g>`;
}

function rosette(x, y, r, color, alternate, count = 12) {
  return `<g transform="translate(${x} ${y})">` +
    Array.from({ length: count }, (_, i) => `<g transform="rotate(${i * 360 / count})">${path(`M0 0Q${-r * .37} ${-r * .57} 0 ${-r}Q${r * .37} ${-r * .57} 0 0Z`, i % 2 ? color : alternate, `stroke="${GOLD}" stroke-width=".65"`)}</g>`).join("") +
    circle(0, 0, r * .2, "#efcb70", 'stroke="#805527" stroke-width="1"') +
    circle(0, 0, r * .09, "#ffffff", 'opacity=".55"') + "</g>";
}

function temple(x, y, scale = 1, fill = "#a77a43") {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${fill}">
    <path d="M-60 0H60V-9H48V-22H41V-35H34V-47H27V-59H20V-70H13V-80H8V-87H-8V-80H-13V-70H-20V-59H-27V-47H-34V-35H-41V-22H-48V-9H-60Z"/>
    ${circle(0, -94, 6, fill)}${path("M-6-100L0-110L6-100Z", fill)}
    ${[-17, -30, -42, -54, -65, -76].map((yy, i) => line(-44 + i * 6, yy, 44 - i * 6, yy, "#fce4a4", 2, 'opacity=".35"')).join("")}
    ${path("M-10 0V-17Q0-28 10-17V0Z", "#173e40", 'opacity=".55"')}
  </g>`;
}

function definitions(s) {
  return `<defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffcf0"/><stop offset=".55" stop-color="#fff8e6"/><stop offset="1" stop-color="#eee0ba"/></linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1b0"/><stop offset=".25" stop-color="#dba943"/><stop offset=".54" stop-color="#ad7224"/><stop offset=".77" stop-color="#f6d578"/><stop offset="1" stop-color="#996124"/></linearGradient>
    <linearGradient id="robe" x1="0" y1="0" x2="1" y2=".5"><stop stop-color="${s.dark}"/><stop offset=".38" stop-color="${s.light}"/><stop offset=".59" stop-color="${s.jewel}"/><stop offset="1" stop-color="${s.dark}"/></linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="1" y2=".4"><stop stop-color="#b66e40"/><stop offset=".35" stop-color="#e7ad6f"/><stop offset=".65" stop-color="#d09053"/><stop offset="1" stop-color="#9c5937"/></linearGradient>
    <linearGradient id="arch" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${s.dark}"/><stop offset=".58" stop-color="${s.jewel}"/><stop offset="1" stop-color="#cbaa62"/></linearGradient>
    <radialGradient id="halo"><stop stop-color="#fff0ad" stop-opacity=".8"/><stop offset=".75" stop-color="#dfb963" stop-opacity=".12"/><stop offset="1" stop-color="#d6a341" stop-opacity="0"/></radialGradient>
  </defs>`;
}

function arch(s) {
  return `<path d="M49 283V111Q49 70 81 58L120 42L159 58Q191 70 191 111V283Z" fill="url(#arch)" stroke="url(#metal)" stroke-width="3"/>
    ${circle(120, 127, 73, "url(#halo)")}
    <g opacity=".19">${temple(156, 201, .8, "#fff3c1")}${temple(67, 213, .42, "#fff3c1")}</g>
    ${path("M56 281V113Q56 78 84 64L120 50L156 64Q184 78 184 113V281", "none", 'stroke="#edcc79" stroke-width=".8"')}
    ${[57, 183].map(x => `<path d="M${x - 4} 280V159H${x + 4}V280Z" fill="url(#metal)" opacity=".48"/>${circle(x, 152, 4, "#e1bc69")}`).join("")}
    ${rosette(120, 53, 7, s.gem, "#efcd7b", 8)}`;
}

function crown(s, queen, commander, variant) {
  if (commander) return `${path("M98 112Q91 89 104 85Q125 73 142 90L145 114Z", "url(#robe)", 'stroke="#302333" stroke-width="1.5"')}
    ${path("M95 105Q121 90 146 101L144 111Q122 100 97 116Z", "url(#metal)")}
    ${path(`M${variant % 2 ? 132 : 106} 88Q${variant % 2 ? 165 : 77} 62 ${variant % 2 ? 142 : 99} 56Q${variant % 2 ? 129 : 107} 66 ${variant % 2 ? 132 : 106} 88Z`, s.gem)}
    ${line(119, 89, 123, 106, "#f9db89", 2)}${circle(122, 103, 4, s.gem, 'stroke="#fbe095" stroke-width="1.4"')}`;
  if (queen) return `${path("M97 113Q93 93 107 90L115 82L122 91L136 87L143 103L142 116Z", "url(#metal)", 'stroke="#79522e" stroke-width="1"')}
    ${[101, 110, 121, 132, 140].map((x, i) => circle(x, [103, 97, 93, 97, 106][i], 3.4, i % 2 ? s.gem : "#a52d4d", 'stroke="#ffdfa0" stroke-width="1"')).join("")}
    ${path("M96 113Q120 104 143 114L142 119Q119 110 98 119Z", "#e8bd63")}
    ${pearls(120, 108, 24, 12, 0, Math.PI, 17)}
    ${path("M120 109L116 121L120 128L124 121Z", "url(#metal)")}${circle(120, 121, 2, "#b52b43")}`;
  const silhouettes = [
    "M96 113L100 96L104 94L106 83L112 81L112 72L118 72L121 63L125 73L130 74L133 85L139 87L143 99L146 115Z",
    "M96 113L96 100L102 93L101 82L110 87L115 72L122 82L131 72L136 88L144 83L142 99L146 115Z",
    "M96 113L99 95L106 95L106 84L113 84L113 75L118 75L122 68L127 76L130 77L130 86L137 86L137 96L144 96L146 115Z",
    "M96 113L99 101L97 92L107 94L111 78L119 83L126 68L131 86L139 82L138 96L147 95L146 115Z",
  ];
  return `${path(silhouettes[variant], "url(#metal)", 'stroke="#704821" stroke-width="1"')}
    ${[82, 94, 105].map((y, i) => path(`M${109 - i * 5} ${y}Q122 ${y - 4} ${132 + i * 5} ${y}`, "none", `stroke="#704821" stroke-width="2"`)).join("")}
    ${[85, 98, 109].map(y => circle(122, y, 3, s.gem, 'stroke="#fbe7a0" stroke-width="1"')).join("")}
    ${pearls(121, 107, 25, 9, 0, Math.PI, 15)}`;
}

function face(s, queen, commander, variant) {
  const moustache = !queen ? path(commander ? "M106 145Q114 140 121 143Q128 139 134 145Q127 148 121 145Q113 150 106 145Z" : "M105 143Q114 138 121 142Q129 137 137 143Q131 149 121 144Q111 150 105 143Z", "#322a28") : "";
  return `${path("M98 119Q90 108 97 97Q112 85 131 93Q149 102 143 123L140 153Q132 165 119 166Q101 161 96 147Z", "#252b2c")}
    ${queen ? path("M140 116Q160 146 152 179Q149 197 166 217L154 229Q135 206 143 179Q149 151 135 132Z", "#252629") : ""}
    ${path("M111 152L111 171L101 178Q120 194 141 177L131 170V152Z", "url(#skin)", 'stroke="#9a5d39" stroke-width=".7"')}
    ${circle(98, 132, 6, "url(#skin)")}${circle(142, 132, 6, "url(#skin)")}
    ${path("M100 113Q119 101 140 113L141 133Q139 151 130 157Q120 164 110 156Q100 149 99 132Z", "url(#skin)", 'stroke="#855335" stroke-width=".65"')}
    ${path("M101 119Q109 114 115 119M127 119Q133 115 139 120", "none", 'stroke="#302b2b" stroke-width="2" stroke-linecap="round"')}
    ${path("M103 125Q109 121 115 125Q109 129 103 125ZM126 125Q132 121 137 126Q132 129 126 125Z", "#fff1cf")}
    ${circle(109, 125, 2.2, "#282c2a")}${circle(131, 125, 2.2, "#282c2a")}
    ${circle(109.5, 124.5, .6, "#fff8e4")}${circle(131.5, 124.5, .6, "#fff8e4")}
    ${path("M121 125L117 136Q121 139 125 136", "none", 'stroke="#9b5b37" stroke-width="1.1" stroke-linecap="round"')}
    ${path(queen ? "M113 146Q120 141 128 146Q120 152 113 146Z" : "M115 150Q121 152 127 149", queen ? "#9c4442" : "none", queen ? "" : 'stroke="#8b4738" stroke-width="1.3"')}
    ${moustache}
    ${queen ? circle(138, 135, 2.4, "#f7d471") : ""}
    ${circle(120, queen ? 130 : 115, queen ? 1.8 : 2, "#ae3438")}
    ${[98, 142].map(x => `${circle(x, 142, queen ? 5 : 4, "url(#metal)", 'stroke="#9e6c33" stroke-width="1"')}${circle(x, 142, 1.8, s.gem)}${queen ? circle(x, 149, 2.4, "#f6db97") : ""}`).join("")}
    ${crown(s, queen, commander, variant)}`;
}

function costume(s, queen, commander, variant) {
  const hem = queen ? "M105 172Q120 183 138 173Q155 185 159 211L174 282H71L83 210Q85 184 105 172Z" :
    "M102 168Q120 182 139 169Q160 177 165 198L169 280H73L78 198Q82 178 102 168Z";
  return `${path(hem, "url(#robe)", 'stroke="#593e39" stroke-width="1"')}
    ${queen
      ? `${path("M98 173Q100 202 158 239L174 282H142Q125 221 84 201Z", "url(#metal)", 'opacity=".92"')}
         ${path("M101 177Q104 202 156 238", "none", 'stroke="#fff0a7" stroke-width="2"')}
         ${[105, 115, 127, 140].map((x, i) => path(`M${x} ${228 + i * 3}Q${x - 10} 257 ${x - 9} 281`, "none", `stroke="${s.dark}" stroke-width="2" opacity=".5"`)).join("")}`
      : `${path("M93 174L100 170L158 256L150 262Z", "url(#metal)")}
         ${path("M85 228Q120 237 159 226L160 239Q120 249 82 239Z", "url(#metal)")}
         ${[93, 107, 124, 143].map(x => path(`M${x} 245L${x - 4} 280`, "none", `stroke="${s.dark}" stroke-width="2" opacity=".55"`)).join("")}`}
    ${commander ? `${path("M85 180Q105 181 104 196L78 199Z", "url(#metal)")}
       ${path("M140 178Q157 177 163 194L140 198Z", "url(#metal)")}
       ${path("M108 185H135L139 218L121 229L103 218Z", "url(#metal)", 'opacity=".95"')}
       ${suitShape(variant, 121, 204, 19, s.dark)}` :
       `${path("M104 172Q119 190 138 172", "none", 'stroke="url(#metal)" stroke-width="5"')}
       ${pearls(121, 169, 21, 26, .12, Math.PI - .12, 15)}
       ${path("M98 175Q122 220 145 175", "none", 'stroke="#e7bd64" stroke-width="3"')}
       ${path("M121 199L116 207L122 216L128 207Z", "url(#metal)")}${circle(122, 207, 3, s.gem)}`}
    ${path("M76 275Q121 286 170 275L172 283H73Z", "url(#metal)")}
    ${[82, 94, 106, 118, 130, 142, 154, 166].map(x => circle(x, 280, 1.5, s.dark)).join("")}`;
}

function handsAndObjects(s, rank, variant) {
  const queen = rank === 12;
  if (rank === 13) {
    const offering = [
      `<path d="M96 215H131L129 221H98Z" fill="url(#metal)"/>${temple(114, 215, .22, "#edca72")}`,
      `${path("M95 203L127 207L128 223L96 219Z", "#f6dfa2", 'stroke="#9f793e" stroke-width="1"')}
       ${line(100, 209, 122, 212, "#ac854b", 1)}${line(100, 213, 118, 216, "#ac854b", 1)}
       ${circle(122, 218, 4, "#a32a42")}${path("M120 220L119 228L122 226L125 229L125 220Z", "#a32a42")}`,
      `${path("M95 211L129 208L131 219L98 223Z", "#e8cf8e", 'stroke="#704f31" stroke-width="1.3"')}
       ${line(99, 215, 125, 212, "#967542", 1)}${line(99, 219, 125, 216, "#967542", 1)}${circle(113, 216, 1, "#795432")}`,
      `${path("M96 213Q111 219 133 211L127 222H105Z", "url(#metal)", 'stroke="#8e602e" stroke-width="1"')}
       ${line(115, 193, 115, 216, "#d4ac59", 2)}${path("M117 195L130 208L117 209Z", "#fff1c8", 'stroke="#b89650" stroke-width=".75"')}
       ${path("M113 198L103 210L113 211Z", "#dabe76")}`,
    ][variant];
    return `${line(164, 129, 164, 273, "#624727", 5)}${line(163, 130, 163, 270, "#ebc56e", 2)}
      ${lotus(164, 129, 15, "#efc765", s.gem)}
      ${path("M146 182Q159 185 159 207L159 216L164 205Q171 201 172 208L168 224Q162 231 155 226L143 208Z", "url(#skin)", 'stroke="#935b39" stroke-width="1"')}
      ${path("M94 187Q87 192 83 213L101 221L108 217L118 224Q119 230 111 232L103 229L80 227Q71 223 74 211L81 189Z", "url(#skin)", 'stroke="#935b39" stroke-width="1"')}
      ${path("M76 210L87 214L84 221L74 217Z", "url(#metal)")}
      ${path("M154 210L168 214L166 220L154 217Z", "url(#metal)")}
      ${offering}`;
  }
  if (queen && variant === 1) {
    return `${path("M90 183Q77 200 86 221L108 239L117 229L96 214L103 191Z", "url(#skin)")}
      ${path("M142 183Q162 188 163 209L145 220L137 211L150 203Z", "url(#skin)")}
      <g transform="rotate(-24 121 228)">
        ${path("M139 220L173 220L176 228L139 230Z", "url(#metal)", 'stroke="#734323" stroke-width="1"')}
        ${circle(99, 232, 20, "#81482c", 'stroke="#f1cc79" stroke-width="2"')}
        ${circle(99, 231, 16, "#b77440")}
        ${path("M100 224L169 222L170 229L100 235Z", "#4c3930", 'stroke="#ddb062" stroke-width="1.5"')}
        ${[226, 228, 230].map(y => line(92, y + 2, 170, y - 2, "#f9df9a", .65)).join("")}
        ${[128, 136, 144, 152, 160].map(x => line(x, 222, x, 231, "#cbb580", .8)).join("")}
        ${circle(170, 218, 3, "#e4ba69")}
      </g>${circle(110, 228, 5, "url(#skin)")}${circle(148, 217, 5, "url(#skin)")}
      ${path("M90 209L97 214", "none", 'stroke="url(#metal)" stroke-width="5"')}`;
  }
  if (queen) {
    const object = variant === 0
      ? `${line(159, 175, 154, 215, "#427a4b", 2)}${lotus(161, 165, 24, "#d67c88", "#ffe1a0")}`
      : variant === 2
        ? `${path("M141 214Q158 219 176 211L173 220Q158 228 143 222Z", "url(#metal)")}
           ${path("M160 212Q147 201 161 189Q167 204 160 212Z", "#ffc765")}${path("M160 209Q156 203 161 197Q164 205 160 209Z", "#fff0ac")}`
        : `${path("M139 197L170 199L168 219L137 218Z", "#eddaa1", 'stroke="#8b633b" stroke-width="1.3"')}
           ${[204, 208, 212].map(y => line(142, y, 165, y + 1, "#8b7147", 1)).join("")}`;
    return `${path("M94 183Q76 192 78 218L96 236L106 231L90 214L104 192Z", "url(#skin)", 'stroke="#9a5d39" stroke-width="1"')}
      ${path("M143 183Q155 185 157 198L156 211L168 215Q173 220 166 223L150 221Q144 218 145 206L136 196Z", "url(#skin)", 'stroke="#9a5d39" stroke-width="1"')}
      ${path("M88 222L96 231M146 209L157 211", "none", 'stroke="url(#metal)" stroke-width="5"')}
      ${object}${path("M148 216Q155 210 160 215L155 219L147 221Z", "url(#skin)")}`;
  }
  const pole = variant === 0 || variant === 2;
  const weapon = pole
    ? `${line(163, 129, 163, 275, "#704c2e", 4)}${line(162, 129, 162, 274, "#e4bd6e", 1)}
       ${path(variant === 0 ? "M163 107L171 126L163 143L156 126Z" : "M161 108Q179 121 168 139L159 137Q169 121 156 118Z", "url(#metal)", 'stroke="#71512c" stroke-width="1"')}`
    : variant === 1
      ? `${path("M170 117Q196 190 163 269", "none", 'stroke="#d7a658" stroke-width="4"')}
         ${line(170, 117, 163, 269, "#eedca6", 1)}${line(164, 181, 181, 132, "#e1ba72", 2)}${path("M181 125L185 135L177 132Z", "#e6d8aa")}`
      : `${path("M166 127L173 118L170 205L163 205Z", "#eee4c7", 'stroke="#8e854f" stroke-width="1"')}
         ${line(158, 207, 177, 207, "#dfb767", 4)}${line(167, 208, 167, 231, "#7b4931", 5)}`;
  return `${weapon}
    ${path("M93 185Q73 192 73 220L88 237L104 226L89 214L104 197Z", "url(#skin)", 'stroke="#945934" stroke-width="1"')}
    ${path("M145 187Q159 191 159 209L164 214L170 208L174 213L170 224Q164 231 155 224L143 214Z", "url(#skin)", 'stroke="#945934" stroke-width="1"')}
    ${path("M152 209L163 216M80 215L92 222", "none", 'stroke="url(#metal)" stroke-width="5"')}
    ${path("M70 221Q91 210 113 221L110 248Q105 265 91 273Q76 264 72 248Z", s.dark, 'stroke="url(#metal)" stroke-width="3"')}
    ${path("M77 225Q91 218 106 225L103 245Q102 254 91 262Q82 255 79 244Z", "url(#robe)", 'stroke="#e9c16d" stroke-width="1"')}
    ${rosette(91, 240, 10, "#d6ad58", s.gem, 8)}`;
}

function court(suit, rank) {
  const s = suits[suit];
  const label = rank === 13 ? ["TEMPLE PATRON", "COURT COUNCIL", "ROYAL RECORDS", "MARITIME COURT"][suit] :
    rank === 11 ? ["COURT COMMANDER", "ROYAL ARCHER", "PALACE GUARD", "ROYAL CAPTAIN"][suit] :
      ["LOTUS COURT", "COURT MUSIC", "FESTIVAL LIGHT", "COURT LETTERS"][suit];
  return `${arch(s)}
    ${costume(s, rank === 12, rank === 11, suit)}
    ${handsAndObjects(s, rank, suit)}
    ${face(s, rank === 12, rank === 11, suit)}
    <path d="M55 288Q120 279 185 288L181 307Q120 299 59 307Z" fill="#f4e1b1" stroke="#c69948" stroke-width=".8"/>
    <text x="120" y="297" text-anchor="middle" fill="#5e452c" font-family="Georgia,serif" font-size="8.5" font-weight="bold" letter-spacing=".9">${label}</text>`;
}

const pipPositions = {
  2: [[120, 86], [120, 250]],
  3: [[120, 81], [120, 168], [120, 255]],
  4: [[82, 86], [158, 86], [82, 250], [158, 250]],
  5: [[82, 86], [158, 86], [120, 168], [82, 250], [158, 250]],
  6: [[82, 82], [158, 82], [82, 168], [158, 168], [82, 254], [158, 254]],
  7: [[82, 79], [158, 79], [120, 122], [82, 168], [158, 168], [82, 257], [158, 257]],
  8: [[82, 79], [158, 79], [120, 122], [82, 168], [158, 168], [120, 214], [82, 257], [158, 257]],
  9: [[82, 77], [158, 77], [82, 137], [158, 137], [120, 168], [82, 199], [158, 199], [82, 259], [158, 259]],
  10: [[82, 75], [158, 75], [120, 104], [82, 137], [158, 137], [82, 199], [158, 199], [120, 232], [82, 261], [158, 261]],
};

export function cardSvg(card) {
  const suit = Math.floor(card / 13);
  const rank = card % 13 + 1;
  const s = suits[suit];
  const label = ({ 1: "A", 11: "J", 12: "Q", 13: "K" })[rank] ?? String(rank);
  const index = `<text x="28" y="39" text-anchor="middle" fill="${s.ink}" font-family="Georgia,serif" font-weight="bold" font-size="${rank === 10 ? 30 : 37}">${label}</text>${suitShape(suit, 28, 57, 24, s.ink)}`;
  let center;
  if (rank >= 11) center = court(suit, rank);
  else if (rank === 1) {
    center = `<path d="M120 65L179 112V221L120 270L61 221V112Z" fill="none" stroke="#d3ae65" stroke-width="1"/>
      ${rosette(120, 166, 68, "#e9d5a0", "#f8ebc7", 16)}
      ${circle(120, 166, 43, "#fff9e7", 'stroke="#b78737" stroke-width="1.5"')}
      ${suitShape(suit, 120, 162, 68, s.ink)}
      ${lotus(120, 259, 20, "#ba8d3e", "#ddbe75")}
      <text x="120" y="293" text-anchor="middle" font-family="Georgia,serif" font-size="10" letter-spacing="2.5" fill="#8c692f">ROYAL COURT</text>`;
  } else {
    center = `<path d="M65 63Q120 45 175 63M65 273Q120 291 175 273" fill="none" stroke="#dbbf7a" stroke-width=".9"/>
      ${pipPositions[rank].map(([x, y]) => suitShape(suit, x, y, rank >= 9 ? 32 : 36, s.ink, y > 168 ? 180 : 0)).join("")}
      ${lotus(120, 303, 10, "#caa75c", "#e8d099")}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="336" viewBox="0 0 240 336" role="img" aria-label="${xml(`${label} of ${s.name}; original Chola-inspired royal court illustration`)}">
    <title>${label} of ${s.name}</title>${definitions(s)}
    <rect x="1" y="1" width="238" height="334" rx="15" fill="url(#paper)" stroke="#c5a96a" stroke-width="2"/>
    <rect x="7" y="7" width="226" height="322" rx="11" fill="none" stroke="#d5bc82" stroke-width=".65"/>
    ${center}${index}<g transform="rotate(180 120 168)">${index}</g>
  </svg>`;
}

export function backSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="336" viewBox="0 0 240 336" role="img" aria-label="Peacock blue and bronze-gold geometric card back">
    <title>Chola Royal Court card back</title>${definitions(suits[0])}
    <rect x="1" y="1" width="238" height="334" rx="15" fill="url(#paper)" stroke="#bd9955" stroke-width="2"/>
    <rect x="8" y="8" width="224" height="320" rx="10" fill="#123f4c"/>
    <rect x="15" y="15" width="210" height="306" rx="7" fill="none" stroke="url(#metal)" stroke-width="2"/>
    <rect x="24" y="24" width="192" height="288" rx="5" fill="#165b60" stroke="#d5ae5a" stroke-width=".8"/>
    ${Array.from({ length: 8 }, (_, row) => Array.from({ length: 5 }, (_, col) => {
      const x = 40 + col * 40;
      const y = 36 + row * 38;
      return path(`M${x} ${y - 8}L${x + 8} ${y}L${x} ${y + 8}L${x - 8} ${y}Z`, "none", 'stroke="#65a191" stroke-width=".7" opacity=".3"');
    }).join("")).join("")}
    <path d="M120 31L206 168L120 305L34 168Z" fill="#16434e" stroke="url(#metal)" stroke-width="3"/>
    <path d="M120 42L196 168L120 294L44 168Z" fill="none" stroke="#d5b76e" stroke-width=".7"/>
    ${circle(120, 168, 66, "#103f48", 'stroke="url(#metal)" stroke-width="3"')}
    ${circle(120, 168, 60, "none", 'stroke="#d2b76e" stroke-width=".75"')}
    ${rosette(120, 168, 54, "#278980", "#bb8540", 16)}
    ${circle(120, 168, 25, "#103e48", 'stroke="url(#metal)" stroke-width="2"')}
    ${lotus(120, 165, 27, "#d09e45", "#ffe9a1")}
    ${rosette(120, 64, 10, "#d1a44e", "#e8cf83", 8)}
    ${rosette(120, 272, 10, "#d1a44e", "#e8cf83", 8)}
    ${[[36, 37], [204, 37], [36, 299], [204, 299]].map(([x, y]) => rosette(x, y, 7, "#caa44e", "#e4cd89", 8)).join("")}
  </svg>`;
}

export function backgroundSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000" role="img" aria-label="Quiet jewel-green table with original temple and lotus border ornaments">
    <title>Royal courtyard at dusk</title>
    <defs><radialGradient id="table" cx=".46" cy=".32" r=".85"><stop stop-color="#21665f"/><stop offset=".58" stop-color="#123f44"/><stop offset="1" stop-color="#0a2732"/></radialGradient>
    <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b79750" stop-opacity=".25"/><stop offset="1" stop-color="#8c814b" stop-opacity=".05"/></linearGradient></defs>
    <rect width="1600" height="1000" fill="url(#table)"/>
    <g opacity=".035">${rosette(1350, 80, 345, "#d5c185", "#629d85", 24)}${rosette(110, 1030, 420, "#d5c185", "#629d85", 24)}</g>
    <rect x="21" y="21" width="1558" height="958" rx="22" fill="none" stroke="url(#edge)" stroke-width="1.5"/>
    <rect x="28" y="28" width="1544" height="944" rx="18" fill="none" stroke="#d7c787" stroke-width=".6" opacity=".12"/>
    <g opacity=".055">${temple(1380, 980, 3.4, "#e7cf8b")}${temple(110, 970, 1.8, "#e7cf8b")}${temple(1175, 982, 1.4, "#e7cf8b")}</g>
    <g opacity=".13">${[74, 1526].map(x => [72, 928].map(y => lotus(x, y, 42, "#c5a252", "#d9c58b")).join("")).join("")}</g>
    <path d="M100 41H700M900 41H1500M100 959H700M900 959H1500" stroke="#d1b871" stroke-width="1" opacity=".12"/>
    <g opacity=".17">${rosette(800, 41, 11, "#bea663", "#e1cd92", 8)}${rosette(800, 959, 11, "#bea663", "#e1cd92", 8)}</g>
  </svg>`;
}
