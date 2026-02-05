/***********************
  Minyoung Maker v2
  - 4 stages
  - Mood system (neutral/happy/sad/angry)
  - Random popup questions that affect mood (+ hidden rewards/penalties)
  - Shop hides affection values
  - Gift makes Minyoung happy sprite immediately
************************/

const $ = (id) => document.getElementById(id);

const VIEWS = {
  home: $("view-home"),
  minigames: $("view-minigames"),
  shop: $("view-shop"),
  game: $("view-game")
};

const SAVE_KEY = "minyoungMakerSave_v2";

const state = {
  hearts: 0,
  affection: 0,
  stage: 1,
  mood: "neutral",            // neutral | happy | sad | angry
  inventory: [],
  affectionMult: 1.0,
  flags: {},
  // prevents popup spam
  popupCooldown: 0
};

const STAGE_LABELS = {
  1: "Stage 1: Toddler",
  2: "Stage 2: Child",
  3: "Stage 3: College",
  4: "Stage 4: Adult"
};

function save() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}
function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.assign(state, data);
    state.inventory ||= [];
    state.flags ||= {};
    state.affectionMult ||= 1.0;
    state.mood ||= "neutral";
    state.popupCooldown ||= 0;
  } catch {}
}

function speak(msg) {
  $("dialogue").innerText = msg;
}

function showView(name) {
  Object.values(VIEWS).forEach(v => v.classList.add("hidden"));
  VIEWS[name].classList.remove("hidden");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** mood handling */
function setMood(newMood, opts = { flashMs: 1200, persist: true }) {
  const allowed = ["neutral","happy","sad","angry"];
  if (!allowed.includes(newMood)) newMood = "neutral";
  state.mood = newMood;
  save();
  renderHUD();

  // optional: auto-calm back to neutral after a bit (still counts as "status" while shown)
  if (!opts.persist && newMood !== "neutral") {
    setTimeout(() => {
      state.mood = "neutral";
      save();
      renderHUD();
    }, opts.flashMs ?? 1200);
  }
}

/** sprite */
function setCharacterSprite(stage, mood = "neutral") {
  const img = $("character");

  // Try mood file first
  const moodPath = `assets/characters/stage${stage}-${mood}.png`;
  const neutralPath = `assets/characters/stage${stage}-neutral.png`;

  img.onerror = () => {
    // fallback to neutral if mood file missing
    img.onerror = () => {
      img.removeAttribute("src");
      img.alt = "Missing sprite. Add assets/characters/stage1-neutral.png etc.";
    };
    img.src = neutralPath;
  };

  img.src = moodPath;
}

/** rewards */
function addRewards(heartsEarned, affectionEarned) {
  state.hearts += heartsEarned;

  // affection gets perfume multiplier
  const boosted = Math.round(affectionEarned * state.affectionMult);
  state.affection += boosted;

  // small mood drift: if she’s angry/sad, small affection gains calm her slightly
  if (state.mood === "angry" && boosted >= 6 && Math.random() < 0.35) setMood("neutral");
  if (state.mood === "sad" && boosted >= 4 && Math.random() < 0.40) setMood("neutral");

  save();
  renderHUD();
}

/***********************
  Popup Questions (not obvious)
************************/

const POPUPS = [
  {
    title: "A tiny decision appears…",
    text: "Minyoung is staring at the fridge like it personally offended her.\nWhat do you do?",
    options: [
      { label: "Say nothing. Quietly rearrange the fridge like a stealth ninja.", mood: "happy", hearts: +2, affection: +3 },
      { label: "Offer a serious speech about food organization and discipline.", mood: "angry", hearts: +1, affection: -2 }
    ]
  },
  {
    title: "Side quest moment",
    text: "Minyoung sends a single message:\n“🙂”\nWhat is your response?",
    options: [
      { label: "Reply with a picture of something that reminds you of her.", mood: "happy", hearts: +1, affection: +4 },
      { label: "Reply: “What does this mean” like a confused detective.", mood: "sad", hearts: +2, affection: -1 }
    ]
  },
  {
    title: "Unexpected test",
    text: "Minyoung is quiet on the couch. She looks fine but… suspiciously fine.\nWhat do you do?",
    options: [
      { label: "Sit next to her and match her silence. Just presence.", mood: "happy", hearts: 0, affection: +5 },
      { label: "Cheerfully narrate everything you’re doing in detail.", mood: "angry", hearts: +2, affection: -2 }
    ]
  },
  {
    title: "A micro-drama",
    text: "Minyoung says: “I had a long day.”\nPick the move.",
    options: [
      { label: "Ask one gentle question and then offer food.", mood: "happy", hearts: +1, affection: +4 },
      { label: "Immediately suggest a productivity system.", mood: "sad", hearts: +2, affection: -1 }
    ]
  },
  {
    title: "Confusing but important",
    text: "Minyoung points at a random object and goes:\n“This has my vibe.”\nYou…",
    options: [
      { label: "Agree instantly and treat it like sacred lore.", mood: "happy", hearts: +2, affection: +3 },
      { label: "Ask for a rubric so you can understand the vibe categories.", mood: "angry", hearts: +1, affection: -2 }
    ]
  }
];

function maybePopup(context = "any") {
  // cooldown to reduce spam
  if (state.popupCooldown > 0) {
    state.popupCooldown -= 1;
    save();
    return;
  }

  // chance to appear
  const chance = (context === "afterGame") ? 0.55 : (context === "afterGift") ? 0.35 : 0.25;
  if (Math.random() > chance) return;

  const pick = POPUPS[Math.floor(Math.random() * POPUPS.length)];
  openPopup(pick);

  // set cooldown for next few actions
  state.popupCooldown = 2;
  save();
}

function openPopup(popup) {
  const modal = $("modal");
  $("modalTitle").innerText = popup.title;
  $("modalText").innerText = popup.text;

  const actions = $("modalActions");
  actions.innerHTML = "";

  popup.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.innerText = opt.label;

    btn.addEventListener("click", () => {
      closePopup();

      // apply hidden effects
      if (typeof opt.hearts === "number") state.hearts += opt.hearts;
      if (typeof opt.affection === "number") {
        const boosted = Math.round(opt.affection * state.affectionMult);
        state.affection += boosted;
      }

      setMood(opt.mood, { persist: true });
      save();
      renderHUD();

      // little reaction line
      const reaction = {
        happy: "Minyoung looks pleased. Like… dangerously pleased 💗",
        sad: "Minyoung goes quiet. You feel like you missed something 😭",
        angry: "Minyoung is smiling… but it’s the kind that’s a warning 🙂",
        neutral: "Minyoung nods. The vibe is… stable."
      }[opt.mood];

      speak(reaction);
    });

    actions.appendChild(btn);
  });

  // add a subtle “do nothing” close for safety
  const skip = document.createElement("button");
  skip.className = "btn ghost";
  skip.innerText = "Ignore (risky)";
  skip.addEventListener("click", () => {
    closePopup();
    speak("You ignored the moment. The universe is taking notes.");
  });
  actions.appendChild(skip);

  modal.classList.remove("hidden");
}

function closePopup() {
  $("modal").classList.add("hidden");
}

/***********************
  HUD + Growth
************************/

function renderHUD() {
  $("hearts").innerText = state.hearts;
  $("affection").innerText = state.affection;
  $("stage").innerText = state.stage;
  $("mood").innerText = state.mood;

  setCharacterSprite(state.stage, state.mood);
  $("stageLabel").innerText = STAGE_LABELS[state.stage] || `Stage ${state.stage}`;

  const passives = [];
  if (state.flags.perfume) passives.push("Perfume passive: +10% affection gains");
  if (state.flags.tennisBall) passives.push("Tennis Ball passive: some bad moments become funny memories");
  if (state.flags.safeSleepy) passives.push("Forehead Blanket: Safe & Sleepy unlocked");
  $("passivesNote").innerText = passives.join(" • ");

  const inv = $("inventoryList");
  inv.innerHTML = "";
  if (state.inventory.length === 0) {
    inv.innerHTML = `<span class="small">No items yet. Nate, go spoil her 😌</span>`;
  } else {
    state.inventory.slice().reverse().forEach(name => {
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.innerText = name;
      inv.appendChild(pill);
    });
  }
}

function evolveCheck() {
  if (state.stage === 1 && state.affection >= 25) return evolveTo(2, "Minyoung grew into a bright, curious kid 🎀");
  if (state.stage === 2 && state.affection >= 60) return evolveTo(3, "Minyoung entered her college era: confident and chaotic ✨");
  if (state.stage === 3 && state.affection >= 120) return evolveTo(4, "Minyoung leveled up into her adult form: unstoppable 🌷");

  speak("Minyoung is still growing… keep earning hearts and making her laugh 💗");
  maybePopup("home");
}

function evolveTo(stage, msg) {
  state.stage = stage;
  save();
  renderHUD();

  // quick happy flash
  const prevMood = state.mood;
  setMood("happy", { persist: false, flashMs: 1300 });
  setTimeout(() => {
    // go back to previous mood (unless it changed during popup)
    if (state.mood === "neutral") setMood(prevMood, { persist: true });
  }, 1400);

  speak(msg);
  maybePopup("home");
}

/***********************
  SHOP (hidden affection values)
************************/

const SHOP_ITEMS = [
  {
    id: "perfume",
    name: `🐾 “Drake Memory” Perfume (Anal Glands Scented)`,
    cost: 90,
    affectionHidden: 75,
    type: "Soul Item",
    desc: `A ridiculously named scent that somehow smells warm and comforting instead of questionable.
When worn, Minyoung gains the passive ability “Love That Never Leaves,” increasing all affection gains by 10% for the rest of the year.`,
    flavor: `"Some loves don’t fade. They just change form."`,
    unique: true,
    onBuy() {
      state.flags.perfume = true;
      state.affectionMult = 1.1;
    }
  },
  {
    id: "tennisBall",
    name: `🎾 Fudge’s Blessed Tennis Ball`,
    cost: 80,
    affectionHidden: 65,
    type: "Companion Relic",
    desc: `Slightly slobbery. Extremely sacred. Holding it instantly restores Minyoung’s mood and prevents one bad day per month.

Special Ability: Unlocks “Golden Retriever Energy”
→ negative events have a 30% chance to turn into funny memories.`,
    flavor: `"Joy is loud, neon, and covered in dog hair."`,
    unique: true,
    onBuy() { state.flags.tennisBall = true; }
  },
  {
    id: "persimmon",
    name: `🌅 Perfectly Ripe Persimmon (감)`,
    cost: 30,
    affectionHidden: 25,
    type: "Seasonal Treasure",
    desc: `Honey-sweet and nostalgic. Eating it grants a temporary buff called Autumn Heart, making Minyoung extra reflective and affectionate.

Hidden Effect:
If gifted unexpectedly → something good might happen.`,
    flavor: `"Sweetness arrives quietly."`,
    unique: false,
    onBuy() {
      if (Math.random() < 0.30) state.affection += 10;
    }
  },
  {
    id: "squid",
    name: `🦑 Dangerously Addictive Dried Squid (가문어)`,
    cost: 22,
    affectionHidden: 18,
    type: "Snack Buff",
    desc: `Chewy, savory, impossible to stop eating. Restores energy after long workdays.

Combo Bonus:
Pairs with Movie Night → something happens.`,
    flavor: `"Just one more bite… probably."`,
    unique: false,
    onBuy() { state.flags.squid = true; }
  },
  {
    id: "dinner",
    name: `🥡 “I Brought You Dinner”`,
    cost: 24,
    affectionHidden: 18,
    type: "Couple Move",
    desc: `Shows up with your favorite takeout after a long day without being asked.

Hidden Bonus:
If he remembered the exact order…`,
    flavor: `"You looked tired. So I handled dinner."`,
    unique: false,
    onBuy() { if (Math.random() < 0.35) state.affection += 5; }
  },
  {
    id: "coffee",
    name: `☕ Morning Coffee Delivery`,
    cost: 18,
    affectionHidden: 12,
    type: "Couple Move",
    desc: `A warm cup placed gently next to you before you fully wake up.

Passive Effect:
Reduces morning grumpiness.`,
    flavor: `"You don’t have to open your eyes yet."`,
    unique: false
  },
  {
    id: "couch",
    name: `🛋️ Couch Cuddle`,
    cost: 14,
    affectionHidden: 10,
    type: "Cozy",
    desc: `No phones. No scrolling. Just leaning into each other.`,
    flavor: `"Nothing happened. And it was perfect."`,
    unique: false
  },
  {
    id: "sawThis",
    name: `📦 “Saw This and Thought of You”`,
    cost: 20,
    affectionHidden: 15,
    type: "Thoughtful",
    desc: `A small, random object that proves you live in his brain.`,
    flavor: `"It had your energy."`,
    unique: false,
    onBuy() { state.affection += Math.floor(Math.random() * 9); }
  },
  {
    id: "fruit",
    name: `🍓 Fruit Cut Into Perfect Pieces`,
    cost: 22,
    affectionHidden: 18,
    type: "Care",
    desc: `Was it necessary? No. Did he do it anyway? Yes.`,
    flavor: `"Eat. I know you forget."`,
    unique: false,
    onBuy() { if (Math.random() < 0.50) state.affection += 4; }
  },
  {
    id: "lastOne",
    name: `🍪 Saved You the Last One`,
    cost: 26,
    affectionHidden: 20,
    type: "Trust",
    desc: `The final cookie. Untouched. Protected from himself.`,
    flavor: `"I was tempted. Be proud."`,
    unique: false
  },
  {
    id: "photo",
    name: `📸 “You Look Cute, Don’t Move” Photo`,
    cost: 20,
    affectionHidden: 17,
    type: "Memory",
    desc: `You insist you look chaotic. She insists you look perfect.`,
    flavor: `"I want to remember this version of you."`,
    unique: false
  },
  {
    id: "foreheadKiss",
    name: `💤 Forehead Kiss`,
    cost: 28,
    affectionHidden: 21,
    type: "Security",
    desc: `Gentle. Unrushed. Usually when you least expect it.`,
    flavor: `"Right here is my favorite place."`,
    unique: false
  },
  {
    id: "foreheadBlanket",
    name: `🌙 Forehead Blanket`,
    cost: 30,
    affectionHidden: 23,
    type: "Cozy Item",
    desc: `A gentle hand rests across your forehead, shielding your eyes from the world.

Primary Effect:
Activates “Safe & Sleepy”.`,
    flavor: `"Rest. I’ve got the watch."`,
    unique: true,
    onBuy() { state.flags.safeSleepy = true; }
  }
];

function renderShop() {
  const root = $("shopList");
  root.innerHTML = "";

  SHOP_ITEMS.forEach(item => {
    const ownedUnique = item.unique && state.inventory.includes(item.name);

    const el = document.createElement("div");
    el.className = "shop-item";
    el.innerHTML = `
      <div class="shop-top">
        <div>
          <div class="shop-name">${item.name}</div>
          <div class="shop-meta">
            <div><strong>Type:</strong> ${item.type}</div>
            <div class="small" style="margin-top:6px; white-space:pre-line;">${item.desc}</div>
            <div class="small" style="margin-top:6px;"><em>${item.flavor}</em></div>
          </div>
        </div>
        <div class="shop-actions">
          <div class="cost">Cost: 💗 ${item.cost}</div>
          <button class="btn ${ownedUnique ? "ghost": ""}" ${ownedUnique ? "disabled": ""} data-buy="${item.id}">
            ${ownedUnique ? "Owned" : "Buy"}
          </button>
        </div>
      </div>
    `;
    root.appendChild(el);
  });

  root.querySelectorAll("[data-buy]").forEach(btn => {
    btn.addEventListener("click", () => buyItem(btn.getAttribute("data-buy")));
  });
}

function buyItem(id) {
  const item = SHOP_ITEMS.find(x => x.id === id);
  if (!item) return;

  const ownedUnique = item.unique && state.inventory.includes(item.name);
  if (ownedUnique) return;

  if (state.hearts < item.cost) {
    speak("Not enough hearts 😭 Go play mini games and come back.");
    return;
  }

  state.hearts -= item.cost;

  // hidden affection value
  const hidden = item.affectionHidden ?? 0;
  const boosted = Math.round(hidden * state.affectionMult);
  state.affection += boosted;

  state.inventory.push(item.name);
  if (typeof item.onBuy === "function") item.onBuy();

  // Gift reaction: happy sprite immediately
  setMood("happy", { persist: true });
  speak("Minyoung received a gift… and her mood instantly improved 💗");

  save();
  renderHUD();
  renderShop();

  // chance of a follow-up popup
  maybePopup("afterGift");
}

/***********************
  NAV
************************/

$("btnMiniGames").addEventListener("click", () => showView("minigames"));

$("btnShop").addEventListener("click", () => {
  renderShop();
  showView("shop");
});

$("btnCheckGrowth").addEventListener("click", () => evolveCheck());

$("btnReset").addEventListener("click", () => {
  localStorage.removeItem(SAVE_KEY);
  location.reload();
});

document.querySelectorAll("[data-nav]").forEach(btn => {
  btn.addEventListener("click", () => {
    const where = btn.getAttribute("data-nav");
    if (where === "home") {
      showView("home");
      renderHUD();
      if (Math.random() < 0.25) maybePopup("home");
    }
  });
});

/***********************
  MINI GAMES (same 5 as before, with mood+popup hooks)
************************/

let stopCurrentGame = null;

$("btnQuitGame").addEventListener("click", () => {
  if (stopCurrentGame) stopCurrentGame();
  stopCurrentGame = null;
  showView("minigames");
});

document.querySelectorAll("[data-game]").forEach(btn => {
  btn.addEventListener("click", () => startGame(btn.getAttribute("data-game")));
});

function startGame(key) {
  showView("game");
  const area = $("gameArea");
  area.innerHTML = "";
  stopCurrentGame = null;

  if (key === "catch") return gameCatch(area);
  if (key === "pop") return gamePop(area);
  if (key === "memory") return gameMemory(area);
  if (key === "typing") return gameTyping(area);
  if (key === "react") return gameReact(area);
}

/* Game 1: Catch the Hearts */
function gameCatch(root) {
  $("gameTitle").innerText = "💗 Catch the Hearts";

  root.innerHTML = `
    <div class="game-frame">
      <div class="row">
        <div>Move with <span class="kbd">←</span> <span class="kbd">→</span> • 20 seconds</div>
        <div><strong id="catchScore">0</strong> caught</div>
      </div>
      <canvas class="canvas" id="catchCanvas" width="620" height="320"></canvas>
      <div class="center small" style="margin-top:10px;" id="catchMsg"></div>
    </div>
  `;

  const c = $("catchCanvas");
  const ctx = c.getContext("2d");
  let running = true;
  let tLeft = 20000;
  let last = performance.now();
  let score = 0;

  const basket = { x: 310, y: 275, w: 90, h: 20, vx: 0 };
  const hearts = [];
  const spawnEvery = 450;
  let spawnTimer = 0;

  function spawn() {
    hearts.push({ x: Math.random() * (c.width - 20) + 10, y: -10, r: 10, vy: 90 + Math.random() * 120 });
  }

  function drawHeart(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, r/2);
    ctx.bezierCurveTo(-r, -r/2, -r, r, 0, r*1.6);
    ctx.bezierCurveTo(r, r, r, -r/2, 0, r/2);
    ctx.fillStyle = "rgba(255,77,136,.95)";
    ctx.fill();
    ctx.restore();
  }

  function loop(now) {
    if (!running) return;
    const dt = (now - last) / 1000;
    last = now;
    tLeft -= dt * 1000;

    spawnTimer += dt * 1000;
    if (spawnTimer >= spawnEvery) {
      spawnTimer = 0;
      spawn();
    }

    basket.x += basket.vx * dt;
    basket.x = Math.max(0, Math.min(c.width - basket.w, basket.x));

    for (const h of hearts) {
      h.y += h.vy * dt;

      const hit =
        h.x > basket.x &&
        h.x < basket.x + basket.w &&
        h.y + h.r > basket.y &&
        h.y - h.r < basket.y + basket.h;

      if (hit) {
        score += 1;
        h.y = 9999;
      }
    }

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.fillRect(0, 0, c.width, c.height);

    ctx.fillStyle = "rgba(255,111,165,.95)";
    ctx.fillRect(basket.x, basket.y, basket.w, basket.h);
    ctx.fillRect(basket.x + 10, basket.y - 10, basket.w - 20, 10);

    for (const h of hearts) drawHeart(h.x, h.y, h.r);

    for (let i = hearts.length - 1; i >= 0; i--) {
      if (hearts[i].y > c.height + 30) hearts.splice(i, 1);
      else if (hearts[i].y > 9000) hearts.splice(i, 1);
    }

    $("catchScore").innerText = score;

    if (tLeft <= 0) return end();
    requestAnimationFrame(loop);
  }

  function end() {
    running = false;
    const heartsEarned = clamp(score * 2, 5, 40);
    const affectionEarned = Math.max(2, Math.round(score * 1.2));
    addRewards(heartsEarned, affectionEarned);

    $("catchMsg").innerText = `Result: +${heartsEarned} hearts 💗`;
    speak("Minyoung: “Okay wait… that was kind of satisfying.”");

    // mood nudge (not obvious)
    if (score >= 10) setMood("happy");
    else if (score <= 2 && Math.random() < 0.35) setMood("sad");

    maybePopup("afterGame");
  }

  function onKey(e) {
    if (e.key === "ArrowLeft") basket.vx = -260;
    if (e.key === "ArrowRight") basket.vx = 260;
  }
  function onKeyUp(e) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") basket.vx = 0;
  }

  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);

  stopCurrentGame = () => {
    running = false;
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("keyup", onKeyUp);
  };

  requestAnimationFrame(loop);
}

/* Game 2: Pop the Hearts */
function gamePop(root) {
  $("gameTitle").innerText = "🫧 Pop the Hearts";

  root.innerHTML = `
    <div class="game-frame">
      <div class="row">
        <div>Click hearts • 15 seconds</div>
        <div>Popped: <strong id="popScore">0</strong></div>
      </div>
      <div id="popField" style="position:relative; height:320px; border-radius:16px; border:1px dashed rgba(255,77,136,.35); background:rgba(255,255,255,.65); overflow:hidden; margin-top:10px;"></div>
      <div class="center small" style="margin-top:10px;" id="popMsg"></div>
    </div>
  `;

  let running = true;
  let score = 0;
  const field = $("popField");

  function spawnHeart() {
    if (!running) return;
    const h = document.createElement("button");
    h.style.position = "absolute";
    h.style.left = `${Math.random() * 88 + 2}%`;
    h.style.top = `${Math.random() * 70 + 10}%`;
    h.style.border = "none";
    h.style.background = "transparent";
    h.style.cursor = "pointer";
    h.style.fontSize = `${Math.random() * 18 + 22}px`;
    h.innerText = "💗";
    h.addEventListener("click", () => {
      if (!running) return;
      score++;
      $("popScore").innerText = String(score);
      h.remove();
    });
    field.appendChild(h);
    setTimeout(() => h.remove(), 900);
  }

  const spawnInterval = setInterval(spawnHeart, 260);
  const timer = setTimeout(() => end(), 15000);

  function end() {
    running = false;
    clearInterval(spawnInterval);
    clearTimeout(timer);
    field.querySelectorAll("button").forEach(b => b.remove());

    const heartsEarned = clamp(score * 3, 6, 45);
    const affectionEarned = Math.max(2, Math.round(score * 1.4));
    addRewards(heartsEarned, affectionEarned);

    $("popMsg").innerText = `Result: +${heartsEarned} hearts 💗`;
    speak("Minyoung: “Why was that actually addictive.”");

    if (score >= 12) setMood("happy");
    else if (score <= 3 && Math.random() < 0.25) setMood("angry");

    maybePopup("afterGame");
  }

  stopCurrentGame = () => {
    running = false;
    clearInterval(spawnInterval);
    clearTimeout(timer);
  };
}

/* Game 3: Memory Match */
function gameMemory(root) {
  $("gameTitle").innerText = "🃏 Memory Match";

  const icons = ["💗","🍓","🐾","🍲","🎾","🌙","📸","🦑"];
  const deck = [...icons, ...icons].sort(() => Math.random() - 0.5);

  root.innerHTML = `
    <div class="game-frame">
      <div class="row">
        <div>Match all pairs</div>
        <div>Matches: <strong id="memMatches">0</strong>/8</div>
      </div>
      <div id="memGrid" style="display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:12px;"></div>
      <div class="center small" style="margin-top:10px;" id="memMsg"></div>
    </div>
  `;

  const grid = $("memGrid");
  let first = null;
  let lock = false;
  let matches = 0;
  let misses = 0;

  function makeCard(i) {
    const btn = document.createElement("button");
    btn.className = "tile";
    btn.style.textAlign = "center";
    btn.style.fontSize = "22px";
    btn.style.padding = "16px 10px";
    btn.dataset.val = deck[i];
    btn.dataset.open = "0";
    btn.innerText = "❔";
    btn.addEventListener("click", () => onFlip(btn));
    return btn;
  }

  function onFlip(card) {
    if (lock) return;
    if (card.dataset.open === "1") return;

    card.dataset.open = "1";
    card.innerText = card.dataset.val;

    if (!first) { first = card; return; }

    if (first.dataset.val === card.dataset.val) {
      matches++;
      $("memMatches").innerText = String(matches);
      first = null;
      if (matches >= 8) end();
      return;
    }

    misses++;
    lock = true;
    setTimeout(() => {
      first.dataset.open = "0";
      first.innerText = "❔";
      card.dataset.open = "0";
      card.innerText = "❔";
      first = null;
      lock = false;
    }, 700);
  }

  deck.forEach((_, i) => grid.appendChild(makeCard(i)));

  function end() {
    const heartsEarned = 40;
    const affectionEarned = 18;
    addRewards(heartsEarned, affectionEarned);

    $("memMsg").innerText = `Cleared: +${heartsEarned} hearts 💗`;
    speak("Minyoung: “You remembered the tiny things. That’s… unfairly cute.”");

    if (misses <= 6) setMood("happy");
    else if (misses >= 14 && Math.random() < 0.35) setMood("sad");

    maybePopup("afterGame");
  }

  stopCurrentGame = () => {};
}

/* Game 4: Love Typing */
function gameTyping(root) {
  $("gameTitle").innerText = "⌨️ Love Typing";

  const prompts = [
    "happy valentine’s minyoung",
    "i brought you dinner",
    "forehead blanket pls",
    "shabu shabu tonight",
    "you look cute don’t move"
  ];

  let idx = 0;
  let score = 0;
  let running = true;

  root.innerHTML = `
    <div class="game-frame">
      <div class="row">
        <div>Type the phrase exactly • 30 seconds</div>
        <div>Score: <strong id="typeScore">0</strong></div>
      </div>

      <div style="margin-top:12px; font-weight:900; color:#333;" id="typePrompt"></div>
      <input id="typeInput" style="width:100%; margin-top:10px; padding:12px; border-radius:14px; border:1px solid rgba(255,77,136,.25);" placeholder="type here..." />
      <div class="center small" style="margin-top:10px;" id="typeMsg"></div>
    </div>
  `;

  const promptEl = $("typePrompt");
  const input = $("typeInput");

  function nextPrompt() {
    promptEl.innerText = prompts[idx % prompts.length];
    input.value = "";
    input.focus();
  }
  nextPrompt();

  input.addEventListener("keydown", (e) => {
    if (!running) return;
    if (e.key !== "Enter") return;

    const target = promptEl.innerText.trim();
    const typed = input.value.trim();

    if (typed === target) {
      score++;
      $("typeScore").innerText = String(score);
      idx++;
      nextPrompt();
    } else {
      input.value = "";
    }
  });

  const timer = setTimeout(() => end(), 30000);

  function end() {
    running = false;
    clearTimeout(timer);

    const heartsEarned = clamp(score * 10, 10, 50);
    const affectionEarned = Math.max(5, Math.round(score * 4));
    addRewards(heartsEarned, affectionEarned);

    $("typeMsg").innerText = `Result: +${heartsEarned} hearts 💗`;
    speak("Minyoung: “Stop… you’re actually good at this 😳”");

    if (score >= 4) setMood("happy");
    else if (score === 0 && Math.random() < 0.35) setMood("angry");

    maybePopup("afterGame");
  }

  stopCurrentGame = () => {
    running = false;
    clearTimeout(timer);
  };
}

/* Game 5: Reaction Heart */
function gameReact(root) {
  $("gameTitle").innerText = "⚡ Reaction Heart";

  let round = 0;
  let score = 0;
  let canClick = false;
  let running = true;
  let timeoutId = null;

  root.innerHTML = `
    <div class="game-frame">
      <div class="row">
        <div>Click only when the heart turns 💗 (5 rounds)</div>
        <div>Wins: <strong id="reactScore">0</strong></div>
      </div>

      <div class="center" style="margin-top:16px;">
        <button id="reactBtn" style="font-size:44px; background:transparent; border:none; cursor:pointer;">🤍</button>
      </div>

      <div class="center small" id="reactMsg" style="margin-top:10px;"></div>
    </div>
  `;

  const btn = $("reactBtn");
  const msg = $("reactMsg");

  function nextRound() {
    if (!running) return;
    round++;
    canClick = false;
    btn.innerText = "🤍";
    msg.innerText = `Round ${round}/5… wait for it…`;

    const delay = 900 + Math.random() * 1800;
    timeoutId = setTimeout(() => {
      canClick = true;
      btn.innerText = "💗";
      msg.innerText = "NOW!";

      timeoutId = setTimeout(() => {
        if (canClick) {
          canClick = false;
          msg.innerText = "Too slow 😭";
          setTimeout(() => {
            if (round >= 5) end();
            else nextRound();
          }, 700);
        }
      }, 650);
    }, delay);
  }

  btn.addEventListener("click", () => {
    if (!running) return;
    if (canClick) {
      score++;
      $("reactScore").innerText = String(score);
      canClick = false;
      msg.innerText = "Nice 😌";
      clearTimeout(timeoutId);
      setTimeout(() => {
        if (round >= 5) end();
        else nextRound();
      }, 650);
    } else {
      msg.innerText = "False start… suspicious 😭";
    }
  });

  function end() {
    running = false;
    clearTimeout(timeoutId);

    const heartsEarned = 12 + score * 8;
    const affectionEarned = 6 + score * 3;
    addRewards(heartsEarned, affectionEarned);

    msg.innerText = `Result: +${heartsEarned} hearts 💗`;
    speak("Minyoung: “Your reflexes are… boyfriend-coded.”");

    if (score >= 4) setMood("happy");
    else if (score <= 1 && Math.random() < 0.35) setMood("sad");

    maybePopup("afterGame");
  }

  stopCurrentGame = () => {
    running = false;
    clearTimeout(timeoutId);
  };

  nextRound();
}

/***********************
  INIT
************************/
load();
renderHUD();
showView("home");
speak("Nate… your mission is simple: make Minyoung laugh, feed her, and give her the best gifts 💗");

// sometimes a popup greets you...
setTimeout(() => { if (Math.random() < 0.25) maybePopup("home"); }, 700);
