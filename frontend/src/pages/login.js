(function () {
  const LINES = [
    ["整理成片", "把散落的视频号素材收成可检索的成片。"],
    ["提取文案", "语音转写之后，整理成可以直接用的文案。"],
    ["找到参考", "按关键词搜索抖音，把值得看的内容留下来。"]
  ];
  const USERS = { admin: "123123" };
  const AUTH_KEY = "vf-auth-user";

  const body = document.body;
  const canvas = document.getElementById("globe");
  const ctx = canvas.getContext("2d");
  const headline = document.getElementById("headline");
  const subcopy = document.getElementById("subcopy");
  const card = document.getElementById("card");
  const errorEl = document.getElementById("error");
  const accountEl = document.getElementById("account");
  const passwordEl = document.getElementById("password");
  const toast = document.getElementById("toast");
  const logoutBtn = document.getElementById("logoutBtn");

  const CATALOG = [
    ["可灵 4.0", "视频 / 模型", "可", 206, "快手可灵的视频模型。用文字或参考图生成带镜头运动的短视频。"],
    ["Seedance 2.5", "视频 / 模型", "S", 228, "字节即梦的视频模型。适合从参考素材生成镜头，再接到成片。"],
    ["Seedance 2.0", "视频 / 模型", "2", 210, "Seedance 的上一代视频模型。用来做文生视频和图生视频。"],
    ["海螺 2.3", "视频 / 模型", "螺", 164, "MiniMax 海螺的视频模型。人物表演和镜头连贯是它常见的用法。"],
    ["Vidu Q2", "视频 / 模型", "V", 332, "生数 Vidu 的视频模型。适合用参考图保持角色和场景一致。"],
    ["万相 3.0", "视频 / 模型", "万", 28, "阿里通义万相的视频模型。支持文字生视频，也支持让静图动起来。"],
    ["Runway", "视频 / 模型", "R", 214, "Runway 的视频模型。常用来延长镜头、改风格，或补全画面。"],
    ["Luma Ray", "视频 / 模型", "L", 48, "Luma 的视频模型。从文字或首帧生成运动比较平滑的短镜头。"],
    ["PixVerse C1", "视频 / 模型", "P", 318, "PixVerse 的视频模型。常用来把人物照片做成有表情和动作的短片。"],
    ["Veo 3.1", "视频 / 模型", "视", 122, "Google Veo 的视频模型。可以同时生成画面和配套的声音。"],
    ["Sora", "视频 / 模型", "索", 236, "OpenAI 的视频模型。适合更长、镜头更完整的生成视频。"],
    ["Pika", "视频 / 模型", "皮", 188, "Pika 的视频模型。适合短镜头、局部修改和效果变化。"],
    ["清影", "视频 / 模型", "清", 198, "智谱清影。由文字或图片生成短视频。"],
    ["HappyHorse", "视频 / 模型", "H", 96, "视频生成模型。把一段描述变成有运动节奏的短片。"],
    ["混元视频", "视频 / 模型", "混", 142, "腾讯混元的视频模型。用来生成中文场景里的短视频。"],
    ["即梦视频", "视频 / 模型", "即", 268, "即梦的视频入口。把一句描述或一张静帧接成连续镜头。"],
    ["LTX", "视频 / 模型", "X", 18, "Lightricks 的视频模型。适合较快地生成和修改短镜头。"],
    ["SkyReels", "视频 / 模型", "天", 200, "面向短剧和人物表演的视频模型。"],
    ["Seedream 5.0 Pro", "图像 / 模型", "梦", 250, "豆包 Seedream 的高档图像模型。用来出角色、商品和海报。"],
    ["Seedream 5.0", "图像 / 模型", "豆", 262, "豆包 Seedream 的图像模型。文字生图，也能按参考图改画面。"],
    ["可图", "图像 / 模型", "图", 192, "可灵配套的图像模型。用来生成角色、海报和分镜静帧。"],
    ["Flux", "图像 / 模型", "F", 282, "Black Forest Labs 的图像模型。写实画面和画面里的文字都比较稳。"],
    ["Midjourney", "图像 / 模型", "M", 292, "Midjourney 的图像模型。偏向艺术构图和风格化画面。"],
    ["Ideogram", "图像 / 模型", "I", 72, "图像模型。强项是海报，以及画面中的文字排版。"],
    ["混元图像", "图像 / 模型", "元", 150, "腾讯混元的图像模型。用来生成和修改中文场景画面。"],
    ["通义万相", "图像 / 模型", "通", 12, "阿里的图像模型。覆盖文字生图、风格变化和局部修改。"],
    ["Recraft", "图像 / 模型", "Re", 340, "偏设计和矢量风格的图像模型。适合图标、海报和品牌画面。"],
    ["SD3", "图像 / 模型", "SD", 24, "Stability AI 的图像模型。开源路线里常用的文生图选择。"],
    ["即梦图片", "图像 / 模型", "画", 276, "即梦的图像模型。用来出角色设定、封面和分镜静帧。"],
    ["Leonardo", "图像 / 模型", "Le", 44, "Leonardo 的图像模型。常用于游戏原画、角色和风格探索。"],
    ["Firefly", "图像 / 模型", "Ff", 4, "Adobe Firefly。用来生成和填充可进设计流程的画面。"],
    ["Kolors", "图像 / 模型", "色", 176, "可图一脉的图像模型。适合中文提示和写实画面。"],
    ["DeepSeek V4", "对话 / 模型", "深", 220, "深度求索的对话模型。用来写文案、拆任务和做长文本整理。"],
    ["Kimi K3", "对话 / 模型", "月", 252, "月之暗面 Kimi。适合长文阅读、资料整理和连续对话。"],
    ["豆包 2.0", "对话 / 模型", "包", 16, "字节豆包的对话模型。用来写脚本、改文案和日常问答。"],
    ["Qwen3.8", "对话 / 模型", "问", 32, "阿里通义千问。覆盖对话、代码和多模态理解。"],
    ["GLM-5.3", "对话 / 模型", "智", 168, "智谱 GLM。用来做中文对话、工具调用和内容整理。"],
    ["MiniMax", "对话 / 模型", "海", 158, "MiniMax 的对话模型。适合角色对话和内容生成。"],
    ["Claude", "对话 / 模型", "C", 20, "Anthropic 的对话模型。长文写作、改稿和代码说明比较常用。"],
    ["GPT", "对话 / 模型", "G", 152, "OpenAI 的对话模型。通用问答、写作和图像理解都常被用到。"],
    ["Gemini", "对话 / 模型", "Ge", 136, "Google 的对话模型。适合多模态理解和长上下文整理。"],
    ["Grok", "对话 / 模型", "克", 88, "xAI 的对话模型。用来做实时话题的问答和内容草稿。"],
    ["文心", "对话 / 模型", "文", 40, "百度文心。中文对话、搜索问答和内容生成的常用选择。"],
    ["Llama", "对话 / 模型", "拉", 300, "Meta 的开源对话模型。常被拿来私有化部署和二次微调。"],
    ["Mistral", "对话 / 模型", "Mi", 184, "Mistral 的对话模型。欧洲开源路线里常用的通用模型。"],
    ["阶跃", "对话 / 模型", "阶", 354, "阶跃星辰的对话模型。用来做中文助手和多模态理解。"]
  ];
  const MODELS = CATALOG.map(function (item, index) {
    const y = 1 - (index / Math.max(1, CATALOG.length - 1)) * 2;
    const theta = Math.PI * (3 - Math.sqrt(5)) * index;
    return {
      name: item[0],
      kind: item[1],
      glyph: item[2],
      hue: item[3],
      lat: Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI,
      lon: ((theta * 180 / Math.PI) % 360 + 540) % 360 - 180
    };
  });
  const INTRO = {};
  CATALOG.forEach(function (item) { INTRO[item[0]] = item[4]; });

  const showLeft = document.getElementById("showLeft");
  const showRight = document.getElementById("showRight");
  const blobs = [
    [8, 20, 0.48], [48, 12, 0.3], [38, 95, 0.55], [22, 78, 0.22],
    [6, 112, 0.2], [34, 108, 0.26], [-25, 134, 0.24],
    [46, -100, 0.48], [-14, -60, 0.34], [72, -42, 0.16],
    [62, 70, 0.18], [-4, 38, 0.2]
  ];

  function land(lat, lon) {
    let best = 0;
    for (let i = 0; i < blobs.length; i++) {
      const blat = blobs[i][0] * Math.PI / 180;
      const blon = blobs[i][1] * Math.PI / 180;
      const dLat = lat - blat;
      let dLon = lon - blon;
      dLon = Math.atan2(Math.sin(dLon), Math.cos(dLon));
      const dist = Math.sqrt(dLat * dLat + Math.cos(lat) * dLon * dLon * Math.cos(blat));
      if (dist < blobs[i][2]) best = Math.max(best, 1 - dist / blobs[i][2]);
    }
    return best;
  }

  const dots = [];
  for (let i = 0; i <= 86; i++) {
    const lat = -Math.PI / 2 + (i / 86) * Math.PI;
    const ring = Math.max(14, Math.round(132 * Math.cos(lat)));
    for (let j = 0; j < ring; j++) {
      const lon = (j / ring) * Math.PI * 2 - Math.PI;
      const weight = land(lat, lon);
      if (weight < 0.05 && (i + j) % 2 !== 0) continue;
      dots.push({
        x: Math.cos(lat) * Math.cos(lon),
        y: Math.sin(lat),
        z: Math.cos(lat) * Math.sin(lon),
        land: weight
      });
    }
  }

  const showLeftMark = document.getElementById("showLeftMark");
  const showLeftKind = document.getElementById("showLeftKind");
  const showLeftName = document.getElementById("showLeftName");
  const showLeftIntro = document.getElementById("showLeftIntro");
  const showRightMark = document.getElementById("showRightMark");
  const showRightKind = document.getElementById("showRightKind");
  const showRightName = document.getElementById("showRightName");
  const showRightIntro = document.getElementById("showRightIntro");
  const modelCard = document.getElementById("modelCard");
  const modelCardMark = document.getElementById("modelCardMark");
  const modelCardKind = document.getElementById("modelCardKind");
  const modelCardName = document.getElementById("modelCardName");
  const modelCardIntro = document.getElementById("modelCardIntro");
  let rot = 0.55;
  let focus = { left: 0, right: 7, until: 0 };
  let selectedIndex = -1;
  let hoverIndex = -1;
  const hits = [];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  }

  function spin(x, y, z, cos, sin) {
    return { x: x * cos + z * sin, y: y, z: -x * sin + z * cos };
  }

  function projectModel(model, cos, sin) {
    const lat = model.lat * Math.PI / 180;
    const lon = model.lon * Math.PI / 180;
    return spin(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon), cos, sin);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function paintMark(model, el, kindEl, nameEl, introEl) {
    el.textContent = model.glyph;
    el.style.background = "linear-gradient(145deg, hsl(" + model.hue + " 78% 64%), hsl(" + model.hue + " 72% 40%))";
    kindEl.textContent = model.kind;
    nameEl.textContent = model.name;
    introEl.textContent = INTRO[model.name] || "";
  }

  function showPair(leftIndex, rightIndex) {
    paintMark(MODELS[leftIndex], showLeftMark, showLeftKind, showLeftName, showLeftIntro);
    paintMark(MODELS[rightIndex], showRightMark, showRightKind, showRightName, showRightIntro);
    showLeft.classList.remove("show");
    showRight.classList.remove("show");
    void showLeft.offsetWidth;
    showLeft.classList.add("show");
    showRight.classList.add("show");
  }

  function chooseSide(list, avoid) {
    const pool = list.filter(function (index) { return index !== avoid; });
    const source = pool.length ? pool : list;
    if (!source.length) return avoid;
    return source[Math.floor(Math.random() * source.length)];
  }

  function refreshFocus(now, cos, sin) {
    if (now < focus.until) return;
    const left = [];
    const right = [];
    for (let i = 0; i < MODELS.length; i++) {
      const point = projectModel(MODELS[i], cos, sin);
      if (point.z < 0.2) continue;
      if (point.x < -0.12) left.push(i);
      if (point.x > 0.12) right.push(i);
    }
    const nextLeft = chooseSide(left, focus.right);
    const nextRight = chooseSide(right, nextLeft);
    if (nextLeft === focus.left && nextRight === focus.right && focus.until) {
      focus.until = now + 1200;
      return;
    }
    focus = { left: nextLeft, right: nextRight, until: now + 3800 };
    showPair(nextLeft, nextRight);
  }

  function drawOrbit(cx, cy, rx, ry, tilt, angle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(186, 214, 255, 0.22)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    const tail = ctx.createLinearGradient(Math.cos(angle - 0.45) * rx, Math.sin(angle - 0.45) * ry, x, y);
    tail.addColorStop(0, "rgba(255,255,255,0)");
    tail.addColorStop(1, "rgba(210, 232, 255, 0.85)");
    ctx.strokeStyle = tail;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, angle - 0.55, angle);
    ctx.stroke();
    ctx.fillStyle = "#f4fbff";
    ctx.shadowColor = "rgba(170, 214, 255, 0.9)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBadge(x, y, size, model, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "hsla(" + model.hue + ", 80%, 60%, 0.55)";
    ctx.shadowBlur = size * 0.45;
    roundRect(x - size / 2, y - size / 2, size, size, size * 0.28);
    const fill = ctx.createLinearGradient(x, y - size, x, y + size);
    fill.addColorStop(0, "hsl(" + model.hue + " 78% 66%)");
    fill.addColorStop(1, "hsl(" + model.hue + " 70% 42%)");
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.strokeStyle = "rgba(255,255,255,0.72)";
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "700 " + Math.round(size * 0.42) + "px \"PingFang SC\", sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(model.glyph, x, y + size * 0.04);
    ctx.restore();
  }

  function draw(now) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h * 0.48;
    const radius = Math.min(w, h) * 0.42;
    const cssRadius = radius / (window.devicePixelRatio ? Math.min(window.devicePixelRatio, 2) : 1);
    const gap = 96;
    const margin = 20;
    const half = window.innerWidth / 2;
    const room = half - cssRadius - gap - margin;
    const width = Math.min(220, Math.max(150, Math.floor(room)));
    const inset = Math.max(margin, half - cssRadius - gap - width);
    showLeft.style.width = width + "px";
    showRight.style.width = width + "px";
    showLeft.style.left = inset + "px";
    showRight.style.right = inset + "px";
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    ctx.clearRect(0, 0, w, h);
    refreshFocus(now, cos, sin);

    const atmosphere = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius * 1.08);
    atmosphere.addColorStop(0, "rgba(120, 170, 230, 0)");
    atmosphere.addColorStop(0.72, "rgba(150, 196, 255, 0.08)");
    atmosphere.addColorStop(1, "rgba(150, 196, 255, 0)");
    ctx.fillStyle = atmosphere;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
    ctx.fill();

    drawOrbit(cx, cy, radius * 1.28, radius * 0.42, -0.35, rot * 2.4);
    drawOrbit(cx, cy, radius * 1.48, radius * 0.5, 0.42, -rot * 1.7 + 1.2);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(226, 238, 255, 0.55)";
    ctx.lineWidth = Math.max(1.4, w / 1100);
    ctx.stroke();

    for (let i = 0; i < dots.length; i++) {
      const p = dots[i];
      const spun = spin(p.x, p.y, p.z, cos, sin);
      if (spun.z < -0.05) continue;
      const front = 0.18 + spun.z * 0.9;
      const alpha = p.land > 0 ? Math.min(1, front * (0.35 + p.land * 0.9)) : front * 0.1;
      const size = (p.land > 0.2 ? 3.1 : 1.2) * (radius / 280);
      ctx.fillStyle = p.land > 0.08
        ? "rgba(244, 250, 255, " + alpha.toFixed(3) + ")"
        : "rgba(176, 204, 232, " + alpha.toFixed(3) + ")";
      ctx.fillRect(cx + spun.x * radius, cy - spun.y * radius, size, size);
    }

    hits.length = 0;
    const badges = [];
    for (let i = 0; i < MODELS.length; i++) {
      const point = projectModel(MODELS[i], cos, sin);
      if (point.z < 0.02) continue;
      badges.push({ index: i, point: point });
    }
    badges.sort(function (a, b) { return a.point.z - b.point.z; });
    for (let i = 0; i < badges.length; i++) {
      const item = badges[i];
      const featured = item.index === focus.left || item.index === focus.right;
      if (featured) continue;
      const inCenter = Math.abs(item.point.x) < 0.46 && Math.abs(item.point.y) < 0.32;
      if (inCenter) continue;
      const depth = 0.55 + item.point.z * 0.55;
      const pop = featured ? 1 : 0;
      const size = (featured ? 36 : 22) * depth * (radius / 260);
      const x = cx + item.point.x * radius * (1 + pop * 0.22) ;
      const y = cy - item.point.y * radius;
      const badgeSize = Math.max(15, size);
      let crowded = false;
      for (let h = 0; h < hits.length; h++) {
        const dx = hits[h].x - x;
        const dy = hits[h].y - y;
        const gap = (hits[h].size + badgeSize) * 0.42;
        if (dx * dx + dy * dy < gap * gap) {
          crowded = true;
          break;
        }
      }
      if (crowded) continue;
      drawBadge(x, y, badgeSize, MODELS[item.index], featured ? 1 : Math.min(1, depth));
      if (item.index === selectedIndex || item.index === hoverIndex) {
        ctx.beginPath();
        ctx.arc(x, y, badgeSize * 0.72, 0, Math.PI * 2);
        ctx.strokeStyle = item.index === selectedIndex ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.45)";
        ctx.lineWidth = item.index === selectedIndex ? 2.4 : 1.4;
        ctx.stroke();
      }
      hits.push({ index: item.index, x: x, y: y, size: badgeSize });
    }

    rot += 0.0032;
    requestAnimationFrame(draw);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function hitAt(point) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const hit = hits[i];
      if (Math.abs(point.x - hit.x) <= hit.size / 2 && Math.abs(point.y - hit.y) <= hit.size / 2) return hit.index;
    }
    return -1;
  }

  function openModel(index) {
    const model = MODELS[index];
    if (!model) return;
    selectedIndex = index;
    modelCardMark.textContent = model.glyph;
    modelCardMark.style.background = "linear-gradient(145deg, hsl(" + model.hue + " 78% 64%), hsl(" + model.hue + " 72% 40%))";
    modelCardKind.textContent = model.kind;
    modelCardName.textContent = model.name;
    modelCardIntro.textContent = INTRO[model.name] || "这个模型可以用来生成对应的画面或视频。";
    modelCard.classList.add("open");
    modelCard.setAttribute("aria-hidden", "false");
  }

  function closeModel() {
    selectedIndex = -1;
    modelCard.classList.remove("open");
    modelCard.setAttribute("aria-hidden", "true");
  }

  canvas.addEventListener("mousemove", function (event) {
    const index = hitAt(canvasPoint(event));
    hoverIndex = index;
    canvas.style.cursor = index >= 0 ? "pointer" : "default";
  });
  canvas.addEventListener("mouseleave", function () {
    hoverIndex = -1;
    canvas.style.cursor = "default";
  });
  canvas.addEventListener("click", function (event) {
    const index = hitAt(canvasPoint(event));
    if (index < 0) {
      closeModel();
      return;
    }
    if (index === selectedIndex) closeModel();
    else openModel(index);
  });
  showLeft.addEventListener("click", function () { openModel(focus.left); });
  showRight.addEventListener("click", function () { openModel(focus.right); });
  document.getElementById("modelCardClose").addEventListener("click", closeModel);

  resize();
  window.addEventListener("resize", resize);
  showPair(focus.left, focus.right);
  requestAnimationFrame(draw);

  let line = 0;
  function showLine(index) {
    headline.textContent = LINES[index][0];
    subcopy.textContent = LINES[index][1];
    headline.style.opacity = "1";
  }
  setInterval(function () {
    if (body.classList.contains("authed")) return;
    line = (line + 1) % LINES.length;
    headline.style.opacity = "0";
    setTimeout(function () {
      if (body.classList.contains("authed")) {
        headline.style.opacity = "1";
        return;
      }
      showLine(line);
    }, 180);
  }, 4200);

  function storage() {
    return document.getElementById("remember").checked ? localStorage : sessionStorage;
  }

  function currentUser() {
    return sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY);
  }

  function openLogin() {
    closeModel();
    body.classList.add("modal-open");
    errorEl.textContent = "";
    setTimeout(function () { accountEl.focus(); }, 30);
  }

  function closeLogin() {
    body.classList.remove("modal-open");
  }

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toast.classList.remove("show"); }, 1800);
  }

  function setGuest() {
    body.classList.remove("authed");
    logoutBtn.hidden = true;
    sessionStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_KEY);
  }

  document.getElementById("openLogin").addEventListener("click", openLogin);
  document.getElementById("closeLogin").addEventListener("click", closeLogin);
  document.getElementById("modal").addEventListener("click", function (event) {
    if (event.target.id === "modal") closeLogin();
  });

  document.querySelectorAll(".tabs button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".tabs button").forEach(function (item) {
        item.classList.toggle("active", item === btn);
      });
      card.classList.toggle("alt", btn.dataset.tab !== "password");
      errorEl.textContent = "";
    });
  });

  document.getElementById("togglePwd").addEventListener("click", function () {
    const show = passwordEl.type === "password";
    passwordEl.type = show ? "text" : "password";
    this.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
  });

  logoutBtn.addEventListener("click", function () {
    setGuest();
    showLine(0);
    showToast("已退出登录");
    openLogin();
  });

  card.addEventListener("submit", function (event) {
    event.preventDefault();
    if (card.classList.contains("alt")) return;
    const account = accountEl.value.trim();
    const password = passwordEl.value;
    errorEl.textContent = "";
    if (!account || !password) {
      errorEl.textContent = "请输入账号和密码";
      card.classList.remove("shake");
      void card.offsetWidth;
      card.classList.add("shake");
      return;
    }
    if (USERS[account] !== password) {
      errorEl.textContent = "账号或密码不正确";
      card.classList.remove("shake");
      void card.offsetWidth;
      card.classList.add("shake");
      return;
    }
    sessionStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_KEY);
    storage().setItem(AUTH_KEY, account);
    location.replace("/");
  });

  if (currentUser()) location.replace("/");
})();
