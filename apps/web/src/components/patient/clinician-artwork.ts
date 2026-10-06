/**
 * Original, editable HELIOS character artwork. Every character is made of vector
 * paths; named parts can move independently without replacing the scene.
 * This module is the single source of geometry for all five characters.
 */
type ClinicianPalette = {
  id: string;
  coat: boolean;
  female: boolean;
  senior?: boolean;
  surgical?: boolean;
  skin: string;
  skinLight: string;
  skinShade: string;
  hair: string;
  hairLight: string;
  cloth: string;
  clothLight: string;
  clothShade: string;
};

const palettes: ClinicianPalette[] = [
  {
    id: "lead-general",
    coat: true,
    female: false,
    skin: "#F4AC7B",
    skinLight: "#FFD8B4",
    skinShade: "#D57C51",
    hair: "#593019",
    hairLight: "#8D4B25",
    cloth: "#5B94E1",
    clothLight: "#A8CFFF",
    clothShade: "#3561B2",
  },
  {
    id: "clinician-female",
    coat: false,
    female: true,
    skin: "#DA8E61",
    skinLight: "#FFCA92",
    skinShade: "#AD603F",
    hair: "#101D53",
    hairLight: "#294477",
    cloth: "#26A381",
    clothLight: "#6CD1B1",
    clothShade: "#167968",
  },
  {
    id: "clinician-general",
    coat: false,
    female: false,
    skin: "#D88D65",
    skinLight: "#F8BE98",
    skinShade: "#A75F42",
    hair: "#442B21",
    hairLight: "#72452E",
    cloth: "#757ACD",
    clothLight: "#B0AEF1",
    clothShade: "#4C54A0",
  },
  {
    id: "clinician-surgical",
    coat: false,
    female: false,
    surgical: true,
    skin: "#CF865B",
    skinLight: "#F5BD91",
    skinShade: "#AA603E",
    hair: "#342926",
    hairLight: "#644638",
    cloth: "#46B6D9",
    clothLight: "#9EE7F4",
    clothShade: "#2089B5",
  },
  {
    id: "clinician-senior",
    coat: true,
    female: true,
    senior: true,
    skin: "#E2A681",
    skinLight: "#FFD6B3",
    skinShade: "#BA7957",
    hair: "#6F402C",
    hairLight: "#AC7353",
    cloth: "#758BCC",
    clothLight: "#BBCBFA",
    clothShade: "#4C64A6",
  },
];

function createArtwork(p: ClinicianPalette): string {
  const id = p.id;
  const fill = (name: string) => `url(#${id}-${name})`;
  const sleeve = p.coat ? fill("coat") : fill("cloth");
  const sleeveShade = p.coat ? "#D6E4F5" : p.clothShade;
  const trousers = p.coat ? fill("trousers") : fill("cloth");
  const hairBack = p.female
    ? `
    <g id="${id}-hair-back" data-part="hair-back">
      <path d="M78 111C74 87 84 65 106 61C129 53 153 68 163 88C173 111 163 130 169 155C173 172 181 182 189 190C178 207 158 211 139 204L93 209C76 207 61 198 55 185C72 165 66 137 78 111Z" fill="${fill("hair")}"/>
      <path d="M83 103C73 130 81 148 71 173C69 181 67 186 62 190C74 198 80 195 85 188C96 166 86 143 91 120Z" fill="${p.hairLight}" opacity=".45"/>
      <path d="M155 104C165 136 154 156 166 185L179 194C162 200 152 187 151 171C147 145 155 125 147 108Z" fill="#071337" opacity=".24"/>
    </g>`
    : "";
  const legs = `
    <g id="${id}-legs" data-part="legs">
      <path d="M81 410C79 447 82 482 84 510L80 589C89 598 105 599 116 590L120 478L126 588C137 598 151 597 163 588L160 509C164 473 164 441 155 411Z" fill="${trousers}"/>
      <path d="M115 448L115 518L109 589L115 590L121 477L127 588L137 591L130 500L127 446Z" fill="#172D66" opacity=".23"/>
      <path d="M90 454C88 475 92 502 91 519L88 575" fill="none" stroke="${p.coat ? "#829CD8" : p.clothLight}" stroke-width="5" stroke-linecap="round" opacity=".32"/>
      <path d="M150 452C154 472 151 496 153 519L155 571" fill="none" stroke="${p.coat ? "#2C4389" : p.clothShade}" stroke-width="3" stroke-linecap="round" opacity=".4"/>
      <path d="M81 584C89 589 104 590 115 584L117 604C116 612 105 618 93 621C82 624 64 623 62 617C60 611 69 604 78 598Z" fill="${fill("shoe")}"/>
      <path d="M126 583C137 589 152 589 163 583L166 599C180 604 193 610 191 617C186 625 165 623 151 620C137 620 126 615 125 607Z" fill="${fill("shoe")}"/>
      <path d="M63 616C76 620 101 620 116 608L116 615C101 625 73 627 63 621Z" fill="#112041"/>
      <path d="M126 608C144 618 174 620 191 614L190 621C173 627 143 622 128 615Z" fill="#112041"/>
      <path d="M81 603C87 598 101 598 106 601M138 600C149 598 156 601 161 604" fill="none" stroke="#6475A0" stroke-width="3" stroke-linecap="round" opacity=".6"/>
    </g>`;
  const neckline = p.coat
    ? `
      <path d="M105 193L133 193L146 222L126 287L92 216Z" fill="${fill("cloth")}"/>
      <path d="M105 192L120 209L106 225L96 205ZM134 191L120 209L134 223L143 204Z" fill="#E2F0FF"/>
      <path d="M116 210L125 209L131 221L124 232L132 281L120 295L111 279L118 231L111 221Z" fill="#2451A0"/>
      <path d="M120 233L119 279L124 285L128 280L123 233Z" fill="#386EBD"/>
      `
    : `
      <path d="M102 195L119 216L138 195L151 208L122 241L91 209Z" fill="${p.clothShade}"/>
      <path d="M105 193L120 212L135 193L139 204L122 225L101 205Z" fill="${fill("skin")}"/>
      <path d="M96 202L120 229L144 202" fill="none" stroke="${p.clothLight}" stroke-width="5" stroke-linejoin="round" opacity=".78"/>
      `;
  const torso = p.coat
    ? `
      <path d="M101 191C83 197 69 204 64 221L69 303L62 451C85 474 105 470 121 458C139 472 161 470 179 453L166 315L176 225C174 208 158 198 138 191L123 219Z" fill="${fill("coat")}"/>
      <path d="M103 195L120 223L113 316L116 453C99 464 80 464 66 450L77 308L70 223C75 209 86 202 103 195Z" fill="#F9FDFF"/>
      <path d="M138 196L125 224L127 312L124 453C138 464 160 465 175 452L162 317L173 225C170 212 155 201 138 196Z" fill="${fill("coat-side")}"/>
      ${neckline}
      <path d="M102 190L88 202L87 237L99 244L91 258L117 317L113 251L119 221Z" fill="#FFFFFF" stroke="#CEDFF1" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M138 190L151 202L153 239L142 246L150 258L123 318L126 252L122 221Z" fill="#EDF6FF" stroke="#CADDEF" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M79 362L106 365L103 399C93 405 83 404 77 396Z" fill="#EAF3FE" stroke="#CFDFED" stroke-width="1.6"/>
      <path d="M138 363L166 361L170 394C162 403 149 402 140 398Z" fill="#DFEAF7" stroke="#C5D8ED" stroke-width="1.6"/>
      <path d="M78 363L104 366M140 365L165 363" fill="none" stroke="#FFF" stroke-width="2"/>
      <path d="M143 271L161 270L161 294L143 295Z" fill="#E3EDFA" stroke="#C6D8E9"/>
      <path d="M146 270L146 257M152 270L152 258" stroke="#3865A2" stroke-width="3" stroke-linecap="round"/>
      <circle cx="125" cy="334" r="2.8" fill="#BACCE2"/><circle cx="126" cy="360" r="2.8" fill="#BACCE2"/><circle cx="127" cy="416" r="2.8" fill="#BACCE2"/>
      <path d="M72 440C84 447 96 448 107 444M135 444C148 449 161 448 171 442" fill="none" stroke="#DBE8F6" stroke-width="2"/>
      `
    : `
      <path d="M101 191C83 197 71 202 65 218L76 282L77 358C71 390 72 410 79 430C102 439 146 440 166 428C171 405 165 379 161 356L163 282L177 222C170 203 153 196 138 192L121 211Z" fill="${fill("cloth")}"/>
      <path d="M75 254L83 284L81 355C77 387 80 408 85 429L98 432C87 403 91 372 92 348L88 272Z" fill="${p.clothShade}" opacity=".27"/>
      <path d="M150 238C157 265 151 311 158 350C158 381 162 405 158 429L166 428C171 405 165 379 161 356L163 282L171 245Z" fill="${p.clothShade}" opacity=".44"/>
      ${neckline}
      <path d="M137 263L157 262L157 286C153 291 143 290 138 287Z" fill="${p.clothShade}" opacity=".44"/>
      <path d="M137 264L157 263" fill="none" stroke="${p.clothLight}" stroke-width="2" opacity=".8"/>
      <path d="M91 386C111 391 133 390 153 385M83 425C101 431 146 432 161 425" fill="none" stroke="${p.clothShade}" stroke-width="2" opacity=".48"/>
      <path d="M99 256C96 277 99 291 101 305" fill="none" stroke="${p.clothLight}" stroke-width="4" stroke-linecap="round" opacity=".33"/>
      <rect x="143" y="242" width="14" height="5" rx="2.5" fill="#F2FDFF" opacity=".9"/>
      `;
  const stethoscope = p.surgical
    ? ""
    : `
      <g id="${id}-stethoscope">
        <path d="M100 202C93 213 91 233 94 250M139 203C145 213 148 235 142 251" fill="none" stroke="#182B57" stroke-width="4.5" stroke-linecap="round"/>
        <path d="M94 247C84 270 91 291 104 290C118 289 119 269 112 254" fill="none" stroke="#26426C" stroke-width="3.5"/>
        <path d="M94 247L94 260M111 254L112 266" fill="none" stroke="#B4D5E6" stroke-width="3" stroke-linecap="round"/>
        <path d="M142 249L147 285" fill="none" stroke="#1E345D" stroke-width="4" stroke-linecap="round"/>
        <circle cx="148" cy="291" r="8" fill="#1B305B"/><circle cx="148" cy="291" r="5" fill="#C4E5F3"/><circle cx="148" cy="291" r="2.5" fill="#779BB9"/>
        <path d="M98 202L102 202M137 202L140 204" stroke="#6286A5" stroke-width="5" stroke-linecap="round"/>
      </g>`;
  const body = `
    <g id="${id}-body" data-part="body">
      <path d="M102 174L104 196C110 209 126 214 137 195L135 173Z" fill="${fill("skin")}"/>
      <path d="M102 177C111 190 126 193 136 179L135 189C124 202 111 198 104 192Z" fill="${p.skinShade}" opacity=".4"/>
      ${torso}${stethoscope}
    </g>`;
  const gestureArm = `
    <g id="${id}-gesture-arm" data-part="gesture-arm">
      <path d="M163 209C178 206 188 219 192 236L207 288L218 284L225 303C216 320 205 329 194 319C182 305 168 274 162 252C158 237 152 217 163 209Z" fill="${sleeve}"/>
      <path d="M169 221C169 242 177 268 187 289C193 302 198 308 207 308L217 300L224 304C215 319 205 328 194 318C179 300 164 262 160 240Z" fill="${sleeveShade}" opacity="${p.coat ? ".75" : ".38"}"/>
      <path d="M209 287L221 279L229 296L218 307Z" fill="${p.coat ? "#F9FCFF" : p.clothLight}"/>
      <path d="M216 285C216 281 214 276 214 270L211 252C210 247 213 245 216 249L222 264L222 242C222 236 226 236 227 242L230 261L233 244C234 240 238 241 237 246L235 266L239 256C241 252 244 254 242 259L237 277C235 284 228 290 224 293Z" transform="translate(-9 0)" fill="${fill("skin")}"/>
      <path d="M218 263C222 266 224 271 222 277M229 263L229 274M234 267L233 276" transform="translate(-9 0)" fill="none" stroke="${p.skinShade}" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>
      <path d="M174 223C180 229 181 241 184 250" fill="none" stroke="${p.coat ? "#FFFFFF" : p.clothLight}" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    </g>`;
  const tabletArm = `
    <g id="${id}-tablet-arm" data-part="tablet-arm">
      <path d="M77 207C62 210 56 223 52 244L37 318C32 336 43 355 60 361L99 364L105 343L67 332L78 278C85 252 89 219 77 207Z" fill="${sleeve}"/>
      <path d="M54 251L41 316C36 334 44 349 61 353L101 358L99 365L60 362C39 357 29 339 34 321L49 249Z" fill="${sleeveShade}" opacity="${p.coat ? ".75" : ".5"}"/>
      <path d="M69 216C61 231 59 254 55 271" fill="none" stroke="${p.coat ? "#FFFFFF" : p.clothLight}" stroke-width="5" stroke-linecap="round" opacity=".74"/>
      <g id="${id}-tablet" data-part="tablet" transform="rotate(8 118 333)">
        <path d="M94 286L145 286C149 286 151 289 151 292L151 373C151 377 149 379 145 379L94 379C91 379 89 377 89 373L89 292C89 288 91 286 94 286Z" fill="#132C63"/>
        <path d="M95 289L145 289C147 289 148 290 148 293L148 370C148 373 147 375 145 375L95 375C93 375 92 373 92 370L92 293C92 290 93 289 95 289Z" fill="${fill("tablet")}"/>
        <path d="M95 290L143 290L96 352Z" fill="#5F84C0" opacity=".17"/>
        <rect x="111" y="287" width="18" height="4" rx="2" fill="#7C9BCB"/>
        <circle cx="120" cy="332" r="7" fill="#7796C7" opacity=".36"/>
        <path d="M120 328L120 336M116 332L124 332" stroke="#C1D3EE" stroke-width="2" stroke-linecap="round" opacity=".67"/>
      </g>
      <path d="M85 340L96 340C104 336 109 333 114 331C119 329 120 333 116 336L107 342L126 340C131 340 132 344 127 345L111 349L125 348C130 348 130 352 125 353L111 356L121 355C125 355 125 359 120 360L106 364C98 366 90 361 84 359Z" fill="${fill("skin")}"/>
      <path d="M108 349L115 348M107 356L115 354" stroke="${p.skinShade}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>
      <path d="M78 337L89 339L86 363L75 360Z" fill="${p.coat ? "#F9FCFF" : p.clothLight}"/>
    </g>`;
  const hair = p.surgical
    ? `
      <path d="M79 101C74 85 85 64 101 60C123 52 153 61 161 80C166 90 163 101 158 107L149 91L92 97L88 114Z" fill="${fill("cloth")}"/>
      <path d="M84 93C102 83 135 85 158 96L161 108C138 96 108 98 83 107Z" fill="#83D9EC"/>
      <path d="M97 68C88 78 89 87 90 93M112 62C105 72 105 79 106 87M140 67C144 77 145 85 145 91" fill="none" stroke="#C4F3F7" stroke-width="2" opacity=".55"/>
      `
    : p.female
      ? `
      <path d="M79 127C76 116 74 99 81 84C88 68 105 61 121 63C143 59 162 79 162 98L157 130L150 136L148 110C139 109 128 95 126 86C117 105 99 108 89 109L89 131Z" fill="${fill("hair")}"/>
      <path d="M85 104C90 85 100 74 117 71C110 75 106 82 104 88C100 96 94 101 85 104Z" fill="${p.hairLight}" opacity=".8"/>
      <path d="M130 74C143 79 151 91 155 104C155 84 143 73 130 74Z" fill="${p.hairLight}" opacity=".55"/>
      <path d="M88 105C103 103 118 94 124 81" fill="none" stroke="${p.hairLight}" stroke-width="2" stroke-linecap="round" opacity=".6"/>
      `
      : `
      <path d="M79 126C76 115 76 106 76 99C72 96 74 88 80 83C77 71 88 62 99 63C109 49 123 56 130 61C143 57 154 63 155 76C169 86 164 101 160 110L154 130L147 128L146 105C131 111 115 103 111 92C106 105 94 109 88 109L88 130Z" fill="${fill("hair")}"/>
      <path d="M82 88C85 74 99 72 105 76C112 58 130 65 130 71C140 68 149 76 148 85C132 91 118 89 111 81C108 94 94 96 82 98Z" fill="${p.hairLight}" opacity=".72"/>
      <path d="M84 84C89 77 96 77 101 79M110 71C116 65 122 66 126 70M134 76C140 74 146 79 146 83" fill="none" stroke="#BA7441" stroke-width="2.6" stroke-linecap="round" opacity=".4"/>
      `;
  const mask = p.surgical
    ? `
      <path d="M88 133L81 130M152 134L160 132M87 158L81 155M153 157L160 155" stroke="#DAF9FF" stroke-width="2"/>
      <path d="M90 132C108 136 134 136 152 132L151 159C143 170 104 173 91 161Z" fill="${fill("mask")}"/>
      <path d="M95 143C108 149 135 149 147 142M95 152C111 157 133 157 147 151M99 161C112 164 132 164 143 159" fill="none" stroke="#72C3DE" stroke-width="1.7"/>
      `
    : "";
  const glasses = p.senior
    ? `
      <g id="${id}-glasses">
        <path d="M86 125L94 128M151 126L157 122M113 131C117 127 123 127 127 131" fill="none" stroke="#7F443B" stroke-width="2.5"/>
        <path d="M91 124C97 122 107 122 113 125L112 139C106 144 98 144 93 139Z" fill="#DEF6FC" fill-opacity=".19" stroke="#914D42" stroke-width="2.3"/>
        <path d="M126 125C132 122 143 122 149 125L147 139C141 144 133 144 128 139Z" fill="#DEF6FC" fill-opacity=".19" stroke="#914D42" stroke-width="2.3"/>
        <path d="M95 125L100 123M131 125L136 123" stroke="#F5D7BE" stroke-width="1.5" stroke-linecap="round"/>
      </g>`
    : "";
  const head = `
    <g id="${id}-head" data-part="head">
      <path d="M88 129C80 118 71 123 76 139C78 148 84 153 90 149ZM150 128C158 118 166 125 162 140C160 149 153 153 149 149Z" fill="${fill("skin")}"/>
      <path d="M82 133C78 127 77 134 81 142M156 131C161 128 160 138 156 142" fill="none" stroke="${p.skinShade}" stroke-width="2" stroke-linecap="round"/>
      <path d="M88 98C98 79 137 77 151 100C157 113 154 132 153 146C151 170 138 188 121 189C102 189 87 172 84 151C81 134 81 111 88 98Z" fill="${fill("skin")}"/>
      <path d="M88 108C86 128 88 151 97 166C108 183 121 188 133 184C114 196 97 181 88 164C81 147 80 122 85 109Z" fill="${p.skinShade}" opacity=".28"/>
      <path d="M142 108C151 122 149 139 146 146C144 150 141 146 142 141C147 123 137 113 136 109Z" fill="${p.skinLight}" opacity=".5"/>
      <ellipse cx="97" cy="149" rx="10" ry="6" fill="#E98776" opacity=".23"/><ellipse cx="143" cy="149" rx="9" ry="6" fill="#E98776" opacity=".26"/>
      ${hair}
      <g id="${id}-eyes" data-part="eyes">
        <path d="M92 119C97 115 103 115 108 118M129 118C134 114 142 115 146 119" fill="none" stroke="${p.hair}" stroke-width="3.3" stroke-linecap="round"/>
        <path d="M94 130C97 125 104 125 107 131C104 137 97 137 94 130Z" fill="#FFF9F2"/>
        <path d="M129 130C133 124 140 125 143 130C140 136 133 137 129 130Z" fill="#FFF9F2"/>
        <ellipse cx="102" cy="131" rx="3.7" ry="5.6" fill="#382F32"/><ellipse cx="137" cy="130" rx="3.8" ry="5.8" fill="#382F32"/>
        <ellipse cx="103" cy="130" rx="2.3" ry="4" fill="#17233A"/><ellipse cx="138" cy="129" rx="2.3" ry="4" fill="#17233A"/>
        <circle cx="103" cy="127.8" r="1.4" fill="#FFF"/><circle cx="138" cy="127" r="1.4" fill="#FFF"/>
        ${p.female ? '<path d="M94 128L92 126M142 128L145 125" stroke="#27314B" stroke-width="1.5" stroke-linecap="round"/>' : ""}
      </g>
      <path d="M120 129C118 138 115 143 119 145L124 145" fill="none" stroke="${p.skinShade}" stroke-width="2" stroke-linecap="round" opacity=".66"/>
      <path d="M124 139C128 144 124 149 119 148" fill="none" stroke="${p.skinLight}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
      <g id="${id}-mouth" data-part="mouth">
        <path d="M108 158C116 162 129 162 136 155C134 169 117 174 108 158Z" fill="#9D5147"/>
        <path d="M110 159C118 162 128 162 134 157L131 162C124 165 117 165 112 162Z" fill="#FFF8ED"/>
        <path d="M119 168C123 166 128 166 130 166C126 170 122 170 119 168Z" fill="#D97C76"/>
        <path d="M116 175C121 177 128 176 132 173" fill="none" stroke="${p.skinShade}" stroke-width="1.5" stroke-linecap="round" opacity=".4"/>
      </g>
      ${mask}${glasses}
      ${p.female ? `<circle cx="84" cy="153" r="3" fill="#ECCC8B"/><circle cx="155" cy="153" r="3" fill="#ECCC8B"/>` : ""}
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="640" viewBox="0 0 240 640" fill="none" aria-hidden="true" focusable="false" data-clinician-art="${id}">
    <defs>
      <linearGradient id="${id}-skin" x1="87" y1="112" x2="159" y2="156" gradientUnits="userSpaceOnUse"><stop stop-color="${p.skinLight}"/><stop offset=".5" stop-color="${p.skin}"/><stop offset="1" stop-color="${p.skinShade}"/></linearGradient>
      <linearGradient id="${id}-hair" x1="93" y1="70" x2="154" y2="171" gradientUnits="userSpaceOnUse"><stop stop-color="${p.hairLight}"/><stop offset=".43" stop-color="${p.hair}"/><stop offset="1" stop-color="${p.hair}"/></linearGradient>
      <linearGradient id="${id}-cloth" x1="71" y1="201" x2="167" y2="430" gradientUnits="userSpaceOnUse"><stop stop-color="${p.clothLight}"/><stop offset=".35" stop-color="${p.cloth}"/><stop offset="1" stop-color="${p.clothShade}"/></linearGradient>
      <linearGradient id="${id}-coat" x1="58" y1="212" x2="176" y2="421" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF"/><stop offset=".52" stop-color="#F8FCFF"/><stop offset="1" stop-color="#D9E8F8"/></linearGradient>
      <linearGradient id="${id}-coat-side" x1="128" y1="230" x2="173" y2="423" gradientUnits="userSpaceOnUse"><stop stop-color="#F7FCFF"/><stop offset="1" stop-color="#D5E5F8"/></linearGradient>
      <linearGradient id="${id}-trousers" x1="84" y1="423" x2="163" y2="590" gradientUnits="userSpaceOnUse"><stop stop-color="#3D5FA3"/><stop offset=".53" stop-color="#547BBE"/><stop offset="1" stop-color="#243C7B"/></linearGradient>
      <linearGradient id="${id}-shoe" x1="93" y1="586" x2="111" y2="623" gradientUnits="userSpaceOnUse"><stop stop-color="#293F73"/><stop offset="1" stop-color="#102049"/></linearGradient>
      <linearGradient id="${id}-tablet" x1="98" y1="292" x2="145" y2="378" gradientUnits="userSpaceOnUse"><stop stop-color="#2D538E"/><stop offset="1" stop-color="#1A3267"/></linearGradient>
      <linearGradient id="${id}-mask" x1="115" y1="134" x2="121" y2="169" gradientUnits="userSpaceOnUse"><stop stop-color="#CAEFF9"/><stop offset="1" stop-color="#8DD2E7"/></linearGradient>
    </defs>
    ${hairBack}${legs}${body}${gestureArm}${tabletArm}${head}
  </svg>`;
}

const artworkById: Readonly<Record<string, string>> = Object.fromEntries(
  palettes.map((palette) => [palette.id, createArtwork(palette)]),
);

/** Trusted local vectors only; never pass patient or provider content as SVG. */
export function getClinicianSvg(id: string): string {
  return artworkById[id] ?? artworkById["lead-general"]!;
}
