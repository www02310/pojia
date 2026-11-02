/*!
 * DSH Splash · runtime overlay
 * 由 tools/build-overlay.mjs 从 assets/splash.html 生成，请勿直接编辑生成物。
 * 无需改宿主文件：通过 webServer 的 index-inject 注入，启动早期挂一层全屏覆盖层。
 */
(function () {
  'use strict'
  var CSS = "\n  :host {\n    --bg: #0b0d12;\n    --white: #ffffff;\n    --dim: #8b93a7;\n  }\n  * { margin: 0; padding: 0; box-sizing: border-box; }\n  :host {\n    width: 100%; height: 100%;\n    background: var(--bg);\n    color: var(--white);\n    font-family: \"Segoe UI\", system-ui, -apple-system, \"PingFang SC\", \"Microsoft YaHei\", sans-serif;\n    overflow: hidden;\n    user-select: none;\n    cursor: default;\n  }\n  :host::before {\n    content: \"\";\n    position: absolute; inset: 0;\n    background:\n      radial-gradient(700px 460px at 50% 30%, rgba(255,255,255,0.055), transparent 70%),\n      radial-gradient(900px 620px at 50% 112%, rgba(77,107,254,0.08), transparent 65%);\n    pointer-events: none;\n  }\n  .stage {\n    position: relative;\n    height: 100%;\n    display: flex; flex-direction: column;\n    align-items: center; justify-content: center;\n    gap: 22px;\n    animation: rise 0.4s cubic-bezier(0.22, 0.9, 0.3, 1) both;\n  }\n  @keyframes rise {\n    from { opacity: 0; transform: translateY(8px); }\n    to   { opacity: 1; transform: none; }\n  }\n\n  /* ── 亮白跑马灯 ── */\n  .marquee {\n    position: relative;\n    width: 300px; height: 26px;\n    display: flex; align-items: center; justify-content: space-between;\n    transition: opacity 0.35s ease;\n  }\n  .marquee.dim { opacity: 0.18; }\n  .marquee .track {\n    position: absolute; left: 6px; right: 6px; top: 50%;\n    height: 1px; transform: translateY(-50%);\n    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent);\n  }\n  .marquee i {\n    position: relative;\n    width: 5px; height: 5px; border-radius: 50%;\n    background: #fff;\n    box-shadow: 0 0 6px 1px rgba(255,255,255,0.85);\n    opacity: 0.16;\n    animation: chase 1.05s linear infinite;\n  }\n  @keyframes chase {\n    0%   { opacity: 0.14; box-shadow: 0 0 4px 0 rgba(255,255,255,0.35); }\n    22%  { opacity: 1;    box-shadow: 0 0 9px 2.5px rgba(255,255,255,0.95); }\n    55%  { opacity: 0.14; box-shadow: 0 0 4px 0 rgba(255,255,255,0.35); }\n    100% { opacity: 0.14; box-shadow: 0 0 4px 0 rgba(255,255,255,0.35); }\n  }\n  .marquee .beam {\n    position: absolute; top: 50%; left: 0;\n    width: 90px; height: 14px;\n    transform: translateY(-50%);\n    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);\n    filter: blur(5px);\n    animation: sweep 0.42s ease-in-out 3;\n  }\n  @keyframes sweep {\n    from { transform: translate(-90px, -50%); }\n    to   { transform: translate(300px, -50%); }\n  }\n\n  /* ── 一笔写出 ── */\n  .write { width: 380px; height: 66px; display: block; }\n  .write .glow path {\n    fill: none;\n    stroke: rgba(255,255,255,0.9);\n    stroke-width: 6;\n    stroke-linecap: round; stroke-linejoin: round;\n    filter: blur(6px);\n    opacity: 0.5;\n  }\n  .write .ink path {\n    fill: #fff;\n    fill-opacity: 0;\n    stroke: #fff;\n    stroke-width: 2.4;\n    stroke-linecap: round; stroke-linejoin: round;\n    transition: fill-opacity 0.3s ease 0.06s;\n  }\n  .write .ink path.done { fill-opacity: 0.94; }\n  .write .pen-halo { fill: rgba(255,255,255,0.32); filter: blur(2.5px); opacity: 0; }\n  .write .pen { fill: #fff; opacity: 0; }\n  .underline {\n    width: 0; height: 2px; margin-top: -8px;\n    border-radius: 2px;\n    background: linear-gradient(90deg, transparent, #fff, transparent);\n    box-shadow: 0 0 8px rgba(255,255,255,0.8);\n    transition: width 0.5s cubic-bezier(0.22,0.9,0.3,1);\n  }\n  .underline.on { width: 300px; }\n\n  /* ── 尾部 ── */\n  .logo {\n    width: 40px; height: 40px;\n    display: grid; place-items: center;\n    border-radius: 12px;\n    background: linear-gradient(180deg, #171b26, #101320);\n    border: 1px solid rgba(255,255,255,0.08);\n    box-shadow: 0 0 0 1px rgba(255,255,255,0.05), 0 10px 30px -12px rgba(77,107,254,0.5);\n    opacity: 0;\n    transition: opacity 0.45s ease;\n  }\n  .logo.on { opacity: 1; }\n  .logo img { width: 22px; height: 22px; display: block; }\n  .bar {\n    width: 168px; height: 3px; border-radius: 99px;\n    background: rgba(255,255,255,0.09);\n    overflow: hidden;\n  }\n  .bar::after {\n    content: \"\";\n    display: block; width: 42%; height: 100%;\n    border-radius: inherit;\n    background: linear-gradient(90deg, transparent, #fff, transparent);\n    animation: slide 1.25s ease-in-out infinite;\n  }\n  @keyframes slide {\n    0%   { transform: translateX(-110%); }\n    100% { transform: translateX(250%); }\n  }\n  .status { font-size: 12px; color: var(--dim); letter-spacing: 0.08em; }\n  .version {\n    position: absolute; bottom: 18px;\n    font-size: 11px; color: rgba(139,147,167,0.55);\n    font-variant-numeric: tabular-nums;\n  }\n\n  :host { display: block; }\n  .splash-root { position: absolute; inset: 0; display: block; }\n  .stage { position: relative; height: 100%; }\n  /* 量到路径长度之前先藏起描边：否则会整条字母轮廓亮出来（0 长虚线段 = 什么都不画） */\n  .write .ink path, .write .glow path { stroke-dasharray: 0 100000; }\n";
  var MARKUP = "<div class=\"stage\">\n    <div class=\"marquee\" id=\"marquee\">\n      <div class=\"track\"></div>\n      <div class=\"beam\"></div>\n      <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>\n    </div>\n\n    <svg class=\"write\" id=\"write\" viewBox=\"-10 -45 400 62\" aria-label=\"DeepSeek Harness\">\n      <g class=\"glow\" id=\"glow\"></g>\n      <g class=\"ink\" id=\"ink\"></g>\n      <g class=\"pens\" id=\"pens\"></g>\n    </svg>\n    <div class=\"underline\" id=\"underline\"></div>\n\n    <div class=\"logo\" id=\"logo\"><svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"22\" height=\"22\" viewBox=\"0 0 50 50\" fill=\"none\">\n\t<path id=\"path\" d=\"M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z\" fill=\"#fff\" fill-opacity=\"1.000000\" fill-rule=\"nonzero\"/>\n</svg></div>\n    <div class=\"bar\"></div>\n    <div class=\"status\">正在启动…</div>\n    <div class=\"version\" id=\"ver\"></div>\n  </div>";
  var GLYPHS = [{"d":"M438 158Q377 104 312.5 56.0Q248 8 205 -12Q202 -23 196.0 -28.5Q190 -34 178 -34Q169 -34 165.0 -30.5Q161 -27 161 -18Q161 -12 165.5 32.0Q170 76 170 135Q170 235 167 316Q165 410 165 448Q165 507 177 545Q186 569 209 569Q217 569 223.5 566.0Q230 563 230 557Q229 552 219.5 522.0Q210 492 210 465Q210 390 213 301Q215 187 215 143Q215 68 214 53Q250 67 311.5 111.0Q373 155 415 191Q502 269 542.0 331.0Q582 393 582 460Q582 541 480.5 571.0Q379 601 215 601Q165 601 81 589Q65 588 31 579Q16 574 10 574Q2 574 -5.5 587.0Q-13 600 -13 613Q-13 618 -6.0 622.5Q1 627 16 629Q76 637 118.5 641.0Q161 645 218 645Q400 645 514.5 604.0Q629 563 629 465Q629 387 584.0 317.0Q539 247 438 158Z","tx":0,"sx":7.85,"sy":1.66,"s":0.0488},{"d":"M436 240Q436 222 409.5 161.0Q383 100 329.5 48.0Q276 -4 198 -4Q134 -4 91.0 36.0Q48 76 48 159Q48 237 84.0 313.5Q120 390 178.0 438.5Q236 487 298 487Q335 487 360.5 470.5Q386 454 386 423Q386 388 346.5 355.0Q307 322 244.0 297.0Q181 272 114 261Q102 215 102 171Q102 113 129.5 81.0Q157 49 208 49Q285 49 333.0 104.0Q381 159 413 228Q415 232 420.0 243.5Q425 255 429 255Q436 255 436 240ZM286 446Q248 446 213.0 421.0Q178 396 154.5 361.0Q131 326 124 299Q170 304 221.0 325.0Q272 346 306.5 371.0Q341 396 341 412Q341 428 324.5 437.0Q308 446 286 446Z","tx":31.89,"sx":39.74,"sy":1.66,"s":0.0488},{"d":"M436 240Q436 222 409.5 161.0Q383 100 329.5 48.0Q276 -4 198 -4Q134 -4 91.0 36.0Q48 76 48 159Q48 237 84.0 313.5Q120 390 178.0 438.5Q236 487 298 487Q335 487 360.5 470.5Q386 454 386 423Q386 388 346.5 355.0Q307 322 244.0 297.0Q181 272 114 261Q102 215 102 171Q102 113 129.5 81.0Q157 49 208 49Q285 49 333.0 104.0Q381 159 413 228Q415 232 420.0 243.5Q425 255 429 255Q436 255 436 240ZM286 446Q248 446 213.0 421.0Q178 396 154.5 361.0Q131 326 124 299Q170 304 221.0 325.0Q272 346 306.5 371.0Q341 396 341 412Q341 428 324.5 437.0Q308 446 286 446Z","tx":54.52,"sx":62.37,"sy":1.66,"s":0.0488},{"d":"M162 80Q160 12 160 -31Q160 -88 165 -135Q167 -153 167 -160Q167 -176 160.0 -187.5Q153 -199 140 -199Q122 -199 120 -186Q119 -169 117.5 -133.5Q116 -98 116 -62L117 78Q112 78 98.5 77.0Q85 76 72 76Q48 76 48 109Q48 133 60 133Q64 133 84.0 127.0Q104 121 118 121L117 404Q109 405 84.0 407.5Q59 410 47.5 417.0Q36 424 36 437Q36 463 46 463Q57 463 73 455Q75 454 85.0 449.5Q95 445 113 443Q119 459 124.5 465.0Q130 471 146 471Q166 471 166 463Q166 460 163.0 452.5Q160 445 160 438Q222 429 300.5 401.5Q379 374 436.5 332.0Q494 290 494 240Q494 169 402.0 130.0Q310 91 162 80ZM158 400Q160 342 161.0 246.5Q162 151 162 120Q222 120 290.0 135.5Q358 151 404.5 177.5Q451 204 451 236Q451 278 403.0 312.0Q355 346 287.5 368.0Q220 390 158 400Z","tx":77.14,"sx":84.99,"sy":1.66,"s":0.0488},{"d":"M246 -33Q181 -33 143.0 -22.5Q105 -12 105 7Q105 17 119.5 40.5Q134 64 142 64Q154 64 154 59Q154 56 150.5 52.0Q147 48 147 44Q147 41 159.5 35.0Q172 29 198.0 24.0Q224 19 261 19Q320 19 364.5 42.0Q409 65 433.0 100.0Q457 135 457 168Q457 211 415.5 242.0Q374 273 282 301Q193 330 144.5 349.5Q96 369 66.0 397.5Q36 426 36 467Q36 522 98.0 575.5Q160 629 251.0 662.5Q342 696 420 696Q460 696 463 680Q466 664 466 644Q466 629 455 629Q450 629 443.5 632.5Q437 636 432 638Q426 640 418.0 642.0Q410 644 395 644Q343 644 270.0 617.0Q197 590 143.5 550.0Q90 510 90 473Q90 443 114.5 421.0Q139 399 180.0 383.5Q221 368 296 345Q406 313 458.5 273.0Q511 233 511 175Q511 125 477.5 76.5Q444 28 383.5 -2.5Q323 -33 246 -33Z","tx":102.55,"sx":110.4,"sy":1.66,"s":0.0488},{"d":"M436 240Q436 222 409.5 161.0Q383 100 329.5 48.0Q276 -4 198 -4Q134 -4 91.0 36.0Q48 76 48 159Q48 237 84.0 313.5Q120 390 178.0 438.5Q236 487 298 487Q335 487 360.5 470.5Q386 454 386 423Q386 388 346.5 355.0Q307 322 244.0 297.0Q181 272 114 261Q102 215 102 171Q102 113 129.5 81.0Q157 49 208 49Q285 49 333.0 104.0Q381 159 413 228Q415 232 420.0 243.5Q425 255 429 255Q436 255 436 240ZM286 446Q248 446 213.0 421.0Q178 396 154.5 361.0Q131 326 124 299Q170 304 221.0 325.0Q272 346 306.5 371.0Q341 396 341 412Q341 428 324.5 437.0Q308 446 286 446Z","tx":129.36,"sx":137.22,"sy":1.66,"s":0.0488},{"d":"M436 240Q436 222 409.5 161.0Q383 100 329.5 48.0Q276 -4 198 -4Q134 -4 91.0 36.0Q48 76 48 159Q48 237 84.0 313.5Q120 390 178.0 438.5Q236 487 298 487Q335 487 360.5 470.5Q386 454 386 423Q386 388 346.5 355.0Q307 322 244.0 297.0Q181 272 114 261Q102 215 102 171Q102 113 129.5 81.0Q157 49 208 49Q285 49 333.0 104.0Q381 159 413 228Q415 232 420.0 243.5Q425 255 429 255Q436 255 436 240ZM286 446Q248 446 213.0 421.0Q178 396 154.5 361.0Q131 326 124 299Q170 304 221.0 325.0Q272 346 306.5 371.0Q341 396 341 412Q341 428 324.5 437.0Q308 446 286 446Z","tx":151.99,"sx":159.84,"sy":1.66,"s":0.0488},{"d":"M467 386Q459 386 449.0 394.5Q439 403 435 403Q408 403 349.0 366.0Q290 329 228.0 279.0Q166 229 133 194L134 176Q210 141 303.0 101.0Q396 61 432 54Q446 52 460.0 51.0Q474 50 480 50Q489 50 495.0 49.0Q501 48 501 45Q501 33 482.5 21.0Q464 9 427 9Q394 9 337.5 33.5Q281 58 204 98L141 129Q154 2 154 -11Q154 -22 143.0 -29.0Q132 -36 119 -36Q111 -36 106.0 -12.0Q101 12 94 83L87 144Q75 149 66.0 158.5Q57 168 57 176Q57 188 77 204Q76 258 71.5 358.0Q67 458 65 504L60 643Q60 671 67.0 691.0Q74 711 98 711Q107 711 110.0 707.5Q113 704 113 694Q113 648 119.5 480.5Q126 313 130 242Q353 454 456 454Q477 454 491.5 446.5Q506 439 506 431Q506 417 492.5 401.5Q479 386 467 386Z","tx":174.62,"sx":182.47,"sy":1.66,"s":0.0488},{"d":"M604 249Q586 243 560.5 241.5Q535 240 527 240Q526 209 523.0 171.0Q520 133 518 108L515 77L513 45L507 -32Q503 -83 474 -83Q463 -83 452.5 -57.5Q442 -32 442 -16Q442 -12 450.0 0.0Q458 12 460 30Q464 58 469.0 123.0Q474 188 476 232Q437 229 392 223Q372 221 302.0 214.0Q232 207 192 205Q188 139 183.0 44.0Q178 -51 178 -72Q178 -80 180.5 -93.0Q183 -106 183 -113Q183 -122 169.5 -131.0Q156 -140 148 -140Q138 -140 131.5 -127.0Q125 -114 125 -97Q125 -88 127.0 -67.5Q129 -47 130 -32Q134 -5 135 12Q140 71 143.0 126.0Q146 181 147 200Q84 189 28 189Q9 189 -4.5 198.5Q-18 208 -18 226Q-18 239 -11.5 245.5Q-5 252 15 252L68 251Q120 249 152 249Q157 334 157 385Q157 501 155 593V630Q155 645 166.5 654.5Q178 664 193 664Q204 664 208.0 647.0Q212 630 212 609Q212 587 207 519Q201 403 201 396L196 253Q280 255 481 279Q485 308 495 431Q499 496 502 526L508 604Q521 751 521 788Q521 801 531.0 809.0Q541 817 554 817Q572 817 572 782Q572 760 562 665Q551 541 550 527Q544 450 538.5 380.0Q533 310 531 286Q549 289 563 295Q581 301 591 301Q601 301 614.0 289.0Q627 277 627 272Q627 256 604 249Z","tx":212.21,"sx":220.06,"sy":1.66,"s":0.0488},{"d":"M480 37Q480 25 470.0 9.5Q460 -6 450 -6Q433 -6 424.0 15.0Q415 36 415 64Q415 88 418 208L419 246Q419 269 407 279Q362 203 323.0 147.0Q284 91 224.0 41.5Q164 -8 98 -8Q66 -8 48.5 12.0Q31 32 31 64Q31 104 67.0 173.5Q103 243 159.0 314.5Q215 386 271 432Q308 462 330.0 472.5Q352 483 369 483Q385 483 402.0 473.0Q419 463 431.0 445.0Q443 427 443 404Q443 373 426 345L443 350Q454 350 456 323Q457 307 458.5 258.0Q460 209 461 177Q462 144 463.0 113.0Q464 82 465 64Q466 57 473.0 49.5Q480 42 480 37ZM393 318Q405 348 405 383Q405 404 392.5 419.5Q380 435 359 435Q334 435 295 401Q250 363 200.0 299.5Q150 236 117.0 174.0Q84 112 84 76Q84 46 112 46Q166 46 216.0 86.0Q266 126 305.5 181.5Q345 237 393 318Z","tx":245.56,"sx":253.41,"sy":1.66,"s":0.0488},{"d":"M360 389Q353 389 346.5 395.0Q340 401 332 412Q325 422 313.5 429.0Q302 436 290 436Q261 436 212.0 359.5Q163 283 116 167Q117 144 119.5 109.0Q122 74 123 57L126 17Q126 3 120.0 -7.5Q114 -18 98 -18Q81 -18 76.0 27.5Q71 73 70 160Q69 182 68.5 223.0Q68 264 66 321Q63 407 63 444Q63 467 91 467Q108 467 111.5 452.5Q115 438 115 397V238Q145 315 180.0 371.0Q215 427 248.5 456.5Q282 486 308 486Q330 486 350.0 476.0Q370 466 382.0 450.5Q394 435 394 421Q394 412 381.5 400.5Q369 389 360 389Z","tx":271.36,"sx":279.21,"sy":1.66,"s":0.0488},{"d":"M360 -36Q350 -36 343.0 -31.5Q336 -27 336 -19Q336 22 342 108Q348 200 348 261Q348 320 344.5 357.5Q341 395 328 395Q294 395 253.5 310.5Q213 226 161 88L146 48Q142 38 132.5 32.0Q123 26 113 26Q101 26 97.0 28.0Q93 30 92 40L84 122L69 266Q62 352 52 416Q49 431 49 439Q49 454 62.0 463.5Q75 473 92 473Q102 473 106.5 425.0Q111 377 116 270L120 217Q128 116 129 89Q132 95 134.5 102.5Q137 110 141 119Q195 259 242.5 352.5Q290 446 334 446Q365 446 376.5 393.5Q388 341 391 259Q394 168 394 -7Q394 -19 384.0 -27.5Q374 -36 360 -36Z","tx":291.55,"sx":299.4,"sy":1.66,"s":0.0488},{"d":"M436 240Q436 222 409.5 161.0Q383 100 329.5 48.0Q276 -4 198 -4Q134 -4 91.0 36.0Q48 76 48 159Q48 237 84.0 313.5Q120 390 178.0 438.5Q236 487 298 487Q335 487 360.5 470.5Q386 454 386 423Q386 388 346.5 355.0Q307 322 244.0 297.0Q181 272 114 261Q102 215 102 171Q102 113 129.5 81.0Q157 49 208 49Q285 49 333.0 104.0Q381 159 413 228Q415 232 420.0 243.5Q425 255 429 255Q436 255 436 240ZM286 446Q248 446 213.0 421.0Q178 396 154.5 361.0Q131 326 124 299Q170 304 221.0 325.0Q272 346 306.5 371.0Q341 396 341 412Q341 428 324.5 437.0Q308 446 286 446Z","tx":313.98,"sx":321.83,"sy":1.66,"s":0.0488},{"d":"M161 -34Q118 -34 103.0 -26.0Q88 -18 88 -4Q88 5 111.0 27.5Q134 50 142 50Q154 50 154 45Q154 41 149.0 37.0Q144 33 144 30Q144 26 156.5 22.0Q169 18 187 18Q229 18 271.5 33.5Q314 49 341.0 74.0Q368 99 368 127Q368 154 351.0 170.0Q334 186 308.5 193.5Q283 201 223 215Q157 230 120.5 241.5Q84 253 62.0 270.5Q40 288 40 315Q40 363 87.0 403.0Q134 443 195.0 466.0Q256 489 289 489Q323 489 323 469Q323 457 315.0 442.5Q307 428 291 428Q285 428 278.0 432.5Q271 437 264 437Q244 437 201.0 424.0Q158 411 123.0 385.0Q88 359 88 322Q88 298 115.5 286.5Q143 275 218 258Q227 255 236.0 253.5Q245 252 252 250Q329 232 370.0 209.0Q411 186 411 140Q411 96 375.5 55.5Q340 15 282.0 -9.5Q224 -34 161 -34Z","tx":336.6,"sx":344.45,"sy":1.66,"s":0.0488},{"d":"M161 -34Q118 -34 103.0 -26.0Q88 -18 88 -4Q88 5 111.0 27.5Q134 50 142 50Q154 50 154 45Q154 41 149.0 37.0Q144 33 144 30Q144 26 156.5 22.0Q169 18 187 18Q229 18 271.5 33.5Q314 49 341.0 74.0Q368 99 368 127Q368 154 351.0 170.0Q334 186 308.5 193.5Q283 201 223 215Q157 230 120.5 241.5Q84 253 62.0 270.5Q40 288 40 315Q40 363 87.0 403.0Q134 443 195.0 466.0Q256 489 289 489Q323 489 323 469Q323 457 315.0 442.5Q307 428 291 428Q285 428 278.0 432.5Q271 437 264 437Q244 437 201.0 424.0Q158 411 123.0 385.0Q88 359 88 322Q88 298 115.5 286.5Q143 275 218 258Q227 255 236.0 253.5Q245 252 252 250Q329 232 370.0 209.0Q411 186 411 140Q411 96 375.5 55.5Q340 15 282.0 -9.5Q224 -34 161 -34Z","tx":358.3,"sx":366.15,"sy":1.66,"s":0.0488}];

  var META = (typeof window !== 'undefined' && window.__DSH_SPLASH_META__) || {}
  var CFG = (META.config && typeof META.config === 'object') ? META.config : {}
  var NS = 'http://www.w3.org/2000/svg'
  var HOST_ID = 'dsh-splash-overlay-host'
  var SEEN_KEY = '__dsh_splash_seen__'

  // 每个窗口只放一次：HMR 热重载 / 页面刷新不再重复播放
  // 注意：**标记只在动画真正播完后写下**。桌面壳可能先加载一个占位页再导航到正式页，
  // 若在脚本开头就打标记，正式页会因为「已看过」而整段不播（实测就是这样丢的）。
  try {
    if (window.__DSH_SPLASH_BOOTED__) return
    window.__DSH_SPLASH_BOOTED__ = true
    if (CFG.oncePerSession !== false && sessionStorage.getItem(SEEN_KEY) === '1') return
  } catch (e) {}

  function markSeen() {
    try { sessionStorage.setItem(SEEN_KEY, '1') } catch (e) {}
  }

  function alive() {
    try { return !!(window.__DSH_SPLASH_META__ && window.__DSH_SPLASH_META__.enabled) } catch (e) { return true }
  }

  var host = null
  var shadow = null
  var removed = false

  function teardown() {
    if (removed) return
    removed = true
    try { if (host && host.parentNode) host.parentNode.removeChild(host) } catch (e) {}
    host = null; shadow = null
  }

  function makeHost() {
    var parent = document.body || document.documentElement
    if (!parent) return null
    var el = document.createElement('div')
    el.id = HOST_ID
    el.setAttribute('aria-hidden', 'true')
    // 立在所有界面之上；宿主窗口自身还是隐藏的，用户看到的第一帧就是它
    el.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:2147483647;'
      + 'pointer-events:auto;background:#0b0d12;contain:strict;'
    parent.appendChild(el)
    // position:fixed 只对「没有任何 transform/filter/contain 祖先」的元素才是相对视口。
    // 宿主一旦在 body/html 上挂了变换，覆盖层就会被缩在某个盒子里。
    // 这里按实测矩形做反向补偿，铺满整个视口；尺寸变化时重新贴。
    function fit() {
      try {
        for (var pass = 0; pass < 3; pass++) {
          var r = el.getBoundingClientRect()
          var vw = window.innerWidth || document.documentElement.clientWidth
          var vh = window.innerHeight || document.documentElement.clientHeight
          el.style.width = vw + 'px'
          el.style.height = vh + 'px'
          var dx = -r.left, dy = -r.top
          el.style.left = (parseFloat(el.style.left) || 0) + dx + 'px'
          el.style.top = (parseFloat(el.style.top) || 0) + dy + 'px'
          if (Math.abs(r.width - vw) < 1.5 && Math.abs(r.height - vh) < 1.5) break
        }
      } catch (e) {}
    }
    fit()
    try { window.addEventListener('resize', fit) } catch (e) {}
    setTimeout(fit, 80)
    setTimeout(fit, 320)
    setTimeout(fit, 900)
    return el
  }

  try {
    host = makeHost()
    if (!host) return
    shadow = host.attachShadow ? host.attachShadow({ mode: 'closed' }) : null
    if (!shadow) { teardown(); return }
    var style = document.createElement('style')
    style.textContent = CSS
    shadow.appendChild(style)
    var wrap = document.createElement('div')
    wrap.className = 'splash-root'
    wrap.innerHTML = MARKUP
    shadow.appendChild(wrap)
  } catch (e) {
    teardown()
    return
  }

  var $ = function (id) { try { return shadow.getElementById(id) } catch (e) { return null } }
  var statusEl = null
  try { statusEl = shadow.querySelector('.status') } catch (e) { statusEl = null }

  // 节奏：窗口一出现就几乎立刻起笔（不再留 1 秒多的空场）
  var WRITE_START = 320, DUR = 360, STAGGER = 285, T_LOGO = 4900, T_FADE = T_LOGO + 1250
  var started = false, finished = false

  function setVersion() {
    var el = $('ver')
    if (!el) return
    var v = META.version ? String(META.version) : ''
    if (v) el.textContent = 'v' + v
  }

  setVersion()

  // ── 跑马灯点阵依次起跑 ──
  var dots = shadow.querySelectorAll('.marquee i')
  for (var i = 0; i < dots.length; i++) dots[i].style.animationDelay = (i * 0.075) + 's'

  // ── 构建路径：每个字母 = 辉光底 + 亮白笔画 + 笔尖 ──
  var glowG = $('glow'), inkG = $('ink'), pensG = $('pens')
  var items = []
  if (glowG && inkG && pensG) {
    for (var j = 0; j < GLYPHS.length; j++) {
      var g = GLYPHS[j]
      var glow = document.createElementNS(NS, 'path')
      glow.setAttribute('d', g.d)
      glow.setAttribute('transform', 'translate(' + g.tx + ',0) scale(' + g.s + ',' + (-g.s) + ')')
      glowG.appendChild(glow)
      var ink = document.createElementNS(NS, 'path')
      ink.setAttribute('d', g.d)
      ink.setAttribute('transform', 'translate(' + g.tx + ',0) scale(' + g.s + ',' + (-g.s) + ')')
      inkG.appendChild(ink)
      var halo = document.createElementNS(NS, 'circle')
      halo.setAttribute('r', 5.5); halo.setAttribute('class', 'pen-halo')
      var pen = document.createElementNS(NS, 'circle')
      pen.setAttribute('r', 2.4); pen.setAttribute('class', 'pen')
      pensG.appendChild(halo); pensG.appendChild(pen)
      items.push({ ink: ink, glow: glow, halo: halo, pen: pen, L: 0, start: WRITE_START + j * STAGGER })
    }
  }

  // 量取路径长度。注意：窗口还隐藏时宿主可能尚未完成布局，getTotalLength() 会返回 0，
  // 这时不能把 dasharray 写成 "0 0"（会整条描边亮出来）。所以只在长度有效时才落样式，
  // 并把「量不到」交给调用方在后续帧里重试。
  function measure() {
    var ok = 0
    for (var k = 0; k < items.length; k++) {
      var it = items[k]
      try {
        it.L = it.ink.getTotalLength()
      } catch (e) { it.L = 0 }
      if (!it.L || !isFinite(it.L)) { it.L = 0; continue }
      ok++
      it.ink.style.strokeDasharray = it.L + ' ' + it.L
      it.ink.style.strokeDashoffset = it.L
      it.glow.style.strokeDasharray = it.L + ' ' + it.L
      it.glow.style.strokeDashoffset = it.L
    }
    return ok
  }

  function fadeOut(after) {
    if (finished) return
    finished = true
    markSeen()
    try { if (host) host.style.transition = 'opacity .42s ease'; host.style.opacity = '0' } catch (e) {}
    setTimeout(function () { teardown(); if (typeof after === 'function') after() }, 460)
  }

  function animate() {
    if (started || finished || !alive()) return
    started = true
    var t0 = null
    var tries = 0
    var degraded = false
    function frame(ts) {
      if (finished) return
      // 首帧先量长度：此时布局一定已经发生过，量不到就等下一帧再试（最多 ~2 秒）
      if (t0 === null) {
        if (!items.length) { t0 = ts } else {
          var ok = 0
          try { ok = measure() } catch (e) { ok = 0 }
          if (ok === 0) {
            if (tries++ < 120) { requestAnimationFrame(frame); return }
            // 实在量不到：退化成「整体淡入」，至少不出现整条描边的怪样子
            degraded = true
            for (var q = 0; q < items.length; q++) {
              try { items[q].ink.classList.add('done') } catch (e2) {}
            }
          }
          t0 = ts
        }
      }
      var now = ts - t0
      for (var m = 0; m < items.length; m++) {
        var p = items[m]
        if (!p.L) continue
        var t = (now - p.start) / DUR
        if (t < 0) continue
        if (t < 1) {
          var e = 1 - Math.pow(1 - t, 3) // easeOutCubic：起笔快、收笔稳
          p.ink.style.strokeDashoffset = p.L * (1 - e)
          p.glow.style.strokeDashoffset = p.L * (1 - e)
          var pt = p.ink.getPointAtLength(p.L * e)
          p.pen.setAttribute('cx', pt.x); p.pen.setAttribute('cy', pt.y)
          p.halo.setAttribute('cx', pt.x); p.halo.setAttribute('cy', pt.y)
          p.pen.style.opacity = 1; p.halo.style.opacity = 1
        } else if (!p.done) {
          p.done = true
          p.ink.style.strokeDashoffset = 0
          p.glow.style.strokeDashoffset = 0
          p.ink.classList.add('done')
          p.pen.style.opacity = 0; p.halo.style.opacity = 0
        }
      }
      if (now > T_LOGO || degraded) {
        var lg = $('logo'), ul = $('underline'), mq = $('marquee')
        if (lg) lg.classList.add('on')
        if (ul) ul.classList.add('on')
        if (mq) mq.classList.add('dim')
        if (statusEl && statusEl.textContent !== '就绪') statusEl.textContent = '就绪'
      }
      if (now > T_FADE || (degraded && now > 2200)) { fadeOut(); return }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  // ── 起跑时机 ──
  // 越早越好：脚本一落地就排一帧，宿主把窗口显示出来的那一刻 rAF 就会回调 → 立刻起笔。
  // （窗口隐藏时 Chromium 不回调 rAF，所以「等到 rAF」天然等价于「等到真的可见」。）
  var kicked = false
  function kick() {
    if (kicked || finished) return
    kicked = true
    if (alive()) animate(); else fadeOut()
  }

  // 点击行为：默认**不跳过**——加载期间点界面不该让主页面直接跳出来。
  // 只有显式配置 clickToSkip=true 时，点击才收掉画面。
  host.addEventListener('mousedown', function (e) {
    if (CFG.clickToSkip === true) { if (started) fadeOut(); else kick(); return }
    e.preventDefault(); e.stopPropagation()
  }, true)
  host.addEventListener('click', function (e) {
    if (CFG.clickToSkip === true) return
    e.preventDefault(); e.stopPropagation()
  }, true)
  host.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation() }, true)

  requestAnimationFrame(kick)
  try {
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') kick()
    })
  } catch (e) {}
  setTimeout(kick, 1500)   // 兜底：rAF 被节流时也不至于一直不开始

  // 硬保险：20 秒后无论动画演到哪都收掉，绝不挡住界面
  setTimeout(function () { fadeOut() }, 20000)
})();
